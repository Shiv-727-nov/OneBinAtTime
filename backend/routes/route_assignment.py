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
class RouteCreate(BaseModel):
    driver_id: str
    bin_ids: List[str]
    assigned_by: str = "admin"  # admin or AI

class RouteStatusUpdate(BaseModel):
    status: str  # assigned, in-progress, completed

class Route(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))  # Changed from route_id to id
    driver_id: str
    driver_name: str
    bin_ids: List[str]
    status: str = "assigned"  # assigned, in-progress, completed
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    estimated_duration: int = 0  # minutes
    actual_duration: Optional[int] = None  # minutes
    assigned_by: str = "admin"  # admin or AI
    total_distance: Optional[float] = None  # For compatibility with existing routes

# Endpoints
@router.post("/assign", status_code=status.HTTP_201_CREATED, response_model=dict)
async def assign_route(route_data: RouteCreate):
    """Assign route to driver"""
    try:
        # Validate driver exists and is available
        driver = await db.drivers.find_one({"driver_id": route_data.driver_id})
        if not driver:
            raise HTTPException(status_code=404, detail="Driver not found")
        
        if driver.get('availability') == 'on-route':
            raise HTTPException(status_code=400, detail="Driver already has an active route")
        
        # Validate bins exist
        for bin_id in route_data.bin_ids:
            bin_doc = await db.bins.find_one({"id": bin_id})
            if not bin_doc:
                raise HTTPException(status_code=404, detail=f"Bin {bin_id} not found")
        
        # Estimate duration (10 minutes per bin)
        estimated_duration = len(route_data.bin_ids) * 10
        
        # Create route with driver_name
        route = Route(
            **route_data.model_dump(),
            driver_name=driver['name'],
            estimated_duration=estimated_duration
        )
        doc = route.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        
        await db.routes.insert_one(doc)
        
        # Update driver status to on-route
        await db.drivers.update_one(
            {"driver_id": route_data.driver_id},
            {"$set": {
                "availability": "on-route",
                "current_route_id": route.id
            }}
        )
        
        # Update bins to mark as assigned
        await db.bins.update_many(
            {"id": {"$in": route_data.bin_ids}},
            {"$set": {
                "assigned_to": route_data.driver_id,
                "assigned_route": route.route_id
            }}
        )
        
        return {"success": True, "data": route.model_dump(), "message": "Route assigned successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error assigning route: {str(e)}")

@router.get("", response_model=dict)
async def get_routes(status_filter: Optional[str] = None, driver_id: Optional[str] = None):
    """List all routes with optional filters"""
    try:
        query = {}
        if status_filter:
            query["status"] = status_filter
        if driver_id:
            query["driver_id"] = driver_id
        
        routes = await db.routes.find(query, {"_id": 0}).to_list(1000)
        
        # Convert datetime strings to datetime objects
        for route in routes:
            if isinstance(route.get('created_at'), str):
                route['created_at'] = datetime.fromisoformat(route['created_at'])
            if isinstance(route.get('started_at'), str):
                route['started_at'] = datetime.fromisoformat(route['started_at'])
            if isinstance(route.get('completed_at'), str):
                route['completed_at'] = datetime.fromisoformat(route['completed_at'])
        
        return {"success": True, "data": routes, "message": "Routes retrieved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving routes: {str(e)}")

@router.get("/{route_id}", response_model=dict)
async def get_route(route_id: str):
    """Retrieve single route with full details"""
    try:
        route = await db.routes.find_one({"route_id": route_id}, {"_id": 0})
        if not route:
            raise HTTPException(status_code=404, detail="Route not found")
        
        # Get bin details
        bins = []
        for bin_id in route['bin_ids']:
            bin_doc = await db.bins.find_one({"id": bin_id}, {"_id": 0})
            if bin_doc:
                bins.append(bin_doc)
        
        route['bins_details'] = bins
        
        # Convert datetime strings
        if isinstance(route.get('created_at'), str):
            route['created_at'] = datetime.fromisoformat(route['created_at'])
        if isinstance(route.get('started_at'), str):
            route['started_at'] = datetime.fromisoformat(route['started_at'])
        if isinstance(route.get('completed_at'), str):
            route['completed_at'] = datetime.fromisoformat(route['completed_at'])
        
        return {"success": True, "data": route, "message": "Route retrieved successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving route: {str(e)}")

@router.get("/driver/{driver_id}", response_model=dict)
async def get_driver_routes(driver_id: str):
    """Retrieve all routes for specific driver"""
    try:
        routes = await db.routes.find({"driver_id": driver_id}, {"_id": 0}).to_list(1000)
        
        # Convert datetime strings
        for route in routes:
            if isinstance(route.get('created_at'), str):
                route['created_at'] = datetime.fromisoformat(route['created_at'])
            if isinstance(route.get('started_at'), str):
                route['started_at'] = datetime.fromisoformat(route['started_at'])
            if isinstance(route.get('completed_at'), str):
                route['completed_at'] = datetime.fromisoformat(route['completed_at'])
        
        return {"success": True, "data": routes, "message": "Driver routes retrieved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving driver routes: {str(e)}")

