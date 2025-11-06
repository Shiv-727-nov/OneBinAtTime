from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import os
import sys
sys.path.append('/app/backend')
from services.ai_assignment_service import AIAssignmentService

router = APIRouter()

# Get database connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'waste_management')]

# Models
class TriggerAssignmentResponse(BaseModel):
    success: bool
    message: str
    assignments_created: int

@router.post("/trigger-assignment", response_model=dict)
async def trigger_ai_assignment():
    """Manually trigger AI assignment check (admin only)"""
    try:
        assignments = await AIAssignmentService.auto_assign_critical_bins()
        
        return {
            "success": True,
            "data": {
                "assignments_created": len(assignments),
                "assignments": assignments
            },
            "message": f"AI assignment triggered. Created {len(assignments)} assignments."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error triggering AI assignment: {str(e)}")

@router.get("/assignments", response_model=dict)
async def get_ai_assignments(status: Optional[str] = None, assigned_by: Optional[str] = "AI"):
    """Retrieve all AI assignments with reasoning"""
    try:
        query = {}
        if status:
            query["status"] = status
        if assigned_by:
            query["assigned_by"] = assigned_by
        
        assignments = await db.assignments.find(query, {"_id": 0}).to_list(1000)
        
        # Convert timestamp strings if needed
        for assignment in assignments:
            if isinstance(assignment.get('timestamp'), str):
                try:
                    assignment['timestamp'] = datetime.fromisoformat(assignment['timestamp'])
                except:
                    pass
        
        return {
            "success": True,
            "data": assignments,
            "message": "AI assignments retrieved successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving assignments: {str(e)}")

@router.get("/metrics", response_model=dict)
async def get_ai_metrics():
    """Return AI performance statistics"""
    try:
        # Total assignments
        total_assignments = await db.assignments.count_documents({"assigned_by": "AI"})
        
        # Today's assignments
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        today_assignments = await db.assignments.count_documents({
            "assigned_by": "AI",
            "timestamp": {"$gte": today_start.isoformat()}
        })
        
        # Success rate (assignments not overridden)
        total_with_status = await db.assignments.count_documents({"assigned_by": "AI", "status": {"$exists": True}})
        not_overridden = await db.assignments.count_documents({"assigned_by": "AI", "admin_override": False})
        success_rate = (not_overridden / total_with_status * 100) if total_with_status > 0 else 0
        
        # Average confidence score
        assignments_with_score = await db.assignments.find(
            {"assigned_by": "AI", "confidence_score": {"$exists": True}},
            {"confidence_score": 1, "_id": 0}
        ).to_list(1000)
        avg_confidence = sum(a['confidence_score'] for a in assignments_with_score) / len(assignments_with_score) if assignments_with_score else 0
        
        # Most frequently assigned driver
        pipeline = [
            {"$match": {"assigned_by": "AI"}},
            {"$group": {"_id": "$driver_name", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 1}
        ]
        top_driver_result = await db.assignments.aggregate(pipeline).to_list(1)
        top_driver = top_driver_result[0]['_id'] if top_driver_result else "N/A"
        
        return {
            "success": True,
            "data": {
                "total_assignments_all_time": total_assignments,
                "assignments_today": today_assignments,
                "success_rate_percentage": round(success_rate, 1),
                "average_confidence_score": round(avg_confidence, 1),
                "most_frequently_assigned_driver": top_driver,
                "avg_response_time_minutes": 5  # Placeholder - would calculate from timestamps
            },
            "message": "AI metrics retrieved successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving metrics: {str(e)}")

@router.put("/assignments/{assignment_id}/accept", response_model=dict)
async def accept_ai_assignment(assignment_id: str):
    """Accept AI suggestion and create actual route"""
    try:
        assignment = await db.assignments.find_one({"assignment_id": assignment_id})
        if not assignment:
            raise HTTPException(status_code=404, detail="Assignment not found")
        
        # Update status to accepted
        await db.assignments.update_one(
            {"assignment_id": assignment_id},
            {"$set": {"status": "accepted", "accepted_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        return {
            "success": True,
            "data": assignment,
            "message": "AI assignment accepted"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error accepting assignment: {str(e)}")

@router.delete("/assignments/{assignment_id}", response_model=dict)
async def reject_ai_assignment(assignment_id: str):
    """Reject AI suggestion"""
    try:
        result = await db.assignments.update_one(
            {"assignment_id": assignment_id},
            {"$set": {
                "status": "rejected",
                "rejected_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Assignment not found")
        
        return {
            "success": True,
            "data": {"assignment_id": assignment_id},
            "message": "AI assignment rejected"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error rejecting assignment: {str(e)}")

@router.post("/settings", response_model=dict)
async def update_ai_settings(settings: dict):
    """Configure AI parameters (threshold levels, assignment weights)"""
    try:
        # Store settings in database
        await db.ai_settings.update_one(
            {"type": "assignment_settings"},
            {"$set": {**settings, "updated_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True
        )
        
        return {
            "success": True,
            "data": settings,
            "message": "AI settings updated successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating settings: {str(e)}")

@router.get("/settings", response_model=dict)
async def get_ai_settings():
    """Get current AI configuration settings"""
    try:
        settings = await db.ai_settings.find_one({"type": "assignment_settings"}, {"_id": 0})
        
        if not settings:
            # Return default settings
            settings = {
                "type": "assignment_settings",
                "critical_threshold": 85,
                "full_threshold": 70,
                "proximity_weight": 0.4,
                "workload_weight": 0.3,
                "priority_weight": 0.2,
                "performance_weight": 0.1,
                "grouping_radius_km": 5.0
            }
        
        return {
            "success": True,
            "data": settings,
            "message": "AI settings retrieved successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving settings: {str(e)}")
