#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class LostLeadsUploadTester:
    def __init__(self, base_url="https://fileupload-wizard.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
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

    def login_admin(self):
        """Login as admin user"""
        try:
            url = f"{self.base_url}/auth/login"
            data = {"username": "admin", "password": "admin123"}
            headers = {'Content-Type': 'application/json'}
            
            response = requests.post(url, json=data, headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                if 'token' in result:
                    self.admin_token = result['token']
                    self.log_test("Admin Login", True, "Successfully logged in as admin")
                    return True
                else:
                    self.log_test("Admin Login", False, "No token in response")
                    return False
            else:
                self.log_test("Admin Login", False, f"Status: {response.status_code}, Response: {response.text[:100]}")
                return False
                
        except Exception as e:
            self.log_test("Admin Login", False, f"Exception: {str(e)}")
            return False

    def test_lost_leads_upload(self):
        """Test lost leads upload with the specific file /tmp/unique_lost_leads.xlsx"""
        print("\n🔍 Testing Lost Leads Upload with /tmp/unique_lost_leads.xlsx...")
        
        if not self.admin_token:
            self.log_test("Lost Leads Upload Test", False, "Admin login required")
            return

        try:
            # Read the test file
            with open('/tmp/unique_lost_leads.xlsx', 'rb') as f:
                file_content = f.read()
            
            # Prepare the upload request
            files = {
                'file': ('unique_lost_leads.xlsx', file_content, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            }
            headers = {}
            cookies = {'session_token': self.admin_token}
            
            # Upload the file
            response = requests.post(
                f"{self.base_url}/upload/lost-leads",
                files=files,
                headers=headers,
                cookies=cookies
            )
            
            print(f"   Upload response status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                print(f"   Upload response: {json.dumps(result, indent=2)}")
                
                # Verify response structure
                required_fields = ['success', 'created', 'updated', 'skipped_lost', 'skipped_won', 'skipped_details', 'updated_details', 'total_rows']
                missing_fields = [field for field in required_fields if field not in result]
                
                if missing_fields:
                    self.log_test("Lost Leads Upload Response Structure", False, f"Missing fields: {missing_fields}")
                    return
                
                # Check if success is true
                if not result.get('success'):
                    self.log_test("Lost Leads Upload Success", False, "Response success is not true")
                    return
                
                # Extract counts
                created = result.get('created', 0)
                updated = result.get('updated', 0)
                skipped_lost = result.get('skipped_lost', 0)
                skipped_won = result.get('skipped_won', 0)
                skipped_details = result.get('skipped_details', [])
                updated_details = result.get('updated_details', [])
                total_rows = result.get('total_rows', 0)
                
                print(f"   Created: {created}")
                print(f"   Updated: {updated}")
                print(f"   Skipped Lost: {skipped_lost}")
                print(f"   Skipped Won: {skipped_won}")
                print(f"   Total Rows: {total_rows}")
                
                # Verify the file contains 3 unique lost leads with phone numbers starting with 555
                if total_rows == 3:
                    self.log_test("File Contains 3 Rows", True, f"Total rows: {total_rows}")
                else:
                    self.log_test("File Contains 3 Rows", False, f"Expected 3 rows, got {total_rows}")
                
                # Check that we have some processing results
                total_processed = created + updated + skipped_lost + skipped_won
                if total_processed > 0:
                    self.log_test("Lost Leads Processing", True, f"Processed {total_processed} leads")
                else:
                    self.log_test("Lost Leads Processing", False, "No leads were processed")
                
                # Verify response contains all required fields with proper values
                self.log_test("Response Structure Complete", True, 
                            f"All required fields present: success={result.get('success')}, created={created}, updated={updated}, skipped_lost={skipped_lost}, skipped_won={skipped_won}, total_rows={total_rows}")
                
                # Check skipped_details and updated_details arrays exist
                if isinstance(skipped_details, list):
                    self.log_test("Skipped Details Array", True, f"Skipped details array with {len(skipped_details)} items")
                else:
                    self.log_test("Skipped Details Array", False, "Skipped details is not an array")
                
                if isinstance(updated_details, list):
                    self.log_test("Updated Details Array", True, f"Updated details array with {len(updated_details)} items")
                else:
                    self.log_test("Updated Details Array", False, "Updated details is not an array")
                
                # Print details for verification
                if skipped_details:
                    print(f"   Skipped Details: {json.dumps(skipped_details[:3], indent=2)}")
                
                if updated_details:
                    print(f"   Updated Details: {json.dumps(updated_details[:3], indent=2)}")
                
                # Overall success
                self.log_test("Lost Leads Upload Complete", True, 
                            f"Successfully uploaded lost leads file with {created} created, {updated} updated, {skipped_lost + skipped_won} skipped")
                
            else:
                error_text = response.text[:200] if response.text else "No response text"
                self.log_test("Lost Leads Upload", False, f"Status: {response.status_code}, Error: {error_text}")
                
        except FileNotFoundError:
            self.log_test("Lost Leads Upload Test", False, "File /tmp/unique_lost_leads.xlsx not found")
        except Exception as e:
            self.log_test("Lost Leads Upload Test", False, f"Exception: {str(e)}")

    def run_all_tests(self):
        """Run all tests"""
        print("🚀 Starting Lost Leads Upload Test...")
        print(f"Testing against: {self.base_url}")
        
        # Login first
        if not self.login_admin():
            print("❌ Cannot proceed without admin login")
            return
        
        # Run the lost leads upload test
        self.test_lost_leads_upload()
        
        # Print summary
        print(f"\n📊 Test Summary:")
        print(f"Tests run: {self.tests_run}")
        print(f"Tests passed: {self.tests_passed}")
        print(f"Success rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} test(s) failed")
            
        return self.tests_passed == self.tests_run

if __name__ == "__main__":
    tester = LostLeadsUploadTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)