import requests
import sys
import json
from datetime import datetime

class WasteManagementAPITester:
    def __init__(self, base_url="https://smart-waste-mgmt-7.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.admin_user = None
        self.driver_user = None
        self.test_bin_id = None
        self.test_route_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
            self.failed_tests.append({"test": name, "details": details})

    def test_auth_login_admin(self):
        """Test admin login"""
        try:
            response = requests.post(f"{self.api_url}/auth/login", json={
                "username": "admin",
                "password": "admin123"
            })
            
            if response.status_code == 200:
                data = response.json()
                if data.get('role') == 'admin' and data.get('username') == 'admin':
                    self.admin_user = data
                    self.log_test("Admin Login", True)
                    return True
                else:
                    self.log_test("Admin Login", False, f"Invalid response data: {data}")
            else:
                self.log_test("Admin Login", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("Admin Login", False, f"Exception: {str(e)}")
        return False

    def test_auth_login_driver(self):
        """Test driver login"""
        try:
            response = requests.post(f"{self.api_url}/auth/login", json={
                "username": "driver",
                "password": "driver123"
            })
            
            if response.status_code == 200:
                data = response.json()
                if data.get('role') == 'driver' and data.get('username') == 'driver':
                    self.driver_user = data
                    self.log_test("Driver Login", True)
                    return True
                else:
                    self.log_test("Driver Login", False, f"Invalid response data: {data}")
            else:
                self.log_test("Driver Login", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("Driver Login", False, f"Exception: {str(e)}")
        return False

    def test_auth_invalid_credentials(self):
        """Test login with invalid credentials"""
        try:
            response = requests.post(f"{self.api_url}/auth/login", json={
                "username": "invalid",
                "password": "invalid"
            })
            
            if response.status_code == 401:
                self.log_test("Invalid Credentials Rejection", True)
                return True
            else:
                self.log_test("Invalid Credentials Rejection", False, f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_test("Invalid Credentials Rejection", False, f"Exception: {str(e)}")
        return False

    def test_get_bins(self):
        """Test getting all bins"""
        try:
            response = requests.get(f"{self.api_url}/bins")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list) and len(data) > 0:
                    # Check if demo bins exist
                    demo_locations = ["Main Street Plaza", "Central Park South", "Times Square"]
                    found_demo = any(bin_item.get('location_name') in demo_locations for bin_item in data)
                    if found_demo:
                        self.log_test("Get Bins", True)
                        return True
                    else:
                        self.log_test("Get Bins", False, "No demo bins found")
                else:
                    self.log_test("Get Bins", False, f"Invalid response: {data}")
            else:
                self.log_test("Get Bins", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("Get Bins", False, f"Exception: {str(e)}")
        return False

    def test_create_bin(self):
        """Test creating a new bin"""
        try:
            test_bin = {
                "location_name": f"Test Bin {datetime.now().strftime('%H%M%S')}",
                "latitude": 40.7500,
                "longitude": -73.9800,
                "fill_level": 25,
                "status": "empty"
            }
            
            response = requests.post(f"{self.api_url}/bins", json=test_bin)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('location_name') == test_bin['location_name']:
                    self.test_bin_id = data.get('id')
                    self.log_test("Create Bin", True)
                    return True
                else:
                    self.log_test("Create Bin", False, f"Invalid response data: {data}")
            else:
                self.log_test("Create Bin", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("Create Bin", False, f"Exception: {str(e)}")
        return False

    def test_update_bin(self):
        """Test updating a bin"""
        if not self.test_bin_id:
            self.log_test("Update Bin", False, "No test bin ID available")
            return False
            
        try:
            update_data = {
                "fill_level": 75,
                "status": "full"
            }
            
            response = requests.put(f"{self.api_url}/bins/{self.test_bin_id}", json=update_data)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('fill_level') == 75 and data.get('status') == 'full':
                    self.log_test("Update Bin", True)
                    return True
                else:
                    self.log_test("Update Bin", False, f"Update not reflected: {data}")
            else:
                self.log_test("Update Bin", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("Update Bin", False, f"Exception: {str(e)}")
        return False

    def test_get_drivers(self):
        """Test getting all drivers"""
        try:
            response = requests.get(f"{self.api_url}/users/drivers")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list) and len(data) > 0:
                    # Check if demo driver exists
                    demo_driver = any(driver.get('username') == 'driver' for driver in data)
                    if demo_driver:
                        self.log_test("Get Drivers", True)
                        return True
                    else:
                        self.log_test("Get Drivers", False, "Demo driver not found")
                else:
                    self.log_test("Get Drivers", False, f"Invalid response: {data}")
            else:
                self.log_test("Get Drivers", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("Get Drivers", False, f"Exception: {str(e)}")
        return False

    def test_route_optimization(self):
        """Test route optimization"""
        try:
            # Get some bins first
            bins_response = requests.get(f"{self.api_url}/bins")
            if bins_response.status_code != 200:
                self.log_test("Route Optimization", False, "Could not get bins for optimization")
                return False
                
            bins = bins_response.json()
            if len(bins) < 2:
                self.log_test("Route Optimization", False, "Not enough bins for optimization")
                return False
                
            # Use first 3 bins for optimization
            bin_ids = [bin['id'] for bin in bins[:3]]
            first_bin = bins[0]
            
            optimize_data = {
                "start_lat": first_bin['latitude'],
                "start_lng": first_bin['longitude'],
                "bin_ids": bin_ids
            }
            
            response = requests.post(f"{self.api_url}/routes/optimize", json=optimize_data)
            
            if response.status_code == 200:
                data = response.json()
                if 'optimized_order' in data and 'total_distance' in data:
                    if len(data['optimized_order']) == len(bin_ids):
                        self.log_test("Route Optimization", True)
                        return True
                    else:
                        self.log_test("Route Optimization", False, f"Order length mismatch: {data}")
                else:
                    self.log_test("Route Optimization", False, f"Missing required fields: {data}")
            else:
                self.log_test("Route Optimization", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("Route Optimization", False, f"Exception: {str(e)}")
        return False

    def test_create_route(self):
        """Test creating a route assignment"""
        if not self.driver_user:
            self.log_test("Create Route", False, "No driver user available")
            return False
            
        try:
            # Get some bins first
            bins_response = requests.get(f"{self.api_url}/bins")
            if bins_response.status_code != 200:
                self.log_test("Create Route", False, "Could not get bins for route creation")
                return False
                
            bins = bins_response.json()
            if len(bins) < 2:
                self.log_test("Create Route", False, "Not enough bins for route creation")
                return False
                
            # Use first 2 bins for route
            bin_ids = [bin['id'] for bin in bins[:2]]
            
            route_data = {
                "driver_id": self.driver_user['id'],
                "bin_ids": bin_ids
            }
            
            response = requests.post(f"{self.api_url}/routes", json=route_data)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('driver_id') == self.driver_user['id'] and data.get('status') == 'pending':
                    self.test_route_id = data.get('id')
                    self.log_test("Create Route", True)
                    return True
                else:
                    self.log_test("Create Route", False, f"Invalid route data: {data}")
            else:
                self.log_test("Create Route", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("Create Route", False, f"Exception: {str(e)}")
        return False

    def test_get_driver_routes(self):
        """Test getting routes for a specific driver"""
        if not self.driver_user:
            self.log_test("Get Driver Routes", False, "No driver user available")
            return False
            
        try:
            response = requests.get(f"{self.api_url}/routes/driver/{self.driver_user['id']}")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("Get Driver Routes", True)
                    return True
                else:
                    self.log_test("Get Driver Routes", False, f"Invalid response: {data}")
            else:
                self.log_test("Get Driver Routes", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("Get Driver Routes", False, f"Exception: {str(e)}")
        return False

    def test_update_route_status(self):
        """Test updating route status"""
        if not self.test_route_id:
            self.log_test("Update Route Status", False, "No test route ID available")
            return False
            
        try:
            response = requests.put(f"{self.api_url}/routes/{self.test_route_id}/status?status=in-progress")
            
            if response.status_code == 200:
                self.log_test("Update Route Status", True)
                return True
            else:
                self.log_test("Update Route Status", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("Update Route Status", False, f"Exception: {str(e)}")
        return False

    def test_get_all_routes(self):
        """Test getting all routes"""
        try:
            response = requests.get(f"{self.api_url}/routes")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("Get All Routes", True)
                    return True
                else:
                    self.log_test("Get All Routes", False, f"Invalid response: {data}")
            else:
                self.log_test("Get All Routes", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("Get All Routes", False, f"Exception: {str(e)}")
        return False

    def test_delete_bin(self):
        """Test deleting a bin"""
        if not self.test_bin_id:
            self.log_test("Delete Bin", False, "No test bin ID available")
            return False
            
        try:
            response = requests.delete(f"{self.api_url}/bins/{self.test_bin_id}")
            
            if response.status_code == 200:
                self.log_test("Delete Bin", True)
                return True
            else:
                self.log_test("Delete Bin", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("Delete Bin", False, f"Exception: {str(e)}")
        return False

    def run_all_tests(self):
        """Run all backend API tests"""
        print("🚀 Starting Waste Management API Tests...")
        print(f"Testing against: {self.base_url}")
        print("=" * 50)
        
        # Authentication tests
        print("\n📝 Authentication Tests:")
        self.test_auth_login_admin()
        self.test_auth_login_driver()
        self.test_auth_invalid_credentials()
        
        # Bin management tests
        print("\n🗑️ Bin Management Tests:")
        self.test_get_bins()
        self.test_create_bin()
        self.test_update_bin()
        
        # Driver and route tests
        print("\n🚛 Route Management Tests:")
        self.test_get_drivers()
        self.test_route_optimization()
        self.test_create_route()
        self.test_get_driver_routes()
        self.test_update_route_status()
        self.test_get_all_routes()
        
        # Cleanup tests
        print("\n🧹 Cleanup Tests:")
        self.test_delete_bin()
        
        # Summary
        print("\n" + "=" * 50)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.failed_tests:
            print("\n❌ Failed Tests:")
            for failed in self.failed_tests:
                print(f"  - {failed['test']}: {failed['details']}")
        
        success_rate = (self.tests_passed / self.tests_run) * 100 if self.tests_run > 0 else 0
        print(f"✨ Success Rate: {success_rate:.1f}%")
        
        return self.tests_passed == self.tests_run

def main():
    tester = WasteManagementAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())