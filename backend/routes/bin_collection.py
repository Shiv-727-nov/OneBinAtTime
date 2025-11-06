from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import os
import random

router = APIRouter()

# Get database connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'waste_management')]

# Models
class BinCollect(BaseModel):
    driver_id: str

class BulkAssign(BaseModel):
    driver_id: str
    bin_ids: List[str]

# Endpoints
@router.put("/{bin_id}/collect", response_model=dict)
async def collect_bin(bin_id: str, collect_data: BinCollect):
    """Mark bin as collected"""
    try:
        bin_doc = await db.bins.find_one({"id": bin_id})
        if not bin_doc:
            raise HTTPException(status_code=404, detail="Bin not found")
        
        # Validate driver is assigned to this bin (optional - can be removed for flexibility)
        # if bin_doc.get('assigned_to') and bin_doc['assigned_to'] != collect_data.driver_id:
        #     raise HTTPException(status_code=403, detail="Bin not assigned to this driver")
        
        collected_at = datetime.now(timezone.utc).isoformat()
        
        # Add to collection history
        collection_history = bin_doc.get('collection_history', [])
        collection_history.append({
            "driver_id": collect_data.driver_id,
            "timestamp": collected_at,
            "route_id": bin_doc.get('assigned_route')
        })
        
        # Update bin
        new_fill_level = random.randint(0, 10)  # Reset to 0-10%
        await db.bins.update_one(
            {"id": bin_id},
            {"$set": {
                "fill_level": new_fill_level,
                "status": "empty",
                "last_collected": collected_at,
                "collection_history": collection_history
            }}
        )
        
        updated_bin = await db.bins.find_one({"id": bin_id}, {"_id": 0})
        
        return {"success": True, "data": updated_bin, "message": "Bin collected successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error collecting bin: {str(e)}")

@router.get("/status/{status_filter}", response_model=dict)
async def get_bins_by_status(status_filter: str):
    """Filter bins by status (critical, full, half-full, empty)"""
    try:
        valid_statuses = ["critical", "full", "half-full", "empty"]
        if status_filter not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}")
        
        bins = await db.bins.find({"status": status_filter}, {"_id": 0}).to_list(1000)
        
        return {"success": True, "data": bins, "message": f"Bins with status '{status_filter}' retrieved"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving bins: {str(e)}")

@router.get("/assigned/{driver_id}", response_model=dict)
async def get_bins_assigned_to_driver(driver_id: str):
    """Get all bins assigned to specific driver"""
    try:
        bins = await db.bins.find({"assigned_to": driver_id}, {"_id": 0}).to_list(1000)
        
        return {"success": True, "data": bins, "message": f"Bins assigned to driver retrieved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving assigned bins: {str(e)}")

@router.post("/bulk-assign", response_model=dict)
async def bulk_assign_bins(assign_data: BulkAssign):
    """Assign multiple bins to a driver"""
    try:
        # Validate driver exists
        driver = await db.drivers.find_one({"driver_id": assign_data.driver_id})
        if not driver:
            raise HTTPException(status_code=404, detail="Driver not found")
        
        # Validate all bins exist
        for bin_id in assign_data.bin_ids:
            bin_doc = await db.bins.find_one({"id": bin_id})
            if not bin_doc:
                raise HTTPException(status_code=404, detail=f"Bin {bin_id} not found")
        
        # Assign bins
        result = await db.bins.update_many(
            {"id": {"$in": assign_data.bin_ids}},
            {"$set": {"assigned_to": assign_data.driver_id}}
        )
        
        return {
            "success": True,
            "data": {
                "driver_id": assign_data.driver_id,
                "bin_ids": assign_data.bin_ids,
                "count": result.modified_count
            },
            "message": f"Assigned {result.modified_count} bins to driver"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error assigning bins: {str(e)}")
