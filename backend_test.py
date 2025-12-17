import requests
import sys
from datetime import datetime
import json

class LeadManagementAPITester:
    def __init__(self, base_url="https://salesforge-31.preview.emergentagent.com"):
        self.base_url = base_url
        self.session_token = "test_session_1765964700523"
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}" if not endpoint.startswith('/') else f"{self.base_url}{endpoint}"
        
        # Default headers with session token
        default_headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.session_token}'
        }
        if headers:
            default_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=default_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=default_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=default_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=default_headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, dict) and len(str(response_data)) < 500:
                        print(f"   Response: {response_data}")
                except:
                    pass
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Raw response: {response.text[:200]}")
                self.failed_tests.append({
                    "test": name,
                    "endpoint": endpoint,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "error": response.text[:200]
                })

            return success, response.json() if response.content else {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                "test": name,
                "endpoint": endpoint,
                "expected": expected_status,
                "actual": "Exception",
                "error": str(e)
            })
            return False, {}

    def test_health_endpoints(self):
        """Test basic health endpoints"""
        print("\n=== HEALTH CHECK TESTS ===")
        
        # Test root health endpoint
        self.run_test("Backend Health Check", "GET", "", 200)
        self.run_test("Health Endpoint", "GET", "health", 200)

    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        print("\n=== AUTHENTICATION TESTS ===")
        
        # Test /me endpoint with session token
        self.run_test("Get Current User", "GET", "auth/me", 200)
        
        # Test logout
        self.run_test("Logout", "POST", "auth/logout", 200)

    def test_kpi_endpoints(self):
        """Test KPI endpoints"""
        print("\n=== KPI TESTS ===")
        
        self.run_test("Get KPIs", "GET", "kpis", 200)

    def test_leads_endpoints(self):
        """Test leads endpoints"""
        print("\n=== LEADS TESTS ===")
        
        # Test get leads with pagination
        self.run_test("Get Leads", "GET", "leads?page=1&limit=10", 200)
        
        # Test get leads with filters
        self.run_test("Get Leads with State Filter", "GET", "leads?state=Maharashtra&page=1&limit=5", 200)

    def test_filter_endpoints(self):
        """Test filter endpoints"""
        print("\n=== FILTER TESTS ===")
        
        self.run_test("Get States", "GET", "filters/states", 200)
        self.run_test("Get Segments", "GET", "filters/segments", 200)
        self.run_test("Get Dealers", "GET", "filters/dealers", 200)
        self.run_test("Get Employees", "GET", "filters/employees", 200)

    def test_insights_endpoints(self):
        """Test insights endpoints"""
        print("\n=== INSIGHTS TESTS ===")
        
        self.run_test("Get Top Performers", "GET", "insights/top-performers", 200)
        self.run_test("Get Segment Analysis", "GET", "insights/segment-analysis", 200)

    def test_admin_endpoints(self):
        """Test admin endpoints (Admin role required)"""
        print("\n=== ADMIN TESTS ===")
        
        self.run_test("Get Users (Admin)", "GET", "admin/users", 200)
        self.run_test("Get Admin Stats", "GET", "admin/stats", 200)

    def test_without_auth(self):
        """Test endpoints without authentication"""
        print("\n=== UNAUTHENTICATED TESTS ===")
        
        # Test without session token
        url = f"{self.base_url}/api/auth/me"
        headers = {'Content-Type': 'application/json'}
        
        self.tests_run += 1
        print(f"\n🔍 Testing Auth Required...")
        
        try:
            response = requests.get(url, headers=headers, timeout=10)
            success = response.status_code == 401
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Correctly returned 401 for unauthenticated request")
            else:
                print(f"❌ Failed - Expected 401, got {response.status_code}")
                self.failed_tests.append({
                    "test": "Unauthenticated Access",
                    "endpoint": "auth/me",
                    "expected": 401,
                    "actual": response.status_code,
                    "error": "Should require authentication"
                })
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")

def main():
    print("🚀 Starting Lead Management Dashboard API Tests")
    print(f"⏰ Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    tester = LeadManagementAPITester()
    
    # Run all test suites (logout test moved to end)
    tester.test_health_endpoints()
    tester.test_without_auth()
    
    # Test authenticated endpoints first
    tester.test_auth_me_endpoint()
    tester.test_kpi_endpoints()
    tester.test_leads_endpoints()
    tester.test_filter_endpoints()
    tester.test_insights_endpoints()
    tester.test_admin_endpoints()
    
    # Test logout last (invalidates session)
    tester.test_logout_endpoint()
    
    # Print final results
    print(f"\n{'='*50}")
    print(f"📊 FINAL RESULTS")
    print(f"{'='*50}")
    print(f"Tests Run: {tester.tests_run}")
    print(f"Tests Passed: {tester.tests_passed}")
    print(f"Tests Failed: {len(tester.failed_tests)}")
    print(f"Success Rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")
    
    if tester.failed_tests:
        print(f"\n❌ FAILED TESTS:")
        for i, test in enumerate(tester.failed_tests, 1):
            print(f"{i}. {test['test']}")
            print(f"   Endpoint: {test['endpoint']}")
            print(f"   Expected: {test['expected']}, Got: {test['actual']}")
            print(f"   Error: {test['error']}")
    
    return 0 if len(tester.failed_tests) == 0 else 1

if __name__ == "__main__":
    sys.exit(main())