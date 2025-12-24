#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class LeadManagementTester:
    def __init__(self, base_url="https://sharda-insights.preview.emergentagent.com/api"):
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
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        
        if success:
            # Test that employee can see this in notifications
            if self.employee_token:
                success, response = self.run_test(
                    "Employee Sees System Import Notification",
                    "GET",
                    "notifications",
                    200,
                    headers={"Authorization": f"Bearer {self.employee_token}"}
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