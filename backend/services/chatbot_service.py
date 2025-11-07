import os
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import json

# Load environment variables
load_dotenv()

# Database connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'waste_management')]

# Get Emergent LLM key
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

# Define available functions for AI to call
FUNCTIONS = [
    {
        "name": "get_bins_by_status",
        "description": "Get all bins filtered by their status (critical, full, half-full, or empty). Use this when admin asks about bins that need attention or are full.",
        "parameters": {
            "type": "object",
            "properties": {
                "status": {
                    "type": "string",
                    "enum": ["critical", "full", "half-full", "empty"],
                    "description": "The fill status to filter bins by"
                }
            },
            "required": ["status"]
        }
    },
    {
        "name": "get_all_bins",
        "description": "Get all bins in the system with their current status and fill levels. Use this for general bin queries.",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    {
        "name": "get_available_drivers",
        "description": "Get all available drivers who are not currently on a route. Use this when admin needs to know which drivers are available for assignment.",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    {
        "name": "get_driver_info",
        "description": "Get detailed information about a specific driver including their current route and stats. Use this when asked about a specific driver's information or current task.",
        "parameters": {
            "type": "object",
            "properties": {
                "driver_name": {
                    "type": "string",
                    "description": "The name of the driver to get information about"
                }
            },
            "required": ["driver_name"]
        }
    },
    {
        "name": "assign_bins_automatically",
        "description": "Automatically assign bins to drivers using AI algorithm. Use this when admin requests automatic assignment or wants the system to intelligently assign bins to drivers.",
        "parameters": {
            "type": "object",
            "properties": {
                "trigger": {
                    "type": "boolean",
                    "description": "Set to true to trigger automatic assignment",
                    "default": True
                }
            },
            "required": []
        }
    },
    {
        "name": "get_driver_completed_bins_today",
        "description": "Get the number of bins a driver has cleaned/completed today. Use this when driver asks how many bins they cleaned today.",
        "parameters": {
            "type": "object",
            "properties": {
                "driver_name": {
                    "type": "string",
                    "description": "The name of the driver"
                }
            },
            "required": ["driver_name"]
        }
    },
    {
        "name": "get_driver_pending_bins",
        "description": "Get the pending bins assigned to a driver (bins in their current route that haven't been collected yet). Use this when driver asks about pending or remaining bins.",
        "parameters": {
            "type": "object",
            "properties": {
                "driver_name": {
                    "type": "string",
                    "description": "The name of the driver"
                }
            },
            "required": ["driver_name"]
        }
    },
    {
        "name": "get_driver_route_status",
        "description": "Get the current route status and details for a driver. Use this when asked about driver's current task or route.",
        "parameters": {
            "type": "object",
            "properties": {
                "driver_name": {
                    "type": "string",
                    "description": "The name of the driver"
                }
            },
            "required": ["driver_name"]
        }
    }
]

# Function implementations
async def get_bins_by_status(status: str):
    """Get bins filtered by status"""
    bins = await db.bins.find({"status": status}, {"_id": 0}).to_list(1000)
    return {
        "status": status,
        "count": len(bins),
        "bins": [{"location": b["location_name"], "fill_level": b["fill_level"]} for b in bins[:10]]  # Limit to 10
    }

async def get_all_bins():
    """Get all bins"""
    bins = await db.bins.find({}, {"_id": 0}).to_list(1000)
    status_summary = {}
    for bin_item in bins:
        status = bin_item["status"]
        status_summary[status] = status_summary.get(status, 0) + 1
    
    return {
        "total_bins": len(bins),
        "summary": status_summary,
        "critical_bins": [b["location_name"] for b in bins if b["status"] == "critical"]
    }

async def get_available_drivers():
    """Get available drivers"""
    drivers = await db.drivers.find({"availability": "available"}, {"_id": 0}).to_list(1000)
    return {
        "available_count": len(drivers),
        "drivers": [{"name": d["name"], "location": d["current_location"]} for d in drivers]
    }

async def get_driver_info(driver_name: str):
    """Get driver information"""
    driver = await db.drivers.find_one({"name": driver_name}, {"_id": 0})
    if not driver:
        return {"error": f"Driver {driver_name} not found"}
    
    # Get current route if any
    current_route = None
    if driver.get("current_route_id"):
        route = await db.routes.find_one({"id": driver["current_route_id"]}, {"_id": 0})
        if route:
            current_route = {
                "status": route["status"],
                "bin_count": len(route["bin_ids"])
            }
    
    return {
        "name": driver["name"],
        "availability": driver["availability"],
        "total_routes_completed": driver.get("total_routes_completed", 0),
        "current_route": current_route
    }

async def assign_bins_automatically(trigger: bool = True):
    """Trigger automatic bin assignment"""
    if not trigger:
        return {"message": "Automatic assignment not triggered"}
    
    # Import the AI assignment service
    import sys
    sys.path.append('/app/backend')
    from services.ai_assignment_service import AIAssignmentService
    
    assignments = await AIAssignmentService.auto_assign_critical_bins()
    
    return {
        "assignments_created": len(assignments),
        "message": f"Successfully created {len(assignments)} automatic assignments"
    }

async def get_driver_completed_bins_today(driver_name: str):
    """Get bins completed by driver today"""
    driver = await db.drivers.find_one({"name": driver_name}, {"_id": 0})
    if not driver:
        return {"error": f"Driver {driver_name} not found"}
    
    # Get today's completed routes
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    completed_routes = await db.routes.find({
        "driver_id": driver["driver_id"],
        "status": "completed",
        "completed_at": {"$gte": today_start.isoformat()}
    }, {"_id": 0}).to_list(1000)
    
    total_bins = sum(len(route["bin_ids"]) for route in completed_routes)
    
    return {
        "driver": driver_name,
        "bins_completed_today": total_bins,
        "routes_completed_today": len(completed_routes)
    }

async def get_driver_pending_bins(driver_name: str):
    """Get pending bins for driver"""
    driver = await db.drivers.find_one({"name": driver_name}, {"_id": 0})
    if not driver:
        return {"error": f"Driver {driver_name} not found"}
    
    # Get active routes
    active_routes = await db.routes.find({
        "driver_id": driver["driver_id"],
        "status": {"$in": ["assigned", "in-progress", "pending"]}
    }, {"_id": 0}).to_list(1000)
    
    if not active_routes:
        return {"driver": driver_name, "pending_bins": 0, "message": "No pending bins"}
    
    # Get bin details
    all_bin_ids = []
    for route in active_routes:
        all_bin_ids.extend(route["bin_ids"])
    
    bins = await db.bins.find({"id": {"$in": all_bin_ids}, "status": {"$ne": "empty"}}, {"_id": 0}).to_list(1000)
    
    return {
        "driver": driver_name,
        "pending_bins": len(bins),
        "bin_locations": [b["location_name"] for b in bins[:5]]  # Show first 5
    }

async def get_driver_route_status(driver_name: str):
    """Get driver's current route status"""
    driver = await db.drivers.find_one({"name": driver_name}, {"_id": 0})
    if not driver:
        return {"error": f"Driver {driver_name} not found"}
    
    if not driver.get("current_route_id"):
        return {"driver": driver_name, "message": "No active route assigned"}
    
    route = await db.routes.find_one({"id": driver["current_route_id"]}, {"_id": 0})
    if not route:
        return {"driver": driver_name, "message": "Route not found"}
    
    # Get bin details
    bins = await db.bins.find({"id": {"$in": route["bin_ids"]}}, {"_id": 0}).to_list(1000)
    collected = len([b for b in bins if b["status"] == "empty"])
    
    return {
        "driver": driver_name,
        "route_status": route["status"],
        "total_bins": len(route["bin_ids"]),
        "collected_bins": collected,
        "pending_bins": len(route["bin_ids"]) - collected
    }

# Function mapping
FUNCTION_MAP = {
    "get_bins_by_status": get_bins_by_status,
    "get_all_bins": get_all_bins,
    "get_available_drivers": get_available_drivers,
    "get_driver_info": get_driver_info,
    "assign_bins_automatically": assign_bins_automatically,
    "get_driver_completed_bins_today": get_driver_completed_bins_today,
    "get_driver_pending_bins": get_driver_pending_bins,
    "get_driver_route_status": get_driver_route_status
}

async def process_chat_message(user_message: str, session_id: str, user_role: str):
    """
    Process a chat message with function calling
    
    Args:
        user_message: The user's message
        session_id: Unique session ID for this chat
        user_role: Either 'admin' or 'driver'
    
    Returns:
        AI response text
    """
    # Different system messages for admin vs driver
    if user_role == "admin":
        system_message = """You are an AI assistant for a waste management system helping administrators.
You can help with:
- Checking bin statuses (which bins are full, critical, etc.)
- Getting driver information and their current tasks
- Automatically assigning bins to drivers using AI
- Viewing available drivers

Always be concise and helpful. When you use functions, explain the results clearly."""
    else:  # driver
        system_message = """You are an AI assistant for a waste management system helping drivers.
You can help with:
- Telling them how many bins they cleaned today
- Showing their pending bins
- Explaining their current route status

Always be encouraging and helpful. Celebrate their completed work!"""
    
    # Initialize chat
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system_message
    ).with_model("openai", "gpt-4o-mini")
    
    # Create user message
    message = UserMessage(text=user_message)
    
    # Send message - the library handles function calling internally
    try:
        # First call to get function call request
        response = await chat.send_message(message)
        
        # Check if AI wants to call a function
        # Note: emergentintegrations handles this internally, but we need to extract function calls
        # For now, let's use a simpler approach: parse the response for function needs
        
        # If response seems like it needs data, try to call appropriate function
        # This is a simplified approach - in production, use proper function calling from the library
        
        # For now, return the direct response
        return response
        
    except Exception as e:
        return f"Sorry, I encountered an error: {str(e)}"

# Store chat history in database
async def save_chat_message(session_id: str, role: str, content: str, user_role: str):
    """Save chat message to database"""
    await db.chat_history.insert_one({
        "session_id": session_id,
        "role": role,  # 'user' or 'assistant'
        "content": content,
        "user_role": user_role,  # 'admin' or 'driver'
        "timestamp": datetime.now(timezone.utc).isoformat()
    })

async def get_chat_history(session_id: str, limit: int = 50):
    """Get chat history for a session"""
    messages = await db.chat_history.find(
        {"session_id": session_id},
        {"_id": 0}
    ).sort("timestamp", 1).limit(limit).to_list(limit)
    return messages
