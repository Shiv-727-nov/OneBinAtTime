from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import os
import uuid

router = APIRouter()

# Get database connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'waste_management')]

# Models
class Location(BaseModel):
    lat: float
    lng: float

class DriverCreate(BaseModel):
    name: str
    email: str
    phone: str
    current_location: Location
    availability: str = "available"  # available, on-route, off-duty

class DriverUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None

class DriverStatusUpdate(BaseModel):
    availability: str  # available, on-route, off-duty

class DriverLocationUpdate(BaseModel):
    current_location: Location

class Driver(BaseModel):
    model_config = ConfigDict(extra="ignore")
    driver_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    phone: str
    current_location: Location
    availability: str = "available"
    total_routes_completed: int = 0
    current_route_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Endpoints
@router.get("", response_model=dict)
async def list_drivers():
    """List all drivers with their current status"""
    try:
        drivers = await db.drivers.find({}, {"_id": 0}).to_list(1000)
        for driver in drivers:
            if isinstance(driver.get('created_at'), str):
                driver['created_at'] = datetime.fromisoformat(driver['created_at'])
        return {"success": True, "data": drivers, "message": "Drivers retrieved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving drivers: {str(e)}")

@router.get("/{driver_id}", response_model=dict)
async def get_driver(driver_id: str):
    """Retrieve single driver details"""
    try:
        driver = await db.drivers.find_one({"driver_id": driver_id}, {"_id": 0})
        if not driver:
            raise HTTPException(status_code=404, detail="Driver not found")
        
        if isinstance(driver.get('created_at'), str):
            driver['created_at'] = datetime.fromisoformat(driver['created_at'])
        
        return {"success": True, "data": driver, "message": "Driver retrieved successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving driver: {str(e)}")

@router.post("", status_code=status.HTTP_201_CREATED, response_model=dict)
async def create_driver(driver_data: DriverCreate):
    """Create new driver (admin only)"""
    try:
        # Check if email already exists
        existing = await db.drivers.find_one({"email": driver_data.email})
        if existing:
            raise HTTPException(status_code=400, detail="Driver with this email already exists")
        
        driver = Driver(**driver_data.model_dump())
        doc = driver.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        
        await db.drivers.insert_one(doc)
        
        return {"success": True, "data": driver.model_dump(), "message": "Driver created successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating driver: {str(e)}")

@router.put("/{driver_id}/status", response_model=dict)
async def update_driver_status(driver_id: str, status_update: DriverStatusUpdate):
    """Update driver availability status"""
    try:
        valid_statuses = ["available", "on-route", "off-duty"]
        if status_update.availability not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}")
        
        result = await db.drivers.update_one(
            {"driver_id": driver_id},
            {"$set": {"availability": status_update.availability}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Driver not found")
        
        updated_driver = await db.drivers.find_one({"driver_id": driver_id}, {"_id": 0})
        
        return {"success": True, "data": updated_driver, "message": "Driver status updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating driver status: {str(e)}")

@router.put("/{driver_id}/location", response_model=dict)
async def update_driver_location(driver_id: str, location_update: DriverLocationUpdate):
    """Update driver's current GPS coordinates"""
    try:
        result = await db.drivers.update_one(
            {"driver_id": driver_id},
            {"$set": {"current_location": location_update.current_location.model_dump()}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Driver not found")
        
        updated_driver = await db.drivers.find_one({"driver_id": driver_id}, {"_id": 0})
        
        return {"success": True, "data": updated_driver, "message": "Driver location updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating driver location: {str(e)}")

@router.put("/{driver_id}", response_model=dict)
async def update_driver(driver_id: str, driver_update: DriverUpdate):
    """Update driver information"""
    try:
        update_data = {k: v for k, v in driver_update.model_dump().items() if v is not None}
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        # Check email uniqueness if updating email
        if 'email' in update_data:
            existing = await db.drivers.find_one({"email": update_data['email'], "driver_id": {"$ne": driver_id}})
            if existing:
                raise HTTPException(status_code=400, detail="Email already in use by another driver")
        
        result = await db.drivers.update_one(
            {"driver_id": driver_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Driver not found")
        
        updated_driver = await db.drivers.find_one({"driver_id": driver_id}, {"_id": 0})
        
        return {"success": True, "data": updated_driver, "message": "Driver updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating driver: {str(e)}")

@router.delete("/{driver_id}", response_model=dict)
async def delete_driver(driver_id: str):
    """Remove driver (admin only)"""
    try:
        # Check if driver has active routes
        driver = await db.drivers.find_one({"driver_id": driver_id})
        if not driver:
            raise HTTPException(status_code=404, detail="Driver not found")
        
        if driver.get('current_route_id'):
            raise HTTPException(status_code=400, detail="Cannot delete driver with active route. Complete or reassign route first.")
        
        result = await db.drivers.delete_one({"driver_id": driver_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Driver not found")
        
        return {"success": True, "data": {"driver_id": driver_id}, "message": "Driver deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting driver: {str(e)}")
