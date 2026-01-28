#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class EntityProfileTester:
    def __init__(self, base_url="https://tendersight.preview.emergentagent.com"):
        self.base_url = base_url
        self.session_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.session_token}'
        }

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {method} {url}")
        if params:
            print(f"   Params: {params}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=15)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, params=params, timeout=15)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, params=params, timeout=15)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Error: {response.text[:200]}")
                
                self.failed_tests.append({
                    "test": name,
                    "endpoint": endpoint,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "error": response.text[:200]
                })
                return False, {}

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
        
        login_data = {
            "username": "admin",
            "password": "admin123"
        }
        
        success, response = self.run_test("Login", "POST", "auth/login", 200, login_data)
        if success and 'token' in response:
            self.session_token = response['token']
            print(f"✅ Session token obtained: {self.session_token[:20]}...")
            return True
        else:
            print("❌ Failed to get session token")
            return False

    def test_entity_profile_main_issue(self):
        """Test the main issue: J.B ENTERPRISES profile with date filtering"""
        print("\n=== ENTITY PROFILE MAIN ISSUE TESTS ===")
        
        # Test 1: J.B ENTERPRISES without date filter (should use Indian FY default)
        print("\n🎯 Testing J.B ENTERPRISES Profile - Default Dates")
        
        success, profile_data = self.run_test(
            "J.B ENTERPRISES Profile - Default Dates", 
            "GET", 
            "entity/profile/dealer/J.B%20ENTERPRISES", 
            200
        )
        
        if success and profile_data:
            # Check date_range field
            date_range = profile_data.get("date_range")
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
            kpis = profile_data.get("kpis", {})
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
                elif won_leads == 0:
                    print(f"   ❌ Won leads is 0 - KPI cards appear empty")
                
                # Check KPI cards are not empty
                empty_kpis = [k for k, v in kpis.items() if v == 0 or v is None]
                if empty_kpis:
                    print(f"   ⚠️  Empty KPIs: {empty_kpis}")
                else:
                    print(f"   ✅ All KPIs have values")
            else:
                print(f"   ❌ KPIs section missing or empty")
        
        # Test 2: With explicit date range (Indian FY)
        print("\n🎯 Testing J.B ENTERPRISES Profile - Explicit Indian FY")
        
        params = {
            'start_date': '2025-04-01',
            'end_date': '2026-03-31'
        }
        
        success, profile_data = self.run_test(
            "J.B ENTERPRISES Profile - Explicit Indian FY", 
            "GET", 
            "entity/profile/dealer/J.B%20ENTERPRISES", 
            200,
            params=params
        )
        
        if success and profile_data:
            date_range = profile_data.get("date_range")
            if date_range:
                print(f"   ✅ Explicit date range: {date_range['start_date']} to {date_range['end_date']}")
            
            kpis = profile_data.get("kpis", {})
            if kpis:
                won_leads = kpis.get("won_leads", 0)
                print(f"   📊 Won leads with date filter: {won_leads}")

    def test_entity_config_apis(self):
        """Test Entity Configuration APIs"""
        print("\n=== ENTITY CONFIGURATION TESTS ===")
        
        # Test GET entity config
        success, config_data = self.run_test(
            "Get Entity Profile Config", 
            "GET", 
            "entity/config", 
            200
        )
        
        if success and config_data:
            required_config_keys = ["kpis", "charts", "sub_entities", "display_options"]
            missing_keys = [key for key in required_config_keys if key not in config_data]
            if not missing_keys:
                print(f"   ✅ Entity config structure complete")
                
                # Check KPI configuration
                kpis_config = config_data.get("kpis", {})
                enabled_kpis = kpis_config.get("enabled_kpis", [])
                print(f"   📊 Enabled KPIs: {len(enabled_kpis)} - {enabled_kpis[:3]}...")
                
                # Check charts configuration
                charts_config = config_data.get("charts", {})
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
        
        success, response = self.run_test(
            "Update Entity Profile Config", 
            "PUT", 
            "entity/config", 
            200,
            sample_config
        )
        
        if success:
            print(f"   ✅ Entity config updated successfully")

    def test_available_kpis_api(self):
        """Test Available KPIs API"""
        print("\n=== AVAILABLE KPIS TESTS ===")
        
        success, kpis_data = self.run_test(
            "Get Available KPIs", 
            "GET", 
            "entity/available-kpis", 
            200
        )
        
        if success and kpis_data:
            built_in = kpis_data.get("built_in_metrics", [])
            configurable = kpis_data.get("configurable_metrics", [])
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

    def test_entity_search(self):
        """Test Entity Search API"""
        print("\n=== ENTITY SEARCH TESTS ===")
        
        # Test search for J.B ENTERPRISES
        success, response = self.run_test(
            "Search Entities - J.B", 
            "GET", 
            "entity/search", 
            200,
            params={"q": "J.B"}
        )
        
        if success and response.get("results"):
            print(f"   ✓ Found {len(response['results'])} entities for 'J.B'")
            
            # Check if J.B ENTERPRISES is in results
            jb_found = any(r.get("name") == "J.B ENTERPRISES" for r in response["results"])
            if jb_found:
                print(f"   ✅ J.B ENTERPRISES found in search results")
            else:
                print(f"   ⚠️  J.B ENTERPRISES not found in search results")
                # Print what we found instead
                for result in response["results"][:3]:
                    print(f"       Found: {result.get('type')} - {result.get('name')}")

def main():
    print("🚀 Starting Entity Profile API Tests")
    print("=" * 50)
    
    tester = EntityProfileTester()
    
    # Test login first
    if not tester.test_login():
        print("❌ Login failed, stopping tests")
        return 1

    # Run entity profile tests
    tester.test_entity_profile_main_issue()
    tester.test_entity_config_apis()
    tester.test_available_kpis_api()
    tester.test_entity_search()

    # Print final results
    print(f"\n" + "=" * 50)
    print(f"📊 FINAL RESULTS")
    print(f"=" * 50)
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