import requests
import sys
from datetime import datetime
import json

class LeadManagementAPITester:
    def __init__(self, base_url="https://sharda-insights.preview.emergentagent.com"):
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
        
        success, response = self.run_test("Get KPIs", "GET", "kpis", 200)
        if success:
            # Test NEW FEATURE: Call & Quotation Tracking KPIs
            call_quotation_metrics = [
                'calls_placed', 'quotations_sent', 'call_to_quotation_rate', 'not_called'
            ]
            
            missing_metrics = [metric for metric in call_quotation_metrics if metric not in response]
            if not missing_metrics:
                print(f"   ✓ All Call & Quotation metrics present")
                print(f"   ✓ Calls Placed: {response.get('calls_placed', 0)}")
                print(f"   ✓ Quotations Sent: {response.get('quotations_sent', 0)}")
                print(f"   ✓ Call to Quotation Rate: {response.get('call_to_quotation_rate', 0)}%")
                print(f"   ✓ Not Called: {response.get('not_called', 0)}")
            else:
                print(f"   ⚠️  Missing Call & Quotation metrics: {missing_metrics}")
                
            # Verify calculation logic
            calls_placed = response.get('calls_placed', 0)
            quotations_sent = response.get('quotations_sent', 0)
            call_to_quotation_rate = response.get('call_to_quotation_rate', 0)
            
            if calls_placed > 0:
                expected_rate = round((quotations_sent / calls_placed * 100), 2)
                if abs(call_to_quotation_rate - expected_rate) < 0.1:
                    print(f"   ✓ Call to Quotation Rate calculation correct")
                else:
                    print(f"   ⚠️  Call to Quotation Rate calculation may be incorrect: {call_to_quotation_rate}% vs expected {expected_rate}%")
            elif call_to_quotation_rate == 0:
                print(f"   ✓ Call to Quotation Rate correctly 0 when no calls placed")
            else:
                print(f"   ⚠️  Call to Quotation Rate should be 0 when no calls placed")

    def test_leads_endpoints(self):
        """Test leads endpoints"""
        print("\n=== LEADS TESTS ===")
        
        # Test get leads with pagination
        self.run_test("Get Leads", "GET", "leads?page=1&limit=10", 200)
        
        # Test get leads with filters
        self.run_test("Get Leads with State Filter", "GET", "leads?state=Maharashtra&page=1&limit=5", 200)
        
        # Test NEW FEATURE: dropdown options endpoint
        success, response = self.run_test("Get Dropdown Options", "GET", "leads/dropdown-options", 200)
        if success:
            # Check if call_status options are present
            if "call_status" in response:
                call_statuses = response["call_status"]
                expected_statuses = [
                    'Not Called',
                    'Called - No Response', 
                    'Called - Interested',
                    'Called - Not Interested',
                    'Called - Follow Up Required',
                    'Called - Converted'
                ]
                if all(status in call_statuses for status in expected_statuses):
                    print(f"   ✓ Call status options complete: {len(call_statuses)} options")
                else:
                    print(f"   ⚠️  Missing call status options")
            else:
                print(f"   ⚠️  Call status options not found in dropdown response")
        
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
        """Test Call Remarks functionality"""
        print("\n=== CALL REMARKS TESTS ===")
        
        # Get a lead first
        success, leads_response = self.run_test("Get Leads for Call Remarks", "GET", "leads?limit=1", 200)
        if success and leads_response.get("leads"):
            lead_id = leads_response["leads"][0]["lead_id"]
            lead_name = leads_response["leads"][0].get("name", "Unknown")
            
            print(f"   Testing with lead: {lead_name} ({lead_id})")
            
            # Test get call remarks (should be empty initially or return existing)
            success, remarks_response = self.run_test("Get Call Remarks", "GET", f"leads/{lead_id}/call-remarks", 200)
            if success:
                existing_remarks = remarks_response.get("remarks", [])
                print(f"   ✓ Found {len(existing_remarks)} existing call remarks")
            
            # Test add call remark
            remark_data = {
                "remark": f"Test call remark added at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
            }
            success, add_response = self.run_test("Add Call Remark", "POST", f"leads/{lead_id}/call-remark", 200, remark_data)
            if success:
                new_remark = add_response.get("remark", {})
                if new_remark.get("remark") == remark_data["remark"]:
                    print(f"   ✓ Call remark added successfully")
                    print(f"   ✓ Added by: {new_remark.get('added_by', 'Unknown')}")
                    print(f"   ✓ Added at: {new_remark.get('added_at', 'Unknown')}")
                else:
                    print(f"   ⚠️  Call remark content mismatch")
            
            # Test get call remarks again (should have one more)
            success, updated_remarks_response = self.run_test("Get Updated Call Remarks", "GET", f"leads/{lead_id}/call-remarks", 200)
            if success:
                updated_remarks = updated_remarks_response.get("remarks", [])
                if len(updated_remarks) == len(existing_remarks) + 1:
                    print(f"   ✓ Call remarks count increased correctly: {len(updated_remarks)}")
                    
                    # Check the latest remark
                    latest_remark = updated_remarks[-1] if updated_remarks else None
                    if latest_remark and latest_remark.get("remark") == remark_data["remark"]:
                        print(f"   ✓ Latest remark matches added remark")
                    else:
                        print(f"   ⚠️  Latest remark doesn't match")
                else:
                    print(f"   ⚠️  Call remarks count not updated correctly")
            
            # Test update lead with call status and quotation fields
            update_data = {
                "call_status": "Called - Interested",
                "quotation_sent": True,
                "quotation_date": "2025-01-15"
            }
            success, update_response = self.run_test("Update Lead Call Status & Quotation", "PUT", f"leads/{lead_id}", 200, update_data)
            if success:
                print(f"   ✓ Lead updated with call status and quotation info")
            
            # Verify the update by getting the lead
            success, lead_response = self.run_test("Get Updated Lead", "GET", f"leads/{lead_id}", 200)
            if success:
                lead = lead_response
                if (lead.get("call_status") == "Called - Interested" and 
                    lead.get("quotation_sent") == True and 
                    lead.get("quotation_date") == "2025-01-15"):
                    print(f"   ✓ Lead call status and quotation fields updated correctly")
                else:
                    print(f"   ⚠️  Lead update verification failed")
                    print(f"       Call Status: {lead.get('call_status')}")
                    print(f"       Quotation Sent: {lead.get('quotation_sent')}")
                    print(f"       Quotation Date: {lead.get('quotation_date')}")
        else:
            print("   ⚠️  No leads found for call remarks testing")

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
        
        # Test specific case: J.B ENTERPRISES (main issue from review request)
        print("\n🎯 Testing J.B ENTERPRISES Profile (Main Issue Case)")
        
        # Test without date filter (should use Indian FY default)
        profile_success, profile_response = self.run_test(
            "J.B ENTERPRISES Profile - Default Dates", 
            "GET", 
            "entity/profile/dealer/J.B%20ENTERPRISES", 
            200
        )
        
        if profile_success:
            # Check date_range field
            date_range = profile_response.get("date_range")
            if date_range:
                print(f"   ✅ Date range present: {date_range['start_date']} to {date_range['end_date']}")
                # Check if it's Indian FY (April to March)
                start_date = date_range['start_date']
                if start_date.endswith('-04-01'):
                    print(f"   ✅ Using Indian FY dates (starts April 1st)")
                else:
                    print(f"   ⚠️  Not using Indian FY dates - starts {start_date}")
            else:
                print(f"   ❌ Date range missing from response")
            
            # Check KPIs are not empty
            kpis = profile_response.get("kpis", {})
            if kpis:
                won_leads = kpis.get("won_leads", 0)
                total_leads = kpis.get("total_leads", 0)
                conversion_rate = kpis.get("conversion_rate", 0)
                
                print(f"   📊 KPIs - Total: {total_leads}, Won: {won_leads}, Conv: {conversion_rate}%")
                
                # Check if won leads is reasonable (~41 expected, not 400+)
                if won_leads > 200:
                    print(f"   ⚠️  WARNING: Won leads ({won_leads}) seems very high - expected ~41")
                elif 30 <= won_leads <= 60:
                    print(f"   ✅ Won leads count looks reasonable")
                
                # Check KPI cards are not empty
                empty_kpis = [k for k, v in kpis.items() if v == 0 or v is None]
                if empty_kpis:
                    print(f"   ⚠️  Empty KPIs: {empty_kpis}")
                else:
                    print(f"   ✅ All KPIs have values")
            else:
                print(f"   ❌ KPIs section missing or empty")
        
        # Test with explicit date range (Indian FY)
        profile_success, profile_response = self.run_test(
            "J.B ENTERPRISES Profile - Explicit Indian FY", 
            "GET", 
            "entity/profile/dealer/J.B%20ENTERPRISES?start_date=2025-04-01&end_date=2026-03-31", 
            200
        )
        
        if profile_success:
            date_range = profile_response.get("date_range")
            if date_range:
                print(f"   ✅ Explicit date range: {date_range['start_date']} to {date_range['end_date']}")
            
            kpis = profile_response.get("kpis", {})
            if kpis:
                won_leads = kpis.get("won_leads", 0)
                print(f"   📊 Won leads with date filter: {won_leads}")
        
        # Test Entity Configuration APIs
        print("\n🔧 Testing Entity Configuration APIs")
        
        # Test GET entity config
        config_success, config_response = self.run_test(
            "Get Entity Profile Config", 
            "GET", 
            "entity/config", 
            200
        )
        
        if config_success:
            required_config_keys = ["kpis", "charts", "sub_entities", "display_options"]
            missing_keys = [key for key in required_config_keys if key not in config_response]
            if not missing_keys:
                print(f"   ✅ Entity config structure complete")
                
                # Check KPI configuration
                kpis_config = config_response.get("kpis", {})
                enabled_kpis = kpis_config.get("enabled_kpis", [])
                print(f"   📊 Enabled KPIs: {len(enabled_kpis)} - {enabled_kpis[:3]}...")
                
                # Check charts configuration
                charts_config = config_response.get("charts", {})
                enabled_charts = [k for k, v in charts_config.items() if v.get("enabled", False)]
                print(f"   📈 Enabled charts: {len(enabled_charts)} - {enabled_charts}")
            else:
                print(f"   ⚠️  Missing config keys: {missing_keys}")
        
        # Test PUT entity config (update)
        sample_config = {
            "kpis": {
                "enabled_kpis": ["total_leads", "won_leads", "lost_leads", "conversion_rate"],
                "show_call_quotation_kpis": True
            },
            "charts": {
                "stage_breakdown": {"enabled": True, "title": "Lead Stage Breakdown"},
                "source_breakdown": {"enabled": True, "title": "Lead Source Distribution"},
                "segment_performance": {"enabled": False, "title": "Segment Performance"}
            }
        }
        
        config_update_success, config_update_response = self.run_test(
            "Update Entity Profile Config", 
            "PUT", 
            "entity/config", 
            200,
            sample_config
        )
        
        if config_update_success:
            print(f"   ✅ Entity config updated successfully")
        
        # Test Available KPIs API
        kpis_success, kpis_response = self.run_test(
            "Get Available KPIs", 
            "GET", 
            "entity/available-kpis", 
            200
        )
        
        if kpis_success:
            built_in = kpis_response.get("built_in_metrics", [])
            configurable = kpis_response.get("configurable_metrics", [])
            print(f"   📊 Built-in metrics: {len(built_in)}")
            print(f"   🔧 Configurable metrics: {len(configurable)}")
            
            # Check for expected built-in metrics
            expected_built_in = ["total_leads", "conversion_rate", "avg_lead_age", "avg_closure_time"]
            found_built_in = [m["metric_id"] for m in built_in]
            missing_built_in = [m for m in expected_built_in if m not in found_built_in]
            if not missing_built_in:
                print(f"   ✅ All expected built-in metrics present")
            else:
                print(f"   ⚠️  Missing built-in metrics: {missing_built_in}")
        
        # Test entity search endpoint
        success, response = self.run_test("Search Entities - J.B", "GET", "entity/search?q=J.B", 200)
        if success and response.get("results"):
            print(f"   ✓ Found {len(response['results'])} entities for 'J.B'")
            
            # Check if J.B ENTERPRISES is in results
            jb_found = any(r.get("name") == "J.B ENTERPRISES" for r in response["results"])
            if jb_found:
                print(f"   ✅ J.B ENTERPRISES found in search results")
            else:
                print(f"   ⚠️  J.B ENTERPRISES not found in search results")
            
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
                required_keys = ["entity_type", "entity_id", "kpis", "stage_breakdown", "date_range"]
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

    def test_trash_management_endpoints(self):
        """Test trash management endpoints for delete leads feature"""
        print("\n=== TRASH MANAGEMENT TESTS ===")
        
        # Test get filter options for deletion
        success, response = self.run_test("Get Trash Filter Options", "GET", "admin/trash/filter-options", 200)
        if success:
            required_keys = ["states", "dealers", "employees", "stages", "segments", "sources"]
            missing_keys = [key for key in required_keys if key not in response]
            if not missing_keys:
                print(f"   ✓ All filter options available")
                print(f"   ✓ States: {len(response.get('states', []))}, Dealers: {len(response.get('dealers', []))}")
            else:
                print(f"   ⚠️  Missing filter keys: {missing_keys}")
        
        # Test preview delete with state filter
        success, response = self.run_test("Preview Delete - Jharkhand", "GET", "admin/trash/preview-delete?state=Jharkhand", 200)
        if success:
            count = response.get("count", 0)
            sample_leads = response.get("sample_leads", [])
            filters_applied = response.get("filters_applied", {})
            print(f"   ✓ Preview: {count} leads would be deleted")
            print(f"   ✓ Sample leads: {len(sample_leads)}")
            print(f"   ✓ Filters applied: {filters_applied}")
        
        # Test preview delete with multiple filters
        success, response = self.run_test(
            "Preview Delete - Multiple Filters", 
            "GET", 
            "admin/trash/preview-delete?state=Maharashtra&stage=Prospecting", 
            200
        )
        if success:
            count = response.get("count", 0)
            print(f"   ✓ Multi-filter preview: {count} leads")
        
        # Test soft delete with limit (small number for testing)
        success, response = self.run_test(
            "Soft Delete Leads - Limited", 
            "POST", 
            "admin/trash/delete-leads?state=Jharkhand&limit=5", 
            200
        )
        if success:
            deleted_count = response.get("deleted_count", 0)
            auto_purge_at = response.get("auto_purge_at")
            print(f"   ✓ Soft deleted: {deleted_count} leads")
            print(f"   ✓ Auto-purge date: {auto_purge_at}")
        
        # Test get deleted leads (trash)
        success, response = self.run_test("Get Deleted Leads", "GET", "admin/trash/deleted-leads?page=1&limit=10", 200)
        if success:
            leads = response.get("leads", [])
            total = response.get("total", 0)
            print(f"   ✓ Trash contains: {total} leads")
            print(f"   ✓ Retrieved: {len(leads)} leads")
            
            # Store some lead IDs for recovery/permanent delete tests
            self.test_lead_ids = [lead["lead_id"] for lead in leads[:2]] if leads else []
        
        # Test trash stats
        success, response = self.run_test("Get Trash Stats", "GET", "admin/trash/trash-stats", 200)
        if success:
            total_in_trash = response.get("total_in_trash", 0)
            expiring_soon = response.get("expiring_soon", 0)
            recovery_days = response.get("recovery_days", 0)
            print(f"   ✓ Trash stats - Total: {total_in_trash}, Expiring: {expiring_soon}, Recovery days: {recovery_days}")
        
        # Test recover leads (if we have test leads)
        if hasattr(self, 'test_lead_ids') and self.test_lead_ids:
            recover_data = {"lead_ids": self.test_lead_ids[:1], "recover_all": False}
            success, response = self.run_test("Recover Leads", "POST", "admin/trash/recover-leads", 200, recover_data)
            if success:
                recovered_count = response.get("recovered_count", 0)
                print(f"   ✓ Recovered: {recovered_count} leads")
        
        # Test permanent delete (if we still have test leads)
        if hasattr(self, 'test_lead_ids') and len(self.test_lead_ids) > 1:
            delete_data = {"lead_ids": self.test_lead_ids[1:], "delete_all_trash": False}
            success, response = self.run_test("Permanent Delete Leads", "POST", "admin/trash/permanent-delete", 200, delete_data)
            if success:
                deleted_count = response.get("deleted_count", 0)
                print(f"   ✓ Permanently deleted: {deleted_count} leads")
        
        # Test purge expired leads
        success, response = self.run_test("Purge Expired Leads", "POST", "admin/trash/purge-expired", 200)
        if success:
            purged_count = response.get("purged_count", 0)
            print(f"   ✓ Purged expired: {purged_count} leads")
        
        # Test error cases
        # Test delete without filters (should fail)
        success, response = self.run_test("Delete Without Filters (Should Fail)", "POST", "admin/trash/delete-leads", 400)
        if success:
            print(f"   ✓ Correctly rejected delete without filters")
        
        # Test recover without lead IDs (should fail)
        recover_data = {"lead_ids": [], "recover_all": False}
        success, response = self.run_test("Recover Without IDs (Should Fail)", "POST", "admin/trash/recover-leads", 400, recover_data)
        if success:
            print(f"   ✓ Correctly rejected recover without lead IDs")

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
    tester.test_call_remarks_endpoints()  # Add call remarks tests
    tester.test_filter_endpoints()
    tester.test_insights_endpoints()
    tester.test_qualification_endpoints()
    tester.test_lead_activity_endpoints()
    tester.test_upload_endpoints()  # Add upload tests
    tester.test_notifications_endpoints()  # Add notification tests
    tester.test_entity_profile_endpoints()  # Add entity profile tests
    tester.test_admin_endpoints()
    tester.test_trash_management_endpoints()  # Add trash management tests
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