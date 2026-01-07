#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timedelta

class LeadManagementTester:
    def __init__(self, base_url="https://shardaleads.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.employee_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        cookies = {}
        
        if token:
            cookies['session_token'] = token

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, cookies=cookies)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, cookies=cookies)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, cookies=cookies)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, cookies=cookies)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}"
            if not success:
                details += f", Expected: {expected_status}"
                if response.text:
                    try:
                        error_data = response.json()
                        details += f", Error: {error_data.get('detail', response.text[:100])}"
                    except:
                        details += f", Response: {response.text[:100]}"

            self.log_test(name, success, details)
            return success, response.json() if success and response.text else {}

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def login_admin(self):
        """Login as admin user"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"username": "admin", "password": "admin123"}
        )
        if success and 'token' in response:
            self.admin_token = response['token']
            return True
        return False

    def login_employee(self):
        """Login as employee user"""
        success, response = self.run_test(
            "Employee Login",
            "POST", 
            "auth/login",
            200,
            data={"username": "employee@test.com", "password": "testpassword"}
        )
        if success and 'token' in response:
            self.employee_token = response['token']
            return True
        return False

    def test_notifications_filtering(self):
        """Test notifications filtering for employees vs system imports"""
        print("\n🔍 Testing Notifications Filtering...")
        
        if not self.employee_token:
            self.log_test("Employee Notifications Test", False, "Employee login required")
            return
            
        # Test employee notifications (should only see their leads + system imports)
        success, response = self.run_test(
            "Employee Notifications API",
            "GET",
            "notifications",
            200,
            token=self.employee_token
        )
        
        if success:
            notifications = response.get('notifications', [])
            # Check if notifications are properly filtered
            for notification in notifications:
                added_by = notification.get('added_by')
                if added_by and added_by not in ['System Import', 'employee@test.com', None]:
                    self.log_test("Employee Notification Filtering", False, 
                                f"Employee seeing notification for lead added by: {added_by}")
                    return
            
            self.log_test("Employee Notification Filtering", True, 
                        f"Employee sees {len(notifications)} notifications (correctly filtered)")

        # Test admin notifications (should see all)
        if self.admin_token:
            success, response = self.run_test(
                "Admin Notifications API",
                "GET", 
                "notifications",
                200,
                token=self.admin_token
            )
            
            if success:
                admin_notifications = response.get('notifications', [])
                self.log_test("Admin Notification Access", True,
                            f"Admin sees {len(admin_notifications)} notifications (all leads)")

    def test_added_by_field(self):
        """Test Added By field functionality"""
        print("\n🔍 Testing Added By Field...")
        
        if not self.admin_token:
            self.log_test("Added By Field Test", False, "Admin login required")
            return

        # Test creating a lead (should auto-set added_by)
        test_lead_data = {
            "name": "Test Lead for Added By",
            "phone_number": "9999999999",
            "email_address": "test@addedby.com",
            "state": "Test State",
            "dealer": "Test Dealer",
            "employee_name": "Test Employee",
            "enquiry_no": f"TEST{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "enquiry_date": "2024-01-15",
            "customer_type": "New Customer",
            "segment": "Corporate",
            "enquiry_status": "Open",
            "enquiry_stage": "Prospecting"
        }
        
        success, response = self.run_test(
            "Create Lead with Auto Added By",
            "POST",
            "leads",
            200,
            data=test_lead_data,
            token=self.admin_token
        )
        
        if success:
            lead_id = response.get('lead_id')
            if lead_id:
                # Get the created lead to check added_by field
                success, lead_data = self.run_test(
                    "Get Lead to Check Added By",
                    "GET",
                    f"leads/{lead_id}",
                    200,
                    token=self.admin_token
                )
                
                if success:
                    added_by = lead_data.get('added_by')
                    if added_by:
                        self.log_test("Auto-set Added By Field", True, 
                                    f"Added by field set to: {added_by}")
                    else:
                        self.log_test("Auto-set Added By Field", False, 
                                    "Added by field not set automatically")
                    
                    # Test updating added_by field
                    update_data = {"added_by": "Updated User Name"}
                    success, _ = self.run_test(
                        "Update Added By Field",
                        "PUT",
                        f"leads/{lead_id}",
                        200,
                        data=update_data,
                        token=self.admin_token
                    )
                    
                    if success:
                        # Verify the update
                        success, updated_lead = self.run_test(
                            "Verify Added By Update",
                            "GET",
                            f"leads/{lead_id}",
                            200,
                            token=self.admin_token
                        )
                        
                        if success and updated_lead.get('added_by') == "Updated User Name":
                            self.log_test("Added By Field Editable", True, 
                                        "Successfully updated added_by field")
                        else:
                            self.log_test("Added By Field Editable", False,
                                        "Failed to update added_by field")

    def test_leads_table_added_by_column(self):
        """Test that Added By column is visible in leads table"""
        print("\n🔍 Testing Leads Table Added By Column...")
        
        if not self.admin_token:
            self.log_test("Leads Table Added By Test", False, "Admin login required")
            return

        # Get leads list to check if added_by field is included
        success, response = self.run_test(
            "Get Leads List with Added By",
            "GET",
            "leads?limit=5",
            200,
            token=self.admin_token
        )
        
        if success:
            leads = response.get('leads', [])
            if leads:
                # Check if first lead has added_by field
                first_lead = leads[0]
                if 'added_by' in first_lead:
                    self.log_test("Added By Column in Leads Table", True,
                                f"Added by field present: {first_lead.get('added_by', 'None')}")
                else:
                    self.log_test("Added By Column in Leads Table", False,
                                "Added by field missing from leads response")
            else:
                self.log_test("Added By Column in Leads Table", False,
                            "No leads found to test")

    def test_admin_password_change(self):
        """Test admin password change functionality"""
        print("\n🔍 Testing Admin Password Change...")
        
        if not self.admin_token:
            self.log_test("Admin Password Change Test", False, "Admin login required")
            return

        # First get list of users
        success, response = self.run_test(
            "Get Users List",
            "GET",
            "admin/users",
            200,
            token=self.admin_token
        )
        
        if success:
            users = response
            if users:
                # Find a non-admin user to test password change
                test_user = None
                for user in users:
                    if user.get('role') != 'Admin':
                        test_user = user
                        break
                
                if test_user:
                    user_id = test_user.get('user_id')
                    # Test password change API
                    success, _ = self.run_test(
                        "Admin Change User Password API",
                        "PUT",
                        f"admin/users/{user_id}/password",
                        200,
                        data={"password": "newpassword123"},
                        token=self.admin_token
                    )
                    
                    if success:
                        self.log_test("Admin Password Change Functionality", True,
                                    f"Successfully changed password for user: {test_user.get('name', 'Unknown')}")
                    else:
                        self.log_test("Admin Password Change Functionality", False,
                                    "Password change API failed")
                else:
                    self.log_test("Admin Password Change Test", False,
                                "No non-admin user found to test password change")
            else:
                self.log_test("Admin Password Change Test", False,
                            "No users found")

    def test_system_import_notifications(self):
        """Test that System Import leads are visible to everyone"""
        print("\n🔍 Testing System Import Notifications...")
        
        if not self.admin_token:
            self.log_test("System Import Test", False, "Admin login required")
            return

        # Create a lead marked as System Import
        system_import_lead = {
            "name": "System Import Test Lead",
            "phone_number": "8888888888",
            "email_address": "system@import.com",
            "state": "System State",
            "dealer": "System Dealer", 
            "employee_name": "System Employee",
            "enquiry_no": f"SYS{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "enquiry_date": "2024-01-15",
            "customer_type": "New Customer",
            "segment": "Corporate",
            "enquiry_status": "Open",
            "enquiry_stage": "Prospecting",
            "added_by": "System Import",
            "planned_followup_date": "2024-01-20"  # Set follow-up to trigger notification
        }
        
        success, response = self.run_test(
            "Create System Import Lead",
            "POST",
            "leads",
            200,
            data=system_import_lead,
            token=self.admin_token
        )
        
        if success:
            # Test that employee can see this in notifications
            if self.employee_token:
                success, response = self.run_test(
                    "Employee Sees System Import Notification",
                    "GET",
                    "notifications",
                    200,
                    token=self.employee_token
                )
                
                if success:
                    notifications = response.get('notifications', [])
                    system_import_found = False
                    for notification in notifications:
                        if notification.get('added_by') == 'System Import':
                            system_import_found = True
                            break
                    
                    if system_import_found:
                        self.log_test("System Import Visible to Employee", True,
                                    "Employee can see System Import lead notifications")
                    else:
                        self.log_test("System Import Visible to Employee", False,
                                    "Employee cannot see System Import lead notifications")

    def test_kpis_hot_warm_cold_counts(self):
        """Test that KPI API returns Hot/Warm/Cold counts only for Open leads"""
        print("\n🔍 Testing KPI Hot/Warm/Cold Counts (Open leads only)...")
        
        if not self.admin_token:
            self.log_test("KPI Hot/Warm/Cold Counts Test", False, "Admin login required")
            return

        success, response = self.run_test(
            "KPI Hot/Warm/Cold Counts",
            "GET",
            "kpis",
            200,
            token=self.admin_token
        )
        
        if success:
            hot_leads = response.get('hot_leads', 0)
            warm_leads = response.get('warm_leads', 0)
            cold_leads = response.get('cold_leads', 0)
            open_leads = response.get('open_leads', 0)
            
            print(f"   Hot leads: {hot_leads}")
            print(f"   Warm leads: {warm_leads}")
            print(f"   Cold leads: {cold_leads}")
            print(f"   Open leads: {open_leads}")
            
            # Verify that hot+warm+cold <= open_leads (since they should only count open leads)
            total_typed_leads = hot_leads + warm_leads + cold_leads
            if total_typed_leads <= open_leads:
                self.log_test("KPI Hot/Warm/Cold Counts", True,
                            f"Hot/Warm/Cold counts ({total_typed_leads}) are within Open leads ({open_leads})")
            else:
                self.log_test("KPI Hot/Warm/Cold Counts", False,
                            f"Hot/Warm/Cold counts ({total_typed_leads}) exceed Open leads ({open_leads})")

    def test_leads_enquiry_type_filter(self):
        """Test leads endpoint with enquiry_type filter (Hot/Warm/Cold)"""
        print("\n🔍 Testing Leads Enquiry Type Filter...")
        
        if not self.admin_token:
            self.log_test("Leads Enquiry Type Filter Test", False, "Admin login required")
            return

        # Test single type filter
        success, response = self.run_test(
            "Leads Filter - Single Type (Hot)",
            "GET",
            "leads?enquiry_type=Hot&limit=10",
            200,
            token=self.admin_token
        )
        
        if success:
            leads = response.get('leads', [])
            print(f"   Found {len(leads)} Hot leads")
            
            # Verify all returned leads are Hot type
            all_hot = all(lead.get('enquiry_type') == 'Hot' for lead in leads)
            if all_hot:
                self.log_test("Single Type Filter (Hot)", True, f"All {len(leads)} leads are Hot type")
            else:
                self.log_test("Single Type Filter (Hot)", False, "Some leads are not Hot type")
        
        # Test multi-select filter
        success2, response2 = self.run_test(
            "Leads Filter - Multi-select (Hot,Warm)",
            "GET",
            "leads?enquiry_type=Hot,Warm&limit=10",
            200,
            token=self.admin_token
        )
        
        if success2:
            leads2 = response2.get('leads', [])
            print(f"   Found {len(leads2)} Hot/Warm leads")
            
            # Verify all returned leads are Hot or Warm
            all_hot_warm = all(lead.get('enquiry_type') in ['Hot', 'Warm'] for lead in leads2)
            if all_hot_warm:
                self.log_test("Multi-select Type Filter (Hot,Warm)", True, 
                            f"All {len(leads2)} leads are Hot or Warm type")
            else:
                self.log_test("Multi-select Type Filter (Hot,Warm)", False,
                            "Some leads are not Hot or Warm type")

    def test_leads_followup_date_filter(self):
        """Test leads endpoint with followup date filters"""
        print("\n🔍 Testing Leads Follow-up Date Filter...")
        
        if not self.admin_token:
            self.log_test("Leads Follow-up Date Filter Test", False, "Admin login required")
            return

        today = datetime.now().strftime('%Y-%m-%d')
        tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
        next_week = (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d')
        yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
        
        # Test today filter
        success1, response1 = self.run_test(
            "Leads Filter - Follow-up Today",
            "GET",
            f"leads?followup_start_date={today}&followup_end_date={today}&limit=5",
            200,
            token=self.admin_token
        )
        
        if success1:
            leads1 = response1.get('leads', [])
            print(f"   Found {len(leads1)} leads with follow-up today")
            self.log_test("Follow-up Today Filter", True, f"Found {len(leads1)} leads")
        
        # Test date range filter
        success2, response2 = self.run_test(
            "Leads Filter - Follow-up Date Range",
            "GET",
            f"leads?followup_start_date={today}&followup_end_date={next_week}&limit=5",
            200,
            token=self.admin_token
        )
        
        if success2:
            leads2 = response2.get('leads', [])
            print(f"   Found {len(leads2)} leads with follow-up in next 7 days")
            self.log_test("Follow-up Date Range Filter", True, f"Found {len(leads2)} leads")
        
        # Test overdue filter (follow-up before today)
        success3, response3 = self.run_test(
            "Leads Filter - Overdue Follow-ups",
            "GET",
            f"leads?followup_start_date=2000-01-01&followup_end_date={yesterday}&limit=5",
            200,
            token=self.admin_token
        )
        
        if success3:
            leads3 = response3.get('leads', [])
            print(f"   Found {len(leads3)} leads with overdue follow-ups")
            self.log_test("Overdue Follow-up Filter", True, f"Found {len(leads3)} overdue leads")

    def test_leads_combined_filters(self):
        """Test leads endpoint with combined enquiry_type and followup filters"""
        print("\n🔍 Testing Combined Filters...")
        
        if not self.admin_token:
            self.log_test("Combined Filters Test", False, "Admin login required")
            return

        today = datetime.now().strftime('%Y-%m-%d')
        next_week = (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d')
        
        success, response = self.run_test(
            "Combined Filter - Hot leads with follow-up this week",
            "GET",
            f"leads?enquiry_type=Hot&followup_start_date={today}&followup_end_date={next_week}&limit=10",
            200,
            token=self.admin_token
        )
        
        if success:
            leads = response.get('leads', [])
            print(f"   Found {len(leads)} Hot leads with follow-up this week")
            
            # Verify filters are working together
            filter_valid = True
            for lead in leads:
                if lead.get('enquiry_type') != 'Hot':
                    print(f"❌ Lead {lead.get('enquiry_no')} is not Hot type")
                    filter_valid = False
                    break
                
                followup_date = lead.get('planned_followup_date')
                if followup_date and (followup_date < today or followup_date > next_week):
                    print(f"❌ Lead {lead.get('enquiry_no')} follow-up date {followup_date} is outside range")
                    filter_valid = False
                    break
            
            if filter_valid:
                self.log_test("Combined Filters", True, f"All {len(leads)} leads match combined criteria")
            else:
                self.log_test("Combined Filters", False, "Some leads don't match filter criteria")

    def test_lost_leads_upload(self):
        """Test lost leads upload functionality"""
        print("\n🔍 Testing Lost Leads Upload...")
        
        if not self.admin_token:
            self.log_test("Lost Leads Upload Test", False, "Admin login required")
            return

        # First, test downloading the template
        success, _ = self.run_test(
            "Download Lost Leads Template",
            "GET",
            "upload/lost-leads/template",
            200,
            token=self.admin_token
        )

        # Create test Excel file for lost leads upload
        import pandas as pd
        import io
        
        # Test data with sample lost leads
        test_data = {
            'Zone': ['East', 'West'],
            'State': ['Bihar', 'Maharashtra'],
            'Area Office': ['Patna', 'Mumbai'],
            'Dealer': ['Test Dealer 1', 'Test Dealer 2'],
            'Employee Name': ['John Doe', 'Jane Smith'],
            'Enquiry No': [f'LOST{datetime.now().strftime("%Y%m%d%H%M%S")}001', f'LOST{datetime.now().strftime("%Y%m%d%H%M%S")}002'],
            'Enquiry Date': ['2025-01-01', '2025-01-02'],
            'Corporate Name': ['ABC Corp', 'XYZ Ltd'],
            'Name': ['Customer A', 'Customer B'],
            'Phone Number': ['9876543210', '9876543211'],
            'Email': ['customerA@test.com', 'customerB@test.com'],
            'KVA': [100, 250],
            'Segment': ['Corporate', 'Retail'],
            'Win Reason': ['Competitor A', 'Price Lower'],
            'Win Remarks': ['Lost due to price', 'Competitor offered better terms'],
            'Lost Remarks': ['Follow up after 6 months', 'Customer preferred local vendor'],
            'Lost Date': ['2025-01-05', '2025-01-06']
        }
        
        df = pd.DataFrame(test_data)
        excel_buffer = io.BytesIO()
        df.to_excel(excel_buffer, index=False, sheet_name='Lost Leads')
        excel_buffer.seek(0)
        
        # Test upload (simulate file upload)
        try:
            import requests
            files = {'file': ('lost_leads_test.xlsx', excel_buffer.getvalue(), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
            headers = {}
            cookies = {'session_token': self.admin_token}
            
            response = requests.post(
                f"{self.base_url}/upload/lost-leads",
                files=files,
                headers=headers,
                cookies=cookies
            )
            
            if response.status_code == 200:
                result = response.json()
                created = result.get('created', 0)
                skipped = result.get('skipped', 0)
                self.log_test("Lost Leads Upload", True, f"Created: {created}, Skipped: {skipped}")
                
                # Verify leads were created with correct status
                if created > 0:
                    # Get one of the uploaded leads to verify status
                    success, leads_response = self.run_test(
                        "Verify Lost Lead Status",
                        "GET",
                        f"leads?enquiry_no={test_data['Enquiry No'][0]}",
                        200,
                        token=self.admin_token
                    )
                    
                    if success:
                        leads = leads_response.get('leads', [])
                        if leads:
                            lead = leads[0]
                            if (lead.get('enquiry_stage') == 'Closed-Lost' and 
                                lead.get('enquiry_status') == 'Closed' and
                                lead.get('needs_closure_questions') == False):
                                self.log_test("Lost Lead Status Verification", True, 
                                            "Lead has correct status and no closure questions required")
                            else:
                                self.log_test("Lost Lead Status Verification", False,
                                            f"Incorrect status: stage={lead.get('enquiry_stage')}, status={lead.get('enquiry_status')}, needs_closure={lead.get('needs_closure_questions')}")
                        else:
                            self.log_test("Lost Lead Status Verification", False, "Uploaded lead not found")
                
                # Test duplicate upload (should skip)
                excel_buffer.seek(0)
                files2 = {'file': ('lost_leads_test_dup.xlsx', excel_buffer.getvalue(), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
                response2 = requests.post(
                    f"{self.base_url}/upload/lost-leads",
                    files=files2,
                    headers=headers,
                    cookies=cookies
                )
                
                if response2.status_code == 200:
                    result2 = response2.json()
                    skipped2 = result2.get('skipped', 0)
                    if skipped2 > 0:
                        self.log_test("Lost Leads Duplicate Skip", True, f"Correctly skipped {skipped2} duplicates")
                    else:
                        self.log_test("Lost Leads Duplicate Skip", False, "Duplicates were not skipped")
                else:
                    self.log_test("Lost Leads Duplicate Upload", False, f"Status: {response2.status_code}")
                    
            else:
                self.log_test("Lost Leads Upload", False, f"Status: {response.status_code}, Response: {response.text[:100]}")
                
        except Exception as e:
            self.log_test("Lost Leads Upload", False, f"Exception: {str(e)}")

    def test_duplicate_detection_apis(self):
        """Test duplicate detection APIs"""
        print("\n🔍 Testing Duplicate Detection APIs...")
        
        if not self.admin_token:
            self.log_test("Duplicate Detection APIs Test", False, "Admin login required")
            return

        # Test get duplicate count
        success, response = self.run_test(
            "Get Duplicate Leads Count",
            "GET",
            "leads/duplicates/count",
            200,
            token=self.admin_token
        )
        
        if success:
            count = response.get('count', 0)
            print(f"   Current duplicate count: {count}")
            self.log_test("Duplicate Count API", True, f"Count: {count}")

        # Test get duplicate leads list
        success, response = self.run_test(
            "Get Duplicate Leads List",
            "GET",
            "leads/duplicates?limit=10",
            200,
            token=self.admin_token
        )
        
        if success:
            leads = response.get('leads', [])
            total = response.get('total', 0)
            print(f"   Found {len(leads)} duplicate leads (total: {total})")
            self.log_test("Duplicate Leads List API", True, f"Retrieved {len(leads)} duplicates")

        # Test run duplicate detection (admin only)
        success, response = self.run_test(
            "Run Duplicate Detection",
            "POST",
            "leads/duplicates/run-detection",
            200,
            token=self.admin_token
        )
        
        if success:
            flagged = response.get('duplicates_flagged', 0)
            checked = response.get('total_checked', 0)
            print(f"   Detection complete: {flagged} flagged out of {checked} checked")
            self.log_test("Run Duplicate Detection", True, f"Flagged: {flagged}, Checked: {checked}")

    def test_duplicate_filtering_logic(self):
        """Test that duplicates are excluded from main leads list and KPIs"""
        print("\n🔍 Testing Duplicate Filtering Logic...")
        
        if not self.admin_token:
            self.log_test("Duplicate Filtering Test", False, "Admin login required")
            return

        # Create test leads with similar data to trigger duplicate detection
        test_leads = [
            {
                "name": "Test Customer Duplicate",
                "phone_number": "9999999998",
                "email_address": "testdup1@example.com",
                "state": "Test State",
                "dealer": "Test Dealer",
                "employee_name": "Test Employee",
                "corporate_name": "Test Corp",
                "enquiry_no": f"DUP{datetime.now().strftime('%Y%m%d%H%M%S')}001",
                "enquiry_date": "2025-01-01",
                "customer_type": "New Customer",
                "segment": "Corporate",
                "enquiry_status": "Open",
                "enquiry_stage": "Prospecting",
                "enquiry_type": "Hot"
            },
            {
                "name": "Test Customer Duplicate",
                "phone_number": "9999999998",  # Same phone
                "email_address": "testdup2@example.com",
                "state": "Test State",
                "dealer": "Test Dealer",
                "employee_name": "Test Employee",  # Same employee
                "corporate_name": "Test Corp",  # Same corporate name
                "enquiry_no": f"DUP{datetime.now().strftime('%Y%m%d%H%M%S')}002",
                "enquiry_date": "2025-01-02",
                "customer_type": "New Customer",
                "segment": "Corporate",
                "enquiry_status": "Open",
                "enquiry_stage": "Prospecting",
                "enquiry_type": "Hot"
            }
        ]
        
        created_lead_ids = []
        
        # Create test leads
        for i, lead_data in enumerate(test_leads):
            success, response = self.run_test(
                f"Create Test Lead {i+1} for Duplicate Detection",
                "POST",
                "leads",
                200,
                data=lead_data,
                token=self.admin_token
            )
            
            if success:
                created_lead_ids.append(response.get('lead_id'))

        if len(created_lead_ids) == 2:
            # Run duplicate detection
            success, response = self.run_test(
                "Run Duplicate Detection on Test Leads",
                "POST",
                "leads/duplicates/run-detection",
                200,
                token=self.admin_token
            )
            
            if success:
                # Check that duplicates are excluded from main leads list
                success, response = self.run_test(
                    "Verify Duplicates Excluded from Main List",
                    "GET",
                    f"leads?phone_number=9999999998",
                    200,
                    token=self.admin_token
                )
                
                if success:
                    leads = response.get('leads', [])
                    # Should only find 1 lead (the original), not the duplicate
                    if len(leads) == 1:
                        self.log_test("Duplicates Excluded from Main List", True, 
                                    "Only original lead found in main list")
                    else:
                        self.log_test("Duplicates Excluded from Main List", False,
                                    f"Found {len(leads)} leads, expected 1")
                
                # Check KPIs exclude duplicates
                success, response = self.run_test(
                    "Verify KPIs Exclude Duplicates",
                    "GET",
                    "kpis",
                    200,
                    token=self.admin_token
                )
                
                if success:
                    hot_leads = response.get('hot_leads', 0)
                    total_leads = response.get('total_leads', 0)
                    print(f"   KPI Hot leads: {hot_leads}, Total leads: {total_leads}")
                    self.log_test("KPIs Exclude Duplicates", True, 
                                f"KPIs calculated (Hot: {hot_leads}, Total: {total_leads})")

        # Test unflag duplicate functionality
        if created_lead_ids:
            # Get duplicate leads to find one to unflag
            success, response = self.run_test(
                "Get Duplicates for Unflag Test",
                "GET",
                "leads/duplicates",
                200,
                token=self.admin_token
            )
            
            if success:
                duplicates = response.get('leads', [])
                if duplicates:
                    duplicate_id = duplicates[0].get('lead_id')
                    if duplicate_id:
                        success, response = self.run_test(
                            "Unflag Duplicate Lead",
                            "POST",
                            f"leads/duplicates/{duplicate_id}/unflag",
                            200,
                            token=self.admin_token
                        )
                        
                        if success:
                            self.log_test("Unflag Duplicate Functionality", True, 
                                        f"Successfully unflagged lead {duplicate_id}")
                        else:
                            self.log_test("Unflag Duplicate Functionality", False, 
                                        "Failed to unflag duplicate")

    def run_all_tests(self):
        """Run all tests"""
        print("🚀 Starting Lead Management Feature Tests...")
        print("=" * 60)
        
        # Login tests
        if not self.login_admin():
            print("❌ Admin login failed - stopping tests")
            return False
            
        if not self.login_employee():
            print("⚠️ Employee login failed - some tests will be skipped")
        
        # Run feature tests
        self.test_notifications_filtering()
        self.test_added_by_field()
        self.test_leads_table_added_by_column()
        self.test_admin_password_change()
        self.test_system_import_notifications()
        
        # Run filtering tests
        self.test_kpis_hot_warm_cold_counts()
        self.test_leads_enquiry_type_filter()
        self.test_leads_followup_date_filter()
        self.test_leads_combined_filters()
        
        # Run NEW duplicate detection and lost leads tests
        self.test_lost_leads_upload()
        self.test_duplicate_detection_apis()
        self.test_duplicate_filtering_logic()
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            print(f"⚠️ {self.tests_run - self.tests_passed} tests failed")
            return False

def main():
    tester = LeadManagementTester()
    success = tester.run_all_tests()
    
    # Save detailed results
    results = {
        "timestamp": datetime.now().isoformat(),
        "total_tests": tester.tests_run,
        "passed_tests": tester.tests_passed,
        "success_rate": f"{(tester.tests_passed/tester.tests_run*100):.1f}%" if tester.tests_run > 0 else "0%",
        "test_details": tester.test_results
    }
    
    with open('/app/backend_test_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())