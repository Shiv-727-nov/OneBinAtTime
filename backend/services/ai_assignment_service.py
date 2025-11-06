import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
import math
from datetime import datetime, timezone
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'waste_management')]

class AIAssignmentService:
    """AI-powered automatic worker assignment service"""
    
    @staticmethod
    def calculate_distance(lat1, lon1, lat2, lon2):
        """Calculate distance between two points using Haversine formula (in km)"""
        R = 6371  # Earth's radius in km
        
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)
        
        a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        
        return R * c
    
    @staticmethod
    async def get_critical_bins():
        """Get bins that need immediate attention (>= 85% full)"""
        bins = await db.bins.find({
            "$or": [
                {"fill_level": {"$gte": 85}},
                {"status": "critical"}
            ]
        }, {"_id": 0}).to_list(1000)
        return bins
    
    @staticmethod
    async def get_full_bins():
        """Get bins that are full (>= 70% full)"""
        bins = await db.bins.find({
            "$or": [
                {"fill_level": {"$gte": 70}},
                {"status": {"$in": ["full", "critical"]}}
            ]
        }, {"_id": 0}).to_list(1000)
        return bins
    
    @staticmethod
    async def get_available_drivers():
        """Get drivers that are available for assignment"""
        drivers = await db.drivers.find({
            "availability": "available"
        }, {"_id": 0}).to_list(1000)
        return drivers
    
    @staticmethod
    def calculate_assignment_score(driver, bin_data):
        """
        Calculate assignment score based on multiple factors:
        - Proximity (40%): Distance between driver and bin
        - Workload (30%): Current workload of driver
        - Priority (20%): Urgency of bin
        - Performance (10%): Historical performance
        """
        # Proximity score (closer is better)
        distance = AIAssignmentService.calculate_distance(
            driver['current_location']['lat'],
            driver['current_location']['lng'],
            bin_data['latitude'],
            bin_data['longitude']
        )
        proximity_score = max(0, 100 - (distance * 10))  # Penalize by 10 points per km
        
        # Workload score (less work is better)
        current_workload = driver.get('current_route_id', None)
        workload_score = 0 if current_workload else 100
        
        # Priority score (based on bin fill level)
        fill_level = bin_data.get('fill_level', 0)
        if fill_level >= 90:
            priority_score = 100
        elif fill_level >= 80:
            priority_score = 80
        elif fill_level >= 70:
            priority_score = 60
        else:
            priority_score = 40
        
        # Performance score (based on completion rate)
        total_completed = driver.get('total_routes_completed', 0)
        performance_score = min(100, total_completed * 10)  # 10 points per completed route, max 100
        
        # Weighted final score
        final_score = (
            proximity_score * 0.4 +
            workload_score * 0.3 +
            priority_score * 0.2 +
            performance_score * 0.1
        )
        
        return {
            'score': final_score,
            'distance_km': round(distance, 2),
            'proximity_score': round(proximity_score, 1),
            'workload_score': round(workload_score, 1),
            'priority_score': round(priority_score, 1),
            'performance_score': round(performance_score, 1)
        }
    
    @staticmethod
    async def find_optimal_driver(bin_data):
        """Find the best driver for a specific bin"""
        drivers = await AIAssignmentService.get_available_drivers()
        
        if not drivers:
            logger.warning("No available drivers found")
            return None
        
        best_driver = None
        best_score_data = None
        best_score = -1
        
        for driver in drivers:
            score_data = AIAssignmentService.calculate_assignment_score(driver, bin_data)
            if score_data['score'] > best_score:
                best_score = score_data['score']
                best_driver = driver
                best_score_data = score_data
        
        return {
            'driver': best_driver,
            'score_data': best_score_data
        }
    
    @staticmethod
    def generate_reasoning(driver, bin_data, score_data):
        """Generate human-readable reasoning for the assignment"""
        reasoning = f"Assigned {driver['name']} to bin at {bin_data['location_name']} because: "
        reasoning += f"closest available driver ({score_data['distance_km']} km away), "
        reasoning += f"available for assignment, "
        reasoning += f"bin priority level {score_data['priority_score']}/100, "
        reasoning += f"driver has completed {driver.get('total_routes_completed', 0)} routes"
        
        return reasoning
    
    @staticmethod
    async def group_nearby_bins(bins, radius_km=5.0):
        """Group bins that are within a certain radius of each other"""
        if not bins:
            return []
        
        groups = []
        remaining_bins = bins.copy()
        
        while remaining_bins:
            # Start a new group with the first remaining bin
            anchor_bin = remaining_bins.pop(0)
            current_group = [anchor_bin]
            
            # Find nearby bins
            bins_to_remove = []
            for i, bin_data in enumerate(remaining_bins):
                distance = AIAssignmentService.calculate_distance(
                    anchor_bin['latitude'],
                    anchor_bin['longitude'],
                    bin_data['latitude'],
                    bin_data['longitude']
                )
                if distance <= radius_km:
                    current_group.append(bin_data)
                    bins_to_remove.append(i)
            
            # Remove bins that were added to the group
            for i in reversed(bins_to_remove):
                remaining_bins.pop(i)
            
            groups.append(current_group)
        
        return groups
    
    @staticmethod
    async def auto_assign_critical_bins():
        """Main function to automatically assign critical bins to drivers"""
        logger.info("Starting automatic assignment check...")
        
        # Get critical bins
        critical_bins = await AIAssignmentService.get_critical_bins()
        
        if not critical_bins:
            logger.info("No critical bins found")
            return []
        
        logger.info(f"Found {len(critical_bins)} critical bins")
        
        # Group nearby bins
        bin_groups = await AIAssignmentService.group_nearby_bins(critical_bins, radius_km=5.0)
        logger.info(f"Grouped into {len(bin_groups)} route groups")
        
        assignments = []
        
        for group in bin_groups:
            # Find optimal driver for this group
            result = await AIAssignmentService.find_optimal_driver(group[0])  # Use first bin as anchor
            
            if not result or not result['driver']:
                logger.warning(f"No driver available for group of {len(group)} bins")
                continue
            
            driver = result['driver']
            score_data = result['score_data']
            
            # Create route assignment via API (would call route-management endpoint)
            bin_ids = [bin_data['id'] for bin_data in group]
            reasoning = AIAssignmentService.generate_reasoning(driver, group[0], score_data)
            
            # Store assignment record
            assignment = {
                'assignment_id': f"ai-{datetime.now(timezone.utc).timestamp()}",
                'driver_id': driver['driver_id'],
                'driver_name': driver['name'],
                'bin_ids': bin_ids,
                'assigned_by': 'AI',
                'reasoning': reasoning,
                'confidence_score': int(score_data['score']),
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'admin_override': False,
                'status': 'pending'
            }
            
            await db.assignments.insert_one(assignment)
            assignments.append(assignment)
            
            logger.info(f"✅ Assigned {len(bin_ids)} bins to {driver['name']} (confidence: {int(score_data['score'])}%)")
        
        return assignments

# Run monitoring service
async def run_monitoring_service():
    """Run the AI monitoring service"""
    logger.info("AI Monitoring Service Started")
    
    while True:
        try:
            assignments = await AIAssignmentService.auto_assign_critical_bins()
            if assignments:
                logger.info(f"Completed {len(assignments)} automatic assignments")
        except Exception as e:
            logger.error(f"Error in monitoring service: {str(e)}")
        
        # Wait 5 minutes before next check
        await asyncio.sleep(300)

if __name__ == "__main__":
    asyncio.run(run_monitoring_service())
