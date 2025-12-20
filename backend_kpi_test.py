import requests
import sys
from datetime import datetime
import json

class KPIMetricsEnhancementTester:
    def __init__(self, base_url="https://lead-tracker-66.preview.emergentagent.com"):
        self.base_url = base_url
        self.session_token = None
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
                    return success, response_data
                except:
                    return success, {}
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

    def test_login(self):
        """Test login and get session token"""
        print("\n=== LOGIN TEST ===")
        
        # Test login
        login_data = {"username": "admin", "password": "admin123"}
        success, response = self.run_test("Login", "POST", "auth/login", 200, login_data)
        
        if success and "token" in response:
            self.session_token = response["token"]
            print(f"✅ Session token obtained: {self.session_token[:20]}...")
            return True
        else:
            print("❌ Failed to get session token")
            return False

    def test_kpi_new_metrics(self):
        """Test KPI endpoints for new metrics: avg_lead_age, avg_closure_time, conversion_rate"""
        print("\n=== NEW KPI METRICS TESTS ===")
        
        success, response = self.run_test("Get KPIs with New Metrics", "GET", "kpis", 200)
        
        if success:
            # Check for new metrics
            required_fields = ['avg_lead_age', 'avg_closure_time', 'conversion_rate']
            missing_fields = []
            
            for field in required_fields:
                if field not in response:
                    missing_fields.append(field)
                else:
                    value = response[field]
                    print(f"   ✅ {field}: {value}")
            
            if missing_fields:
                print(f"   ❌ Missing fields: {missing_fields}")
                self.failed_tests.append({
                    "test": "KPI New Metrics Check",
                    "endpoint": "kpis",
                    "expected": "All new metrics present",
                    "actual": f"Missing: {missing_fields}",
                    "error": f"Required fields not found: {missing_fields}"
                })
                return False
            else:
                print(f"   ✅ All new KPI metrics are present")
                return True
        
        return False

    def test_metric_settings_endpoints(self):
        """Test metric settings endpoints"""
        print("\n=== METRIC SETTINGS TESTS ===")
        
        # Test get metric settings
        success, response = self.run_test("Get Metric Settings", "GET", "metric-settings", 200)
        
        if success:
            metrics = response.get('metrics', [])
            available_fields = response.get('available_fields', {})
            field_counts = response.get('field_counts', {})
            
            print(f"   ✅ Found {len(metrics)} metrics")
            print(f"   ✅ Available fields: {list(available_fields.keys())}")
            
            # Check for new metrics in the list
            new_metrics = ['avg_lead_age', 'avg_closure_time', 'conversion_rate']
            found_new_metrics = []
            
            for metric in metrics:
                if metric.get('metric_id') in new_metrics:
                    found_new_metrics.append(metric.get('metric_id'))
                    print(f"   ✅ Found new metric: {metric.get('metric_name')} ({metric.get('metric_id')})")
                    print(f"      Type: {metric.get('metric_type', 'count')}")
                    print(f"      Unit: {metric.get('unit', 'N/A')}")
                    
                    # Check conversion rate formula fields
                    if metric.get('metric_id') == 'conversion_rate':
                        if metric.get('numerator_metric') and metric.get('denominator_metric'):
                            print(f"      Formula: {metric.get('numerator_metric')} / {metric.get('denominator_metric')}")
                        else:
                            print(f"      ⚠️ Formula fields missing")
            
            missing_new_metrics = [m for m in new_metrics if m not in found_new_metrics]
            if missing_new_metrics:
                print(f"   ❌ Missing new metrics: {missing_new_metrics}")
                return False
            else:
                print(f"   ✅ All new metrics found in settings")
                return True
        
        return False

    def test_conversion_rate_formula_update(self):
        """Test updating conversion rate formula"""
        print("\n=== CONVERSION RATE FORMULA UPDATE TEST ===")
        
        # Test updating conversion rate numerator
        update_data = {"numerator_metric": "won_leads"}
        success, response = self.run_test(
            "Update Conversion Rate Numerator", 
            "PUT", 
            "metric-settings/conversion_rate", 
            200, 
            update_data
        )
        
        if success:
            print(f"   ✅ Numerator updated to: {response.get('numerator_metric')}")
        
        # Test updating conversion rate denominator
        update_data = {"denominator_metric": "won_leads+lost_leads"}
        success2, response2 = self.run_test(
            "Update Conversion Rate Denominator", 
            "PUT", 
            "metric-settings/conversion_rate", 
            200, 
            update_data
        )
        
        if success2:
            print(f"   ✅ Denominator updated to: {response2.get('denominator_metric')}")
        
        return success and success2

    def test_metric_types_and_badges(self):
        """Test that metrics have proper type badges (count, formula, calculated)"""
        print("\n=== METRIC TYPES AND BADGES TEST ===")
        
        success, response = self.run_test("Get Metric Settings for Types", "GET", "metric-settings", 200)
        
        if success:
            metrics = response.get('metrics', [])
            
            # Expected metric types
            expected_types = {
                'avg_lead_age': 'calculated',
                'avg_closure_time': 'calculated', 
                'conversion_rate': 'formula',
                'won_leads': 'count',
                'lost_leads': 'count',
                'open_leads': 'count'
            }
            
            type_check_passed = True
            
            for metric in metrics:
                metric_id = metric.get('metric_id')
                metric_type = metric.get('metric_type', 'count')
                
                if metric_id in expected_types:
                    expected_type = expected_types[metric_id]
                    if metric_type == expected_type:
                        print(f"   ✅ {metric_id}: {metric_type} (correct)")
                    else:
                        print(f"   ❌ {metric_id}: {metric_type} (expected {expected_type})")
                        type_check_passed = False
            
            return type_check_passed
        
        return False

def main():
    print("🚀 Starting KPI Metrics Enhancement Tests")
    print(f"⏰ Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    tester = KPIMetricsEnhancementTester()
    
    # Login first to get session token
    if not tester.test_login():
        print("❌ Login failed, cannot proceed with authenticated tests")
        return 1
    
    # Run KPI enhancement tests
    all_tests_passed = True
    
    # Test 1: Check new KPI metrics in API response
    if not tester.test_kpi_new_metrics():
        all_tests_passed = False
    
    # Test 2: Check metric settings endpoints
    if not tester.test_metric_settings_endpoints():
        all_tests_passed = False
    
    # Test 3: Test conversion rate formula update
    if not tester.test_conversion_rate_formula_update():
        all_tests_passed = False
    
    # Test 4: Test metric types and badges
    if not tester.test_metric_types_and_badges():
        all_tests_passed = False
    
    # Print final results
    print(f"\n{'='*50}")
    print(f"📊 KPI ENHANCEMENT TEST RESULTS")
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
    
    return 0 if all_tests_passed else 1

if __name__ == "__main__":
    sys.exit(main())