import requests
import sys
from datetime import datetime
import json

class LeadManagementAPITester:
    def __init__(self, base_url="https://lead-tracker-66.preview.emergentagent.com"):
        self.base_url = base_url
        self.session_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.created_metrics = []  # Track created metrics for cleanup

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

    def test_auth_me_endpoint(self):
        """Test /me endpoint"""
        print("\n=== AUTHENTICATION TESTS ===")
        
        # Test /me endpoint with session token
        self.run_test("Get Current User", "GET", "auth/me", 200)
    
    def test_logout_endpoint(self):
        """Test logout endpoint (run last as it invalidates session)"""
        print("\n=== LOGOUT TEST ===")
        
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
        
        # Test NEW FEATURE: dropdown options endpoint
        self.run_test("Get Dropdown Options", "GET", "leads/dropdown-options", 200)
        
        # Test NEW FEATURE: export leads to Excel
        self.run_test("Export Leads to Excel", "GET", "leads/export?format=xlsx", 200)
        
        # Test NEW FEATURE: download template
        self.run_test("Download Lead Template", "GET", "leads/template", 200)

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
        
        # Test NEW FEATURE: open leads metric for charts
        self.run_test("Get Top Performers - Open Leads", "GET", "insights/top-performers?metric=open", 200)
        self.run_test("Get Monthly Trends", "GET", "insights/monthly-trends?months=12", 200)

    def test_qualification_endpoints(self):
        """Test qualification system endpoints"""
        print("\n=== QUALIFICATION SYSTEM TESTS ===")
        
        # Test get qualification questions
        self.run_test("Get Qualification Questions", "GET", "qualification/questions", 200)
        
        # Test get qualification settings
        self.run_test("Get Qualification Settings", "GET", "qualification/settings", 200)
        
        # Test create qualification question (Admin only)
        question_data = {
            "question": "Is the budget confirmed?",
            "description": "Test question for qualification",
            "options": [
                {"text": "Yes, confirmed", "score": 10},
                {"text": "Partially confirmed", "score": 5},
                {"text": "Not confirmed", "score": 0}
            ],
            "is_required": True,
            "order": 1
        }
        success, response = self.run_test("Create Qualification Question", "POST", "qualification/questions", 200, question_data)
        
        # Store question ID for later tests
        question_id = response.get("question_id") if success else None
        
        # Test update qualification settings (Admin only)
        settings_data = {"threshold_score": 15}
        self.run_test("Update Qualification Settings", "PUT", "qualification/settings", 200, settings_data)
        
        # Test qualify a lead (need to get a lead first)
        success, leads_response = self.run_test("Get Leads for Qualification", "GET", "leads?limit=1", 200)
        if success and leads_response.get("leads"):
            lead_id = leads_response["leads"][0]["lead_id"]
            
            # Test qualify lead endpoint
            if question_id:
                qualify_data = {
                    "answers": [
                        {"question_id": question_id, "option_id": "opt_1"}
                    ]
                }
                self.run_test("Qualify Lead", "POST", f"qualification/leads/{lead_id}/qualify", 200, qualify_data)
                
                # Test get lead qualification
                self.run_test("Get Lead Qualification", "GET", f"qualification/leads/{lead_id}/qualification", 200)
        
        # Clean up - delete test question
        if question_id:
            self.run_test("Delete Test Question", "DELETE", f"qualification/questions/{question_id}", 200)

    def test_lead_activity_endpoints(self):
        """Test lead activity endpoints"""
        print("\n=== LEAD ACTIVITY TESTS ===")
        
        # Get a lead first
        success, leads_response = self.run_test("Get Leads for Activity", "GET", "leads?limit=1", 200)
        if success and leads_response.get("leads"):
            lead_id = leads_response["leads"][0]["lead_id"]
            
            # Test get lead activities
            self.run_test("Get Lead Activities", "GET", f"lead-activities/{lead_id}", 200)
            
            # Test get lead followups
            self.run_test("Get Lead Followups", "GET", f"lead-activities/{lead_id}/followups", 200)
            
            # Test add followup
            followup_data = {
                "followup_date": "2025-01-20",
                "notes": "Test followup note",
                "outcome": "Interested"
            }
            self.run_test("Add Lead Followup", "POST", f"lead-activities/{lead_id}/followups", 200, followup_data)

    def test_kpi_qualification_metrics(self):
        """Test KPI endpoints for qualification metrics"""
        print("\n=== KPI QUALIFICATION METRICS TESTS ===")
        
        # Test KPIs to ensure qualified_leads and faulty_leads are returned
        success, response = self.run_test("Get KPIs with Qualification Metrics", "GET", "kpis", 200)
        if success:
            # Check if qualification metrics are present
            if "qualified_leads" in response and "faulty_leads" in response:
                print(f"✅ Qualification metrics found - Qualified: {response.get('qualified_leads', 0)}, Faulty: {response.get('faulty_leads', 0)}")
            else:
                print(f"⚠️  Warning: Qualification metrics not found in KPI response")

    def test_upload_endpoints(self):
        """Test upload endpoints specifically for Excel bulk upload"""
        print("\n=== UPLOAD TESTS ===")
        
        # Test get upload template
        self.run_test("Get Upload Template", "GET", "upload/template", 200)
        
        # Test upload Excel file
        import os
        test_file_path = "/app/backend/bulk_test_50.xlsx"
        
        if os.path.exists(test_file_path):
            print(f"\n🔍 Testing Excel Upload with file: {test_file_path}")
            
            # Use requests to upload file
            url = f"{self.base_url}/api/upload/leads"
            headers = {'Authorization': f'Bearer {self.session_token}'}
            
            try:
                with open(test_file_path, 'rb') as f:
                    files = {'file': ('bulk_test_50.xlsx', f, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
                    response = requests.post(url, files=files, headers=headers, timeout=30)
                
                self.tests_run += 1
                success = response.status_code == 200
                if success:
                    self.tests_passed += 1
                    print(f"✅ Passed - Excel Upload Status: {response.status_code}")
                    try:
                        response_data = response.json()
                        print(f"   Upload Result: Created: {response_data.get('created', 0)}, Updated: {response_data.get('updated', 0)}")
                        if response_data.get('total_errors', 0) > 0:
                            print(f"   Errors: {response_data.get('total_errors', 0)}")
                    except:
                        pass
                else:
                    print(f"❌ Failed - Expected 200, got {response.status_code}")
                    try:
                        error_data = response.json()
                        print(f"   Error: {error_data}")
                    except:
                        print(f"   Raw response: {response.text[:200]}")
                    self.failed_tests.append({
                        "test": "Excel Upload",
                        "endpoint": "upload/leads",
                        "expected": 200,
                        "actual": response.status_code,
                        "error": response.text[:200]
                    })
                    
            except Exception as e:
                print(f"❌ Failed - Error: {str(e)}")
                self.failed_tests.append({
                    "test": "Excel Upload",
                    "endpoint": "upload/leads",
                    "expected": 200,
                    "actual": "Exception",
                    "error": str(e)
                })
        else:
            print(f"⚠️  Test file not found: {test_file_path}")

    def test_notifications_endpoints(self):
        """Test notification endpoints for follow-up alerts"""
        print("\n=== NOTIFICATIONS TESTS ===")
        
        # Test get notifications summary (for badge count)
        self.run_test("Get Notification Summary", "GET", "notifications/summary", 200)
        
        # Test get full notifications list
        self.run_test("Get Notifications", "GET", "notifications", 200)
        
        # Test notifications with limit
        self.run_test("Get Notifications with Limit", "GET", "notifications?limit=5", 200)

    def test_entity_profile_endpoints(self):
        """Test Entity Profile endpoints for states, dealers, cities, employees"""
        print("\n=== ENTITY PROFILE TESTS ===")
        
        # Test entity search endpoint
        success, response = self.run_test("Search Entities - Jharkhand", "GET", "entity/search?q=jharkhand", 200)
        if success and response.get("results"):
            print(f"   ✓ Found {len(response['results'])} entities for 'jharkhand'")
            
            # Test with first entity found
            first_entity = response["results"][0]
            entity_type = first_entity["type"]
            entity_id = first_entity["id"]
            
            print(f"   Testing profile for {entity_type}: {entity_id}")
            
            # Test entity profile endpoint
            profile_success, profile_response = self.run_test(
                f"Get {entity_type.capitalize()} Profile", 
                "GET", 
                f"entity/profile/{entity_type}/{entity_id}", 
                200
            )
            
            if profile_success:
                # Verify profile structure
                required_keys = ["entity_type", "entity_id", "kpis", "stage_breakdown"]
                missing_keys = [key for key in required_keys if key not in profile_response]
                if not missing_keys:
                    print(f"   ✓ Profile structure complete")
                    
                    # Check KPIs
                    kpis = profile_response.get("kpis", {})
                    kpi_keys = ["total_leads", "open_leads", "won_leads", "conversion_rate"]
                    if all(key in kpis for key in kpi_keys):
                        print(f"   ✓ KPIs: Total={kpis['total_leads']}, Won={kpis['won_leads']}, Conv={kpis['conversion_rate']}%")
                    
                    # Check charts data
                    if profile_response.get("stage_breakdown"):
                        print(f"   ✓ Stage breakdown data available")
                    if profile_response.get("trend"):
                        print(f"   ✓ Trend data available")
                else:
                    print(f"   ⚠️  Missing profile keys: {missing_keys}")
            
            # Test recent leads endpoint
            self.run_test(
                f"Get Recent Leads for {entity_type.capitalize()}", 
                "GET", 
                f"entity/recent-leads/{entity_type}/{entity_id}?page=1&limit=5", 
                200
            )
            
            # Test export endpoint
            self.run_test(
                f"Export {entity_type.capitalize()} Data", 
                "GET", 
                f"entity/export/{entity_type}/{entity_id}", 
                200
            )
        else:
            print("   ⚠️  No entities found for search test")
        
        # Test search with different queries
        test_queries = ["maharashtra", "delhi", "employee"]
        for query in test_queries:
            success, response = self.run_test(
                f"Search Entities - {query.capitalize()}", 
                "GET", 
                f"entity/search?q={query}", 
                200
            )
            if success:
                result_count = len(response.get("results", []))
                print(f"   ✓ '{query}' search returned {result_count} results")

    def test_admin_endpoints(self):
        """Test admin endpoints (Admin role required)"""
        print("\n=== ADMIN TESTS ===")
        
        self.run_test("Get Users (Admin)", "GET", "admin/users", 200)
        self.run_test("Get Admin Stats", "GET", "admin/stats", 200)
        
        # Test new data-stats endpoint for Data Management tab
        self.run_test("Get Data Stats (Admin)", "GET", "admin/data-stats", 200)
        
        # Test closure questions endpoints
        self.run_test("Get Closure Questions", "GET", "admin/closure-questions", 200)
        
        # Test activity logs endpoint
        self.run_test("Get Activity Logs", "GET", "admin/activity-logs?page=1&limit=10", 200)

    def test_metric_settings_endpoints(self):
        """Test configurable metric settings endpoints"""
        print("\n=== METRIC SETTINGS TESTS ===")
        
        # Test get metric settings
        success, response = self.run_test("Get Metric Settings", "GET", "metric-settings", 200)
        
        if success:
            metrics = response.get('metrics', [])
            available_fields = response.get('available_fields', {})
            
            # Check for calculated metrics (Avg Lead Age, Avg Closure Time)
            calculated_metrics = [m for m in metrics if m.get('metric_type') == 'calculated']
            if calculated_metrics:
                print(f"   ✓ Found {len(calculated_metrics)} calculated metrics")
                for metric in calculated_metrics:
                    if metric['metric_id'] in ['avg_lead_age', 'avg_closure_time']:
                        print(f"   ✓ {metric['metric_name']} has configurable fields")
            
            # Check for formula metrics
            formula_metrics = [m for m in metrics if m.get('metric_type') == 'formula']
            if formula_metrics:
                print(f"   ✓ Found {len(formula_metrics)} formula metrics")
            
            # Check available fields
            if available_fields:
                print(f"   ✓ Available fields: {list(available_fields.keys())}")
        
        # Test updating calculated metric (Avg Lead Age)
        update_data = {
            "start_date_field": "planned_followup_date",
            "end_date_field": "last_followup_date",
            "filter_stages": ["Prospecting", "Qualified"]
        }
        
        success, response = self.run_test(
            "Update Avg Lead Age Configuration", 
            "PUT", 
            "metric-settings/avg_lead_age", 
            200, 
            update_data
        )
        
        if success:
            if (response.get('start_date_field') == 'planned_followup_date' and 
                response.get('end_date_field') == 'last_followup_date'):
                print("   ✓ Date fields updated correctly")
            if response.get('filter_stages') == ["Prospecting", "Qualified"]:
                print("   ✓ Filter stages updated correctly")
        
        # Test updating formula metric (Conversion Rate)
        formula_update = {
            "numerator_metric": "won_leads",
            "denominator_metric": "total_leads"
        }
        
        success, response = self.run_test(
            "Update Conversion Rate Formula", 
            "PUT", 
            "metric-settings/conversion_rate", 
            200, 
            formula_update
        )
        
        if success:
            if (response.get('numerator_metric') == 'won_leads' and 
                response.get('denominator_metric') == 'total_leads'):
                print("   ✓ Formula updated correctly")
        
        # Test creating custom formula metric
        custom_formula_metric = {
            "metric_id": "test_win_rate",
            "metric_name": "Test Win Rate",
            "description": "Test metric for win rate calculation",
            "metric_type": "formula",
            "numerator_metric": "won_leads",
            "denominator_metric": "won_leads+lost_leads",
            "unit": "%",
            "color": "green",
            "icon": "TrendingUp"
        }
        
        success, response = self.run_test(
            "Create Custom Formula Metric", 
            "POST", 
            "metric-settings/custom", 
            200, 
            custom_formula_metric
        )
        
        if success:
            print("   ✓ Custom formula metric created")
            self.created_metrics.append("test_win_rate")
        
        # Test creating custom calculated metric
        custom_calculated_metric = {
            "metric_id": "test_lead_duration",
            "metric_name": "Test Lead Duration",
            "description": "Test metric for lead duration calculation",
            "metric_type": "calculated",
            "start_date_field": "enquiry_date",
            "end_date_field": "today",
            "filter_stages": ["Prospecting", "Qualified", "Proposal"],
            "unit": "days",
            "color": "blue",
            "icon": "Clock"
        }
        
        success, response = self.run_test(
            "Create Custom Calculated Metric", 
            "POST", 
            "metric-settings/custom", 
            200, 
            custom_calculated_metric
        )
        
        if success:
            print("   ✓ Custom calculated metric created")
            self.created_metrics.append("test_lead_duration")
        
        # Test KPIs with configurable metrics
        success, response = self.run_test("Get KPIs with Configurable Metrics", "GET", "kpis", 200)
        
        if success:
            dashboard_metrics = response.get('dashboard_metrics', [])
            if dashboard_metrics:
                print(f"   ✓ Found {len(dashboard_metrics)} dashboard metrics")
                
                # Check for calculated metrics
                calculated = [m for m in dashboard_metrics if m.get('metric_type') == 'calculated']
                formula = [m for m in dashboard_metrics if m.get('metric_type') == 'formula']
                
                print(f"   ✓ {len(calculated)} calculated metrics")
                print(f"   ✓ {len(formula)} formula metrics")
                
                # Check specific metrics
                avg_lead_age = next((m for m in dashboard_metrics if m['metric_id'] == 'avg_lead_age'), None)
                if avg_lead_age:
                    print(f"   ✓ Avg Lead Age: {avg_lead_age.get('value', 0)} days")
                
                conversion_rate = next((m for m in dashboard_metrics if m['metric_id'] == 'conversion_rate'), None)
                if conversion_rate:
                    print(f"   ✓ Conversion Rate: {conversion_rate.get('value', 0)}%")
    
    def test_cleanup_custom_metrics(self):
        """Clean up created test metrics"""
        print("\n=== CLEANUP CUSTOM METRICS ===")
        
        for metric_id in self.created_metrics:
            success, _ = self.run_test(
                f"Delete Custom Metric {metric_id}", 
                "DELETE", 
                f"metric-settings/custom/{metric_id}", 
                200
            )
            if success:
                print(f"   ✓ Deleted {metric_id}")
        
        self.created_metrics.clear()

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
    
    # Login first to get session token
    if not tester.test_login():
        print("❌ Login failed, cannot proceed with authenticated tests")
        return 1
    
    # Test authenticated endpoints first
    tester.test_auth_me_endpoint()
    tester.test_kpi_endpoints()
    tester.test_kpi_qualification_metrics()
    tester.test_leads_endpoints()
    tester.test_filter_endpoints()
    tester.test_insights_endpoints()
    tester.test_qualification_endpoints()
    tester.test_lead_activity_endpoints()
    tester.test_upload_endpoints()  # Add upload tests
    tester.test_notifications_endpoints()  # Add notification tests
    tester.test_admin_endpoints()
    tester.test_metric_settings_endpoints()  # Add metric settings tests
    
    # Cleanup custom metrics
    tester.test_cleanup_custom_metrics()
    
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