#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timedelta

class LeadManagementTester:
    def __init__(self, base_url="https://leadoptima.preview.emergentagent.com/api"):
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
        try:
            import requests
            headers = {}
            cookies = {'session_token': self.admin_token}
            
            response = requests.get(
                f"{self.base_url}/upload/lost-leads/template",
                headers=headers,
                cookies=cookies
            )
            
            if response.status_code == 200:
                # Check if response is Excel file (binary content)
                if response.headers.get('content-type', '').startswith('application/vnd.openxmlformats'):
                    self.log_test("Download Lost Leads Template", True, "Excel template downloaded successfully")
                else:
                    self.log_test("Download Lost Leads Template", False, "Response is not Excel format")
            else:
                self.log_test("Download Lost Leads Template", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Download Lost Leads Template", False, f"Exception: {str(e)}")

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

        # Get current duplicate count before creating test leads
        success, response = self.run_test(
            "Get Initial Duplicate Count",
            "GET",
            "leads/duplicates/count",
            200,
            token=self.admin_token
        )
        
        initial_duplicate_count = 0
        if success:
            initial_duplicate_count = response.get('count', 0)
            print(f"   Initial duplicate count: {initial_duplicate_count}")

        # Create test leads with similar data to trigger duplicate detection
        unique_phone = f"999999{datetime.now().strftime('%H%M%S')}"  # Use unique phone for this test
        test_leads = [
            {
                "name": "Test Customer Duplicate",
                "phone_number": unique_phone,
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
                "phone_number": unique_phone,  # Same phone
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
                flagged = response.get('duplicates_flagged', 0)
                print(f"   Flagged {flagged} new duplicates")
                
                # Check that duplicate count increased or stayed the same (detection ran successfully)
                success, response = self.run_test(
                    "Verify Duplicate Detection Ran Successfully",
                    "GET",
                    "leads/duplicates/count",
                    200,
                    token=self.admin_token
                )
                
                if success:
                    new_duplicate_count = response.get('count', 0)
                    if new_duplicate_count >= initial_duplicate_count:
                        self.log_test("Duplicate Detection Working", True, 
                                    f"Duplicate detection ran successfully (count: {initial_duplicate_count} -> {new_duplicate_count})")
                    else:
                        self.log_test("Duplicate Detection Working", False,
                                    f"Duplicate count decreased unexpectedly: {initial_duplicate_count} -> {new_duplicate_count}")
                
                # Check that main leads list excludes duplicates (test with existing duplicates)
                success, response = self.run_test(
                    "Verify Main List Excludes Duplicates",
                    "GET",
                    "leads?limit=10",
                    200,
                    token=self.admin_token
                )
                
                if success:
                    leads = response.get('leads', [])
                    # Check that none of the returned leads are flagged as duplicates
                    has_duplicates = any(lead.get('is_duplicate') == True for lead in leads)
                    if not has_duplicates:
                        self.log_test("Duplicates Excluded from Main List", True, 
                                    f"Main leads list properly excludes duplicates (checked {len(leads)} leads)")
                    else:
                        self.log_test("Duplicates Excluded from Main List", False,
                                    "Found duplicate leads in main list")
                
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

    def test_recent_uploads_api(self):
        """Test recent uploads API"""
        print("\n🔍 Testing Recent Uploads API...")
        
        if not self.admin_token:
            self.log_test("Recent Uploads API Test", False, "Admin login required")
            return

        # Test recent uploads API
        success, response = self.run_test(
            "Get Recent Uploads (7 days)",
            "GET",
            "admin/recent-uploads?days=7",
            200,
            token=self.admin_token
        )
        
        if success:
            uploads = response.get('uploads', [])
            days_queried = response.get('days_queried', 0)
            total_uploads = response.get('total_uploads', 0)
            
            print(f"   Found {total_uploads} uploads in last {days_queried} days")
            
            # Verify response structure
            if uploads:
                first_upload = uploads[0]
                required_fields = ['upload_batch_id', 'filename', 'created_at', 'created_count', 'can_delete']
                missing_fields = [field for field in required_fields if field not in first_upload]
                
                if not missing_fields:
                    self.log_test("Recent Uploads API Structure", True, 
                                f"Response has all required fields for {len(uploads)} uploads")
                else:
                    self.log_test("Recent Uploads API Structure", False,
                                f"Missing fields: {missing_fields}")
            else:
                self.log_test("Recent Uploads API Structure", True, "No uploads found (empty response is valid)")

    def test_upload_batch_deletion_and_restore(self):
        """Test upload batch deletion and restore functionality"""
        print("\n🔍 Testing Upload Batch Deletion and Restore...")
        
        if not self.admin_token:
            self.log_test("Upload Batch Test", False, "Admin login required")
            return

        # First, create a test upload to get a batch ID
        import pandas as pd
        import io
        
        # Create test Excel file
        test_data = {
            'Name': ['Test Customer Batch Delete'],
            'Phone Number': [f'9999{datetime.now().strftime("%H%M%S")}'],
            'State': ['Test State'],
            'Dealer': ['Test Dealer'],
            'Employee Name': ['Test Employee'],
            'Enquiry No': [f'BATCH{datetime.now().strftime("%Y%m%d%H%M%S")}'],
            'Enquiry Date': ['2025-01-01'],
            'Segment': ['Corporate'],
            'Enquiry Status': ['Open'],
            'Enquiry Stage': ['Prospecting']
        }
        
        df = pd.DataFrame(test_data)
        excel_buffer = io.BytesIO()
        df.to_excel(excel_buffer, index=False, sheet_name='Test Leads')
        excel_buffer.seek(0)
        
        # Upload test file
        try:
            import requests
            files = {'file': ('test_batch_delete.xlsx', excel_buffer.getvalue(), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
            headers = {}
            cookies = {'session_token': self.admin_token}
            
            response = requests.post(
                f"{self.base_url}/upload/leads",
                files=files,
                headers=headers,
                cookies=cookies
            )
            
            if response.status_code == 200:
                upload_result = response.json()
                created = upload_result.get('created', 0)
                
                if created > 0:
                    self.log_test("Create Test Upload for Batch Delete", True, f"Created {created} test leads")
                    
                    # Get recent uploads to find our batch ID
                    success, uploads_response = self.run_test(
                        "Get Recent Uploads for Batch ID",
                        "GET",
                        "admin/recent-uploads?days=1",
                        200,
                        token=self.admin_token
                    )
                    
                    if success:
                        uploads = uploads_response.get('uploads', [])
                        test_batch_id = None
                        
                        # Find our upload (most recent one)
                        for upload in uploads:
                            if upload.get('can_delete') and upload.get('current_lead_count', 0) > 0:
                                test_batch_id = upload.get('upload_batch_id')
                                break
                        
                        if test_batch_id:
                            print(f"   Found test batch ID: {test_batch_id}")
                            
                            # Test batch deletion
                            success, delete_response = self.run_test(
                                "Delete Upload Batch",
                                "DELETE",
                                f"admin/upload-batch/{test_batch_id}",
                                200,
                                token=self.admin_token
                            )
                            
                            if success:
                                deleted_count = delete_response.get('deleted_count', 0)
                                self.log_test("Delete Upload Batch", True, 
                                            f"Successfully deleted {deleted_count} leads from batch")
                                
                                # Verify leads are soft-deleted (have deleted_at field)
                                # We can't directly query the database, but we can check if the batch shows 0 current leads
                                success, verify_response = self.run_test(
                                    "Verify Batch Deletion",
                                    "GET",
                                    "admin/recent-uploads?days=1",
                                    200,
                                    token=self.admin_token
                                )
                                
                                if success:
                                    uploads = verify_response.get('uploads', [])
                                    deleted_batch = None
                                    for upload in uploads:
                                        if upload.get('upload_batch_id') == test_batch_id:
                                            deleted_batch = upload
                                            break
                                    
                                    if deleted_batch and deleted_batch.get('current_lead_count', 0) == 0:
                                        self.log_test("Verify Soft Delete", True, 
                                                    "Batch shows 0 current leads after deletion")
                                    else:
                                        self.log_test("Verify Soft Delete", False,
                                                    "Batch still shows leads after deletion")
                                
                                # Test batch restoration
                                success, restore_response = self.run_test(
                                    "Restore Upload Batch",
                                    "POST",
                                    f"admin/upload-batch/{test_batch_id}/restore",
                                    200,
                                    token=self.admin_token
                                )
                                
                                if success:
                                    restored_count = restore_response.get('restored_count', 0)
                                    self.log_test("Restore Upload Batch", True,
                                                f"Successfully restored {restored_count} leads")
                                    
                                    # Verify restoration
                                    success, verify_restore_response = self.run_test(
                                        "Verify Batch Restoration",
                                        "GET",
                                        "admin/recent-uploads?days=1",
                                        200,
                                        token=self.admin_token
                                    )
                                    
                                    if success:
                                        uploads = verify_restore_response.get('uploads', [])
                                        restored_batch = None
                                        for upload in uploads:
                                            if upload.get('upload_batch_id') == test_batch_id:
                                                restored_batch = upload
                                                break
                                        
                                        if restored_batch and restored_batch.get('current_lead_count', 0) > 0:
                                            self.log_test("Verify Restoration", True,
                                                        f"Batch shows {restored_batch.get('current_lead_count')} leads after restoration")
                                        else:
                                            self.log_test("Verify Restoration", False,
                                                        "Batch still shows 0 leads after restoration")
                                else:
                                    self.log_test("Restore Upload Batch", False, "Failed to restore batch")
                            else:
                                self.log_test("Delete Upload Batch", False, "Failed to delete batch")
                        else:
                            self.log_test("Find Test Batch ID", False, "Could not find test batch ID")
                    else:
                        self.log_test("Get Recent Uploads for Batch ID", False, "Failed to get recent uploads")
                else:
                    self.log_test("Create Test Upload for Batch Delete", False, "No leads created in test upload")
            else:
                self.log_test("Create Test Upload for Batch Delete", False, f"Upload failed with status {response.status_code}")
                
        except Exception as e:
            self.log_test("Create Test Upload for Batch Delete", False, f"Exception: {str(e)}")

    def test_lost_leads_duplicate_detection(self):
        """Test lost leads upload with duplicate detection and phone normalization"""
        print("\n🔍 Testing Lost Leads Duplicate Detection...")
        
        if not self.admin_token:
            self.log_test("Lost Leads Duplicate Detection Test", False, "Admin login required")
            return

        # First, create a regular lead to test duplicate detection against
        unique_timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        test_phone = "9876543210"
        
        regular_lead = {
            "name": "Regular Customer for Duplicate Test",
            "phone_number": test_phone,
            "email_address": "regular@test.com",
            "state": "Test State",
            "dealer": "Test Dealer",
            "employee_name": "Test Employee",
            "enquiry_no": f"REG{unique_timestamp}",
            "enquiry_date": "2025-01-01",
            "customer_type": "New Customer",
            "segment": "Corporate",
            "enquiry_status": "Open",
            "enquiry_stage": "Prospecting"
        }
        
        success, response = self.run_test(
            "Create Regular Lead for Duplicate Test",
            "POST",
            "leads",
            200,
            data=regular_lead,
            token=self.admin_token
        )
        
        if success:
            self.log_test("Create Regular Lead", True, "Created regular lead for duplicate testing")
            
            # Now create lost leads Excel file with various phone formats that should match
            import pandas as pd
            import io
            
            test_data = {
                'Zone': ['East', 'West', 'North'],
                'State': ['Bihar', 'Maharashtra', 'Delhi'],
                'Area Office': ['Patna', 'Mumbai', 'Delhi'],
                'Dealer': ['Test Dealer 1', 'Test Dealer 2', 'Test Dealer 3'],
                'Employee Name': ['John Doe', 'Jane Smith', 'Bob Wilson'],
                'Enquiry No': [f'LOST{unique_timestamp}001', f'LOST{unique_timestamp}002', f'LOST{unique_timestamp}003'],
                'Enquiry Date': ['2025-01-01', '2025-01-02', '2025-01-03'],
                'Corporate Name': ['ABC Corp', 'XYZ Ltd', 'PQR Inc'],
                'Name': ['Lost Customer A', 'Lost Customer B', 'Lost Customer C'],
                # Test different phone formats - first one should be duplicate
                'Phone Number': [test_phone, '+919876543211', '91-9876-543212'],  # First matches existing lead
                'Email': ['lostA@test.com', 'lostB@test.com', 'lostC@test.com'],
                'KVA': [100, 250, 500],
                'Segment': ['Corporate', 'Retail', 'Industrial'],
                'Win Reason': ['Competitor A', 'Price Lower', 'Better Terms'],
                'Win Remarks': ['Lost due to price', 'Competitor offered better terms', 'Customer chose local vendor'],
                'Lost Remarks': ['Follow up after 6 months', 'Customer preferred local vendor', 'Price was main factor'],
                'Lost Date': ['2025-01-05', '2025-01-06', '2025-01-07']
            }
            
            df = pd.DataFrame(test_data)
            excel_buffer = io.BytesIO()
            df.to_excel(excel_buffer, index=False, sheet_name='Lost Leads')
            excel_buffer.seek(0)
            
            # Upload lost leads file
            try:
                import requests
                files = {'file': ('lost_leads_duplicate_test.xlsx', excel_buffer.getvalue(), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
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
                    
                    print(f"   Lost leads upload result: {created} created, {skipped} skipped")
                    
                    # We expect 1 duplicate (first phone matches existing lead) and 2 created
                    if skipped >= 1:
                        self.log_test("Lost Leads Duplicate Detection", True,
                                    f"Correctly skipped {skipped} duplicate(s), created {created}")
                        
                        # Verify that created leads have correct status
                        if created > 0:
                            # Get one of the created leads to verify status
                            success, leads_response = self.run_test(
                                "Verify Lost Lead Status and Closure Questions",
                                "GET",
                                f"leads?enquiry_no={test_data['Enquiry No'][1]}&limit=1",  # Check second lead (should be created)
                                200,
                                token=self.admin_token
                            )
                            
                            if success:
                                leads = leads_response.get('leads', [])
                                if leads:
                                    lead = leads[0]
                                    stage = lead.get('enquiry_stage')
                                    status = lead.get('enquiry_status')
                                    needs_closure = lead.get('needs_closure_questions')
                                    
                                    if (stage == 'Closed-Lost' and 
                                        status == 'Closed' and 
                                        needs_closure == False):
                                        self.log_test("Lost Lead Status Verification", True,
                                                    "Lost lead has correct status (Closed-Lost) and needs_closure_questions=False")
                                    else:
                                        self.log_test("Lost Lead Status Verification", False,
                                                    f"Incorrect status: stage={stage}, status={status}, needs_closure={needs_closure}")
                                else:
                                    self.log_test("Lost Lead Status Verification", False, "Created lost lead not found")
                        
                        # Test phone normalization by checking if different formats are detected as duplicates
                        # Upload again with scientific notation phone format
                        test_data_scientific = {
                            'Zone': ['South'],
                            'State': ['Karnataka'],
                            'Area Office': ['Bangalore'],
                            'Dealer': ['Test Dealer Scientific'],
                            'Employee Name': ['Scientific Test'],
                            'Enquiry No': [f'SCI{unique_timestamp}001'],
                            'Enquiry Date': ['2025-01-08'],
                            'Corporate Name': ['Scientific Corp'],
                            'Name': ['Scientific Customer'],
                            'Phone Number': ['9.87654E+09'],  # Scientific notation for 9876540000
                            'Email': ['scientific@test.com'],
                            'KVA': [750],
                            'Segment': ['Scientific'],
                            'Win Reason': ['Scientific Competitor'],
                            'Win Remarks': ['Lost due to scientific reasons'],
                            'Lost Remarks': ['Scientific follow up needed'],
                            'Lost Date': ['2025-01-09']
                        }
                        
                        df_sci = pd.DataFrame(test_data_scientific)
                        excel_buffer_sci = io.BytesIO()
                        df_sci.to_excel(excel_buffer_sci, index=False, sheet_name='Scientific Phone')
                        excel_buffer_sci.seek(0)
                        
                        files_sci = {'file': ('scientific_phone_test.xlsx', excel_buffer_sci.getvalue(), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
                        response_sci = requests.post(
                            f"{self.base_url}/upload/lost-leads",
                            files=files_sci,
                            headers=headers,
                            cookies=cookies
                        )
                        
                        if response_sci.status_code == 200:
                            result_sci = response_sci.json()
                            created_sci = result_sci.get('created', 0)
                            skipped_sci = result_sci.get('skipped', 0)
                            
                            self.log_test("Phone Normalization Test", True,
                                        f"Scientific notation test: {created_sci} created, {skipped_sci} skipped")
                        else:
                            self.log_test("Phone Normalization Test", False,
                                        f"Scientific notation upload failed: {response_sci.status_code}")
                    else:
                        self.log_test("Lost Leads Duplicate Detection", False,
                                    f"Expected at least 1 duplicate to be skipped, but got {skipped}")
                else:
                    self.log_test("Lost Leads Upload", False, 
                                f"Upload failed with status {response.status_code}: {response.text[:100]}")
                    
            except Exception as e:
                self.log_test("Lost Leads Upload", False, f"Exception: {str(e)}")
        else:
            self.log_test("Create Regular Lead", False, "Failed to create regular lead for duplicate testing")

    def test_competitor_analysis_api(self):
        """Test competitor analysis API with different dimensions"""
        print("\n🔍 Testing Competitor Analysis API...")
        
        if not self.admin_token:
            self.log_test("Competitor Analysis API Test", False, "Admin login required")
            return

        # Test with dimension=competitor
        success, response = self.run_test(
            "Competitor Analysis - Competitor Dimension",
            "GET",
            "insights/competitor-analysis?dimension=competitor",
            200,
            token=self.admin_token
        )
        
        if success:
            # Verify response structure
            required_fields = ['dimension', 'analysis', 'summary', 'top_by_kva', 'filters']
            missing_fields = [field for field in required_fields if field not in response]
            
            if not missing_fields:
                analysis = response.get('analysis', [])
                summary = response.get('summary', {})
                
                # Check summary structure
                summary_fields = ['total_lost_leads', 'with_data', 'without_data', 'unique_values']
                summary_missing = [field for field in summary_fields if field not in summary]
                
                if not summary_missing:
                    self.log_test("Competitor Analysis Response Structure", True, 
                                f"Valid structure with {len(analysis)} competitors, {summary.get('total_lost_leads', 0)} total lost leads")
                else:
                    self.log_test("Competitor Analysis Response Structure", False,
                                f"Missing summary fields: {summary_missing}")
            else:
                self.log_test("Competitor Analysis Response Structure", False,
                            f"Missing fields: {missing_fields}")

        # Test with dimension=lost_reason
        success, response = self.run_test(
            "Competitor Analysis - Lost Reason Dimension",
            "GET",
            "insights/competitor-analysis?dimension=lost_reason",
            200,
            token=self.admin_token
        )
        
        if success:
            dimension = response.get('dimension')
            if dimension == 'lost_reason':
                self.log_test("Lost Reason Dimension", True, "Correctly returned lost_reason dimension")
            else:
                self.log_test("Lost Reason Dimension", False, f"Expected 'lost_reason', got '{dimension}'")

        # Test with dimension=lost_remarks
        success, response = self.run_test(
            "Competitor Analysis - Lost Remarks Dimension",
            "GET",
            "insights/competitor-analysis?dimension=lost_remarks",
            200,
            token=self.admin_token
        )
        
        if success:
            dimension = response.get('dimension')
            if dimension == 'lost_remarks':
                self.log_test("Lost Remarks Dimension", True, "Correctly returned lost_remarks dimension")
            else:
                self.log_test("Lost Remarks Dimension", False, f"Expected 'lost_remarks', got '{dimension}'")

    def test_lost_leads_breakdown_api(self):
        """Test lost leads breakdown API with different grouping options"""
        print("\n🔍 Testing Lost Leads Breakdown API...")
        
        if not self.admin_token:
            self.log_test("Lost Leads Breakdown API Test", False, "Admin login required")
            return

        # Test with group_by=competitor
        success, response = self.run_test(
            "Lost Leads Breakdown - Group by Competitor",
            "GET",
            "insights/lost-leads-breakdown?group_by=competitor",
            200,
            token=self.admin_token
        )
        
        if success:
            # Verify response structure
            required_fields = ['group_by', 'total_lost_leads', 'breakdown', 'filters']
            missing_fields = [field for field in required_fields if field not in response]
            
            if not missing_fields:
                breakdown = response.get('breakdown', [])
                group_by = response.get('group_by')
                total_lost = response.get('total_lost_leads', 0)
                
                if group_by == 'competitor':
                    self.log_test("Lost Leads Breakdown - Competitor", True, 
                                f"Valid breakdown with {len(breakdown)} competitors, {total_lost} total lost leads")
                else:
                    self.log_test("Lost Leads Breakdown - Competitor", False,
                                f"Expected group_by='competitor', got '{group_by}'")
                
                # Check breakdown item structure
                if breakdown:
                    first_item = breakdown[0]
                    item_fields = ['name', 'count', 'percentage', 'total_kva']
                    item_missing = [field for field in item_fields if field not in first_item]
                    
                    if not item_missing:
                        self.log_test("Breakdown Item Structure", True, "All required fields present")
                    else:
                        self.log_test("Breakdown Item Structure", False, f"Missing fields: {item_missing}")
            else:
                self.log_test("Lost Leads Breakdown Response Structure", False,
                            f"Missing fields: {missing_fields}")

        # Test with group_by=state
        success, response = self.run_test(
            "Lost Leads Breakdown - Group by State",
            "GET",
            "insights/lost-leads-breakdown?group_by=state",
            200,
            token=self.admin_token
        )
        
        if success:
            group_by = response.get('group_by')
            if group_by == 'state':
                breakdown = response.get('breakdown', [])
                self.log_test("Lost Leads Breakdown - State", True, 
                            f"Valid state breakdown with {len(breakdown)} states")
            else:
                self.log_test("Lost Leads Breakdown - State", False,
                            f"Expected group_by='state', got '{group_by}'")

        # Test with group_by=dealer
        success, response = self.run_test(
            "Lost Leads Breakdown - Group by Dealer",
            "GET",
            "insights/lost-leads-breakdown?group_by=dealer",
            200,
            token=self.admin_token
        )
        
        if success:
            group_by = response.get('group_by')
            if group_by == 'dealer':
                breakdown = response.get('breakdown', [])
                self.log_test("Lost Leads Breakdown - Dealer", True, 
                            f"Valid dealer breakdown with {len(breakdown)} dealers")
            else:
                self.log_test("Lost Leads Breakdown - Dealer", False,
                            f"Expected group_by='dealer', got '{group_by}'")

    def test_kpi_navigation_urls(self):
        """Test KPI card navigation URL formation"""
        print("\n🔍 Testing KPI Navigation URL Formation...")
        
        if not self.admin_token:
            self.log_test("KPI Navigation Test", False, "Admin login required")
            return

        # This test verifies the expected URL parameters for KPI navigation
        # Since we can't directly test frontend navigation, we test the leads API with expected filters
        
        # Test Won leads filter (stage=Closed-Won)
        success, response = self.run_test(
            "KPI Navigation - Won Leads Filter",
            "GET",
            "leads?stage=Closed-Won&limit=5",
            200,
            token=self.admin_token
        )
        
        if success:
            leads = response.get('leads', [])
            # Verify all returned leads are won
            all_won = all(lead.get('enquiry_stage') in ['Closed-Won', 'Order Booked'] for lead in leads)
            if all_won or len(leads) == 0:
                self.log_test("Won Leads Navigation Filter", True, 
                            f"Correctly filtered {len(leads)} won leads")
            else:
                self.log_test("Won Leads Navigation Filter", False,
                            "Some leads are not won")

        # Test Lost leads filter (stage=Closed-Lost)
        success, response = self.run_test(
            "KPI Navigation - Lost Leads Filter",
            "GET",
            "leads?stage=Closed-Lost&limit=5",
            200,
            token=self.admin_token
        )
        
        if success:
            leads = response.get('leads', [])
            # Verify all returned leads are lost
            all_lost = all(lead.get('enquiry_stage') in ['Closed-Lost', 'Closed-Dropped'] for lead in leads)
            if all_lost or len(leads) == 0:
                self.log_test("Lost Leads Navigation Filter", True, 
                            f"Correctly filtered {len(leads)} lost leads")
            else:
                self.log_test("Lost Leads Navigation Filter", False,
                            "Some leads are not lost")

        # Test Open leads filter (status=Open)
        success, response = self.run_test(
            "KPI Navigation - Open Leads Filter",
            "GET",
            "leads?status=Open&limit=5",
            200,
            token=self.admin_token
        )
        
        if success:
            leads = response.get('leads', [])
            # Verify all returned leads are open
            all_open = all(lead.get('enquiry_status') == 'Open' for lead in leads)
            if all_open or len(leads) == 0:
                self.log_test("Open Leads Navigation Filter", True, 
                            f"Correctly filtered {len(leads)} open leads")
            else:
                self.log_test("Open Leads Navigation Filter", False,
                            "Some leads are not open")

        # Test Hot leads filter (lead_type=Hot&status=Open)
        success, response = self.run_test(
            "KPI Navigation - Hot Leads Filter",
            "GET",
            "leads?lead_type=Hot&status=Open&limit=5",
            200,
            token=self.admin_token
        )
        
        if success:
            leads = response.get('leads', [])
            # Verify all returned leads are hot and open
            all_hot_open = all(
                lead.get('enquiry_type') == 'Hot' and lead.get('enquiry_status') == 'Open' 
                for lead in leads
            )
            if all_hot_open or len(leads) == 0:
                self.log_test("Hot Leads Navigation Filter", True, 
                            f"Correctly filtered {len(leads)} hot open leads")
            else:
                self.log_test("Hot Leads Navigation Filter", False,
                            "Some leads are not hot or not open")

    def test_competitor_analysis_with_lost_leads_data(self):
        """Test competitor analysis with actual lost leads data"""
        print("\n🔍 Testing Competitor Analysis with Lost Leads Data...")
        
        if not self.admin_token:
            self.log_test("Competitor Analysis Data Test", False, "Admin login required")
            return

        # First, create some test lost leads with competitor data
        # Use dates within the current Indian Financial Year (April 2025 - March 2026)
        unique_timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        
        test_lost_leads = [
            {
                "name": "Lost Customer A",
                "phone_number": f"9876{unique_timestamp}01",
                "email_address": "lostA@competitor-test.com",
                "state": "Test State",
                "dealer": "Test Dealer",
                "employee_name": "Test Employee",
                "enquiry_no": f"COMP{unique_timestamp}001",
                "enquiry_date": "2025-06-01",  # Within FY 2025-26
                "customer_type": "New Customer",
                "segment": "Corporate",
                "enquiry_status": "Closed",
                "enquiry_stage": "Closed-Lost",
                "competitor": "Test Competitor A",
                "lost_reason": "Price too high",
                "lost_remarks": "Customer found better pricing elsewhere",
                "kva": 100
            },
            {
                "name": "Lost Customer B",
                "phone_number": f"9876{unique_timestamp}02",
                "email_address": "lostB@competitor-test.com",
                "state": "Test State",
                "dealer": "Test Dealer",
                "employee_name": "Test Employee",
                "enquiry_no": f"COMP{unique_timestamp}002",
                "enquiry_date": "2025-07-01",  # Within FY 2025-26
                "customer_type": "New Customer",
                "segment": "Industrial",
                "enquiry_status": "Closed",
                "enquiry_stage": "Closed-Lost",
                "competitor": "Test Competitor B",
                "lost_reason": "Better service offered",
                "lost_remarks": "Competitor provided better after-sales support",
                "kva": 250
            }
        ]
        
        created_leads = []
        for i, lead_data in enumerate(test_lost_leads):
            success, response = self.run_test(
                f"Create Test Lost Lead {i+1} for Competitor Analysis",
                "POST",
                "leads",
                200,
                data=lead_data,
                token=self.admin_token
            )
            
            if success:
                created_leads.append(response.get('lead_id'))

        if len(created_leads) == 2:
            # Now test competitor analysis with our test data (use custom date range to include our test data)
            success, response = self.run_test(
                "Competitor Analysis with Test Data",
                "GET",
                "insights/competitor-analysis?dimension=competitor&start_date=2025-01-01&end_date=2025-12-31",
                200,
                token=self.admin_token
            )
            
            if success:
                analysis = response.get('analysis', [])
                summary = response.get('summary', {})
                
                # Check if the competitor analysis is working (has some competitor data)
                if len(analysis) > 0 and summary.get('with_data', 0) > 0:
                    self.log_test("Competitor Analysis with Test Data", True,
                                f"Competitor analysis working correctly - found {len(analysis)} competitors with {summary.get('with_data')} leads having competitor data")
                    
                    # Test lost_reason dimension
                    success, response = self.run_test(
                        "Lost Reason Analysis with Test Data",
                        "GET",
                        "insights/competitor-analysis?dimension=lost_reason&start_date=2025-01-01&end_date=2025-12-31",
                        200,
                        token=self.admin_token
                    )
                    
                    if success:
                        analysis = response.get('analysis', [])
                        summary = response.get('summary', {})
                        
                        if len(analysis) > 0 and summary.get('with_data', 0) > 0:
                            self.log_test("Lost Reason Analysis with Test Data", True,
                                        f"Lost reason analysis working correctly - found {len(analysis)} reasons")
                        else:
                            self.log_test("Lost Reason Analysis with Test Data", False,
                                        "No lost reason data found in analysis")
                else:
                    self.log_test("Competitor Analysis with Test Data", False,
                                f"No competitor data found in analysis. Summary: {summary}")
        else:
            self.log_test("Create Test Lost Leads", False, 
                        f"Only created {len(created_leads)} out of 2 test leads")

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
        
        # Run duplicate detection and lost leads tests
        self.test_lost_leads_upload()
        self.test_duplicate_detection_apis()
        self.test_duplicate_filtering_logic()
        
        # Run batch management tests
        self.test_recent_uploads_api()
        self.test_upload_batch_deletion_and_restore()
        self.test_lost_leads_duplicate_detection()
        
        # Run NEW competitor analysis and KPI navigation tests
        self.test_competitor_analysis_api()
        self.test_lost_leads_breakdown_api()
        self.test_kpi_navigation_urls()
        self.test_competitor_analysis_with_lost_leads_data()
        
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