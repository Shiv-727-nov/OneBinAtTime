from fastapi import FastAPI, APIRouter, HTTPException, status
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import bcrypt
import math

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    password: str
    role: str  # "admin" or "driver"
    name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    username: str
    role: str
    name: str

class Bin(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    location_name: str
    latitude: float
    longitude: float
    fill_level: int  # 0-100
    status: str  # "empty", "half-full", "full", "critical"
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BinCreate(BaseModel):
    location_name: str
    latitude: float
    longitude: float
    fill_level: int
    status: str

class BinUpdate(BaseModel):
    location_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    fill_level: Optional[int] = None
    status: Optional[str] = None

class Route(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    driver_id: str
    driver_name: str
    bin_ids: List[str]
    status: str  # "pending", "in-progress", "completed"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    total_distance: Optional[float] = None

class RouteCreate(BaseModel):
    driver_id: str
    bin_ids: List[str]

class RouteOptimize(BaseModel):
    start_lat: float
    start_lng: float
    bin_ids: List[str]

# Helper function to hash password
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

# Initialize demo users and bins on startup
@app.on_event("startup")
async def startup_db():
    # Create demo users if they don't exist
    admin_exists = await db.users.find_one({"username": "admin"})
    if not admin_exists:
        admin_user = User(
            username="admin",
            password=hash_password("admin123"),
            role="admin",
            name="Admin User"
        )
        doc = admin_user.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        await db.users.insert_one(doc)
    
    # Create multiple drivers
    drivers_data = [
        {"username": "driver", "password": "driver123", "name": "Demo Driver"},
        {"username": "rajesh", "password": "rajesh123", "name": "Rajesh Kumar"},
        {"username": "priya", "password": "priya123", "name": "Priya Sharma"},
        {"username": "arun", "password": "arun123", "name": "Arun Patel"},
        {"username": "lakshmi", "password": "lakshmi123", "name": "Lakshmi Iyer"},
    ]
    
    for driver_data in drivers_data:
        driver_exists = await db.users.find_one({"username": driver_data["username"]})
        if not driver_exists:
            driver_user = User(
                username=driver_data["username"],
                password=hash_password(driver_data["password"]),
                role="driver",
                name=driver_data["name"]
            )
            doc = driver_user.model_dump()
            doc['created_at'] = doc['created_at'].isoformat()
            await db.users.insert_one(doc)
    
    # Create demo bins if collection is empty
    bin_count = await db.bins.count_documents({})
    if bin_count == 0:
        demo_bins = [
            # Tamil Nadu, India bins
            BinCreate(location_name="Marina Beach", latitude=13.0499, longitude=80.2824, fill_level=92, status="critical"),
            BinCreate(location_name="T Nagar Bus Stand", latitude=13.0418, longitude=80.2341, fill_level=78, status="full"),
            BinCreate(location_name="Anna Nagar Tower", latitude=13.0878, longitude=80.2088, fill_level=55, status="half-full"),
            BinCreate(location_name="Central Railway Station", latitude=13.0827, longitude=80.2707, fill_level=88, status="full"),
            BinCreate(location_name="Pondy Bazaar", latitude=13.0473, longitude=80.2406, fill_level=65, status="half-full"),
            BinCreate(location_name="Valluvar Kottam", latitude=13.0477, longitude=80.2409, fill_level=25, status="empty"),
            BinCreate(location_name="Mylapore Temple", latitude=13.0339, longitude=80.2675, fill_level=72, status="half-full"),
            BinCreate(location_name="Adyar Depot", latitude=13.0067, longitude=80.2570, fill_level=94, status="critical"),
            BinCreate(location_name="Guindy Park", latitude=13.0067, longitude=80.2206, fill_level=42, status="half-full"),
            BinCreate(location_name="Porur Junction", latitude=13.0358, longitude=80.1564, fill_level=81, status="full"),
            BinCreate(location_name="Tambaram East", latitude=12.9249, longitude=80.1000, fill_level=68, status="half-full"),
            BinCreate(location_name="Velachery Bus Stand", latitude=12.9750, longitude=80.2167, fill_level=90, status="full"),
            BinCreate(location_name="OMR Toll Plaza", latitude=12.8406, longitude=80.2270, fill_level=35, status="empty"),
            BinCreate(location_name="Coimbatore RS Puram", latitude=11.0168, longitude=76.9558, fill_level=76, status="full"),
            BinCreate(location_name="Coimbatore Gandhipuram", latitude=11.0185, longitude=76.9674, fill_level=58, status="half-full"),
            BinCreate(location_name="Madurai Meenakshi Temple", latitude=9.9195, longitude=78.1193, fill_level=85, status="full"),
            BinCreate(location_name="Trichy Rock Fort", latitude=10.8256, longitude=78.6867, fill_level=48, status="half-full"),
            BinCreate(location_name="Salem Steel Plant", latitude=11.6643, longitude=78.1460, fill_level=62, status="half-full"),
            BinCreate(location_name="Tirunelveli Town", latitude=8.7139, longitude=77.7567, fill_level=71, status="half-full"),
            BinCreate(location_name="Vellore Fort", latitude=12.9165, longitude=79.1325, fill_level=39, status="empty"),
            # New York bins (keeping original)
            BinCreate(location_name="Main Street Plaza NYC", latitude=40.7580, longitude=-73.9855, fill_level=85, status="full"),
            BinCreate(location_name="Central Park South", latitude=40.7678, longitude=-73.9812, fill_level=45, status="half-full"),
            BinCreate(location_name="Times Square", latitude=40.7589, longitude=-73.9851, fill_level=95, status="critical"),
            BinCreate(location_name="Columbus Circle", latitude=40.7681, longitude=-73.9819, fill_level=30, status="empty"),
            BinCreate(location_name="Bryant Park", latitude=40.7536, longitude=-73.9832, fill_level=70, status="half-full"),
            BinCreate(location_name="Grand Central", latitude=40.7527, longitude=-73.9772, fill_level=88, status="full"),
        ]
        for bin_data in demo_bins:
            bin_obj = Bin(**bin_data.model_dump())
            doc = bin_obj.model_dump()
            doc['last_updated'] = doc['last_updated'].isoformat()
            await db.bins.insert_one(doc)
    
    # Create demo drivers if collection is empty
    driver_count = await db.drivers.count_documents({})
    if driver_count == 0:
        from routes.drivers import Driver, Location
        demo_drivers = [
            {
                "name": "Ravi Kumar",
                "email": "ravi@example.com",
                "phone": "+91-9876543210",
                "current_location": {"lat": 13.0827, "lng": 80.2707},
                "availability": "available"
            },
            {
                "name": "Priya Sharma",
                "email": "priya@example.com",
                "phone": "+91-9876543211",
                "current_location": {"lat": 13.0500, "lng": 80.2500},
                "availability": "available"
            },
            {
                "name": "Arun Singh",
                "email": "arun@example.com",
                "phone": "+91-9876543212",
                "current_location": {"lat": 13.1000, "lng": 80.3000},
                "availability": "off-duty"
            }
        ]
        for driver_data in demo_drivers:
            driver_obj = Driver(**driver_data)
            doc = driver_obj.model_dump()
            doc['created_at'] = doc['created_at'].isoformat()
            await db.drivers.insert_one(doc)

# Auth endpoints
@api_router.post("/auth/login", response_model=UserResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"username": credentials.username}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(credentials.password, user['password']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    return UserResponse(id=user['id'], username=user['username'], role=user['role'], name=user['name'])

# Bin endpoints
@api_router.get("/bins", response_model=List[Bin])
async def get_bins():
    bins = await db.bins.find({}, {"_id": 0}).to_list(1000)
    for bin_item in bins:
        if isinstance(bin_item['last_updated'], str):
            bin_item['last_updated'] = datetime.fromisoformat(bin_item['last_updated'])
    return bins

@api_router.post("/bins", response_model=Bin)
async def create_bin(bin_data: BinCreate):
    bin_obj = Bin(**bin_data.model_dump())
    doc = bin_obj.model_dump()
    doc['last_updated'] = doc['last_updated'].isoformat()
    await db.bins.insert_one(doc)
    return bin_obj

@api_router.put("/bins/{bin_id}", response_model=Bin)
async def update_bin(bin_id: str, bin_update: BinUpdate):
    existing_bin = await db.bins.find_one({"id": bin_id}, {"_id": 0})
    if not existing_bin:
        raise HTTPException(status_code=404, detail="Bin not found")
    
    update_data = {k: v for k, v in bin_update.model_dump().items() if v is not None}
    update_data['last_updated'] = datetime.now(timezone.utc).isoformat()
    
    await db.bins.update_one({"id": bin_id}, {"$set": update_data})
    
    updated_bin = await db.bins.find_one({"id": bin_id}, {"_id": 0})
    if isinstance(updated_bin['last_updated'], str):
        updated_bin['last_updated'] = datetime.fromisoformat(updated_bin['last_updated'])
    return Bin(**updated_bin)

@api_router.delete("/bins/{bin_id}")
async def delete_bin(bin_id: str):
    result = await db.bins.delete_one({"id": bin_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bin not found")
    return {"message": "Bin deleted successfully"}

# Route endpoints
@api_router.post("/routes/optimize")
async def optimize_route(route_data: RouteOptimize):
    # Get bins
    bins = []
    for bin_id in route_data.bin_ids:
        bin_doc = await db.bins.find_one({"id": bin_id}, {"_id": 0})
        if bin_doc:
            bins.append(bin_doc)
    
    if not bins:
        return {"optimized_order": [], "total_distance": 0}
    
    # Simple nearest neighbor algorithm for route optimization
    current_lat, current_lng = route_data.start_lat, route_data.start_lng
    optimized_order = []
    remaining_bins = bins.copy()
    total_distance = 0
    
    while remaining_bins:
        # Find nearest bin
        nearest_bin = None
        min_distance = float('inf')
        
        for bin_item in remaining_bins:
            distance = math.sqrt(
                (bin_item['latitude'] - current_lat) ** 2 + 
                (bin_item['longitude'] - current_lng) ** 2
            )
            if distance < min_distance:
                min_distance = distance
                nearest_bin = bin_item
        
        if nearest_bin:
            optimized_order.append(nearest_bin['id'])
            total_distance += min_distance * 111  # Rough km conversion
            current_lat = nearest_bin['latitude']
            current_lng = nearest_bin['longitude']
            remaining_bins.remove(nearest_bin)
    
    return {"optimized_order": optimized_order, "total_distance": round(total_distance, 2)}

@api_router.post("/routes", response_model=Route)
async def create_route(route_data: RouteCreate):
    # Get driver info
    driver = await db.users.find_one({"id": route_data.driver_id}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    route_obj = Route(
        driver_id=route_data.driver_id,
        driver_name=driver['name'],
        bin_ids=route_data.bin_ids,
        status="pending"
    )
    doc = route_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.routes.insert_one(doc)
    return route_obj

@api_router.get("/routes/driver/{driver_id}", response_model=List[Route])
async def get_driver_routes(driver_id: str):
    routes = await db.routes.find({"driver_id": driver_id}, {"_id": 0}).to_list(1000)
    for route in routes:
        if isinstance(route['created_at'], str):
            route['created_at'] = datetime.fromisoformat(route['created_at'])
    return routes

@api_router.get("/routes", response_model=List[Route])
async def get_all_routes():
    routes = await db.routes.find({}, {"_id": 0}).to_list(1000)
    for route in routes:
        if isinstance(route['created_at'], str):
            route['created_at'] = datetime.fromisoformat(route['created_at'])
    return routes

@api_router.put("/routes/{route_id}/status")
async def update_route_status(route_id: str, status: str):
    result = await db.routes.update_one({"id": route_id}, {"$set": {"status": status}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Route not found")
    return {"message": "Route status updated"}

@api_router.get("/users/drivers", response_model=List[UserResponse])
async def get_drivers():
    drivers = await db.users.find({"role": "driver"}, {"_id": 0}).to_list(1000)
    return [UserResponse(id=d['id'], username=d['username'], role=d['role'], name=d['name']) for d in drivers]

# Import driver routes
from routes.drivers import router as drivers_router

# Include the router in the main app
app.include_router(api_router)

# Include driver management routes
app.include_router(drivers_router, prefix="/api/drivers", tags=["drivers"])

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()