@router.put("/{route_id}/status", response_model=dict)
async def update_route_status(route_id: str, status_update: RouteStatusUpdate):
    """Update route status"""
    try:
        valid_statuses = ["assigned", "in-progress", "completed"]
        if status_update.status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}")
        
        result = await db.routes.update_one(
            {"route_id": route_id},
            {"$set": {"status": status_update.status}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Route not found")
        
        updated_route = await db.routes.find_one({"route_id": route_id}, {"_id": 0})
        
        return {"success": True, "data": updated_route, "message": "Route status updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating route status: {str(e)}")

@router.put("/{route_id}/start", response_model=dict)
async def start_route(route_id: str):
    """Mark route as started"""
    try:
        route = await db.routes.find_one({"route_id": route_id})
        if not route:
            raise HTTPException(status_code=404, detail="Route not found")
        
        if route['status'] != 'assigned':
            raise HTTPException(status_code=400, detail="Route must be in 'assigned' status to start")
        
        started_at = datetime.now(timezone.utc)
        
        result = await db.routes.update_one(
            {"route_id": route_id},
            {"$set": {
                "status": "in-progress",
                "started_at": started_at.isoformat()
            }}
        )
        
        updated_route = await db.routes.find_one({"route_id": route_id}, {"_id": 0})
        if isinstance(updated_route.get('started_at'), str):
            updated_route['started_at'] = datetime.fromisoformat(updated_route['started_at'])
        
        return {"success": True, "data": updated_route, "message": "Route started successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error starting route: {str(e)}")

@router.put("/{route_id}/complete", response_model=dict)
async def complete_route(route_id: str):
    """Mark route as completed"""
    try:
        route = await db.routes.find_one({"route_id": route_id})
        if not route:
            raise HTTPException(status_code=404, detail="Route not found")
        
        if route['status'] != 'in-progress':
            raise HTTPException(status_code=400, detail="Route must be 'in-progress' to complete")
        
        completed_at = datetime.now(timezone.utc)
        
        # Calculate actual duration
        started_at = datetime.fromisoformat(route['started_at']) if isinstance(route.get('started_at'), str) else route.get('started_at')
        if started_at:
            actual_duration = int((completed_at - started_at).total_seconds() / 60)
        else:
            actual_duration = 0
        
        # Update route
        await db.routes.update_one(
            {"route_id": route_id},
            {"$set": {
                "status": "completed",
                "completed_at": completed_at.isoformat(),
                "actual_duration": actual_duration
            }}
        )
        
        # Update driver - set back to available
        driver = await db.drivers.find_one({"driver_id": route['driver_id']})
        if driver:
            await db.drivers.update_one(
                {"driver_id": route['driver_id']},
                {"$set": {
                    "availability": "available",
                    "current_route_id": None,
                    "total_routes_completed": driver.get('total_routes_completed', 0) + 1
                }}
            )
        
        # Update bins - set last_collected timestamp
        await db.bins.update_many(
            {"id": {"$in": route['bin_ids']}},
            {"$set": {
                "last_collected": completed_at.isoformat(),
                "assigned_to": None,
                "assigned_route": None
            }}
        )
        
        updated_route = await db.routes.find_one({"route_id": route_id}, {"_id": 0})
        if isinstance(updated_route.get('completed_at'), str):
            updated_route['completed_at'] = datetime.fromisoformat(updated_route['completed_at'])
        
        return {"success": True, "data": updated_route, "message": "Route completed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error completing route: {str(e)}")

@router.delete("/{route_id}", response_model=dict)
async def cancel_route(route_id: str):
    """Cancel route assignment (admin only, only if status is assigned)"""
    try:
        route = await db.routes.find_one({"route_id": route_id})
        if not route:
            raise HTTPException(status_code=404, detail="Route not found")
        
        if route['status'] != 'assigned':
            raise HTTPException(status_code=400, detail="Can only cancel routes with 'assigned' status")
        
        # Update driver - set back to available
        await db.drivers.update_one(
            {"driver_id": route['driver_id']},
            {"$set": {
                "availability": "available",
                "current_route_id": None
            }}
        )
        
        # Update bins - remove assignment
        await db.bins.update_many(
            {"id": {"$in": route['bin_ids']}},
            {"$set": {
                "assigned_to": None,
                "assigned_route": None
            }}
        )
        
        # Delete route
        await db.routes.delete_one({"route_id": route_id})
        
        return {"success": True, "data": {"route_id": route_id}, "message": "Route cancelled successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error cancelling route: {str(e)}")
