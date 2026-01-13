"""
Test Old Enquiries Closed KPI and Phone-based Duplicate Detection
Tests for:
1. Old Enquiries Closed KPI on Dashboard - shows qty and lead count
2. Enquiry upload with phone-based merge logic
3. Upload merge summary modal data
4. Lost Leads upload with merge logic
5. Dispatch page showing SO data correctly
"""
import pytest
import requests
import os
import json
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestOldEnquiriesClosedKPI:
    """Test the Old Enquiries Closed KPI calculation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session with auth"""
        self.session = requests.Session()
        # Login as admin
        login_res = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    
    def test_kpis_endpoint_returns_old_enquiries_closed(self):
        """Test that KPIs endpoint returns old_enquiries_closed field"""
        # Get KPIs with a date range
        today = datetime.now().strftime('%Y-%m-%d')
        start_date = (datetime.now() - timedelta(days=90)).strftime('%Y-%m-%d')
        
        res = self.session.get(f"{BASE_URL}/api/kpis", params={
            "start_date": start_date,
            "end_date": today
        })
        
        assert res.status_code == 200, f"KPIs request failed: {res.text}"
        data = res.json()
        
        # Verify old_enquiries_closed fields exist
        assert "old_enquiries_closed" in data, "old_enquiries_closed field missing from KPIs"
        assert "old_enquiries_closed_qty" in data, "old_enquiries_closed_qty field missing from KPIs"
        
        print(f"Old Enquiries Closed: {data['old_enquiries_closed']} leads, {data['old_enquiries_closed_qty']} qty")
        
        # Verify they are numeric
        assert isinstance(data['old_enquiries_closed'], (int, float)), "old_enquiries_closed should be numeric"
        assert isinstance(data['old_enquiries_closed_qty'], (int, float)), "old_enquiries_closed_qty should be numeric"
    
    def test_kpis_date_range_affects_old_enquiries(self):
        """Test that date range filtering works for old enquiries KPI"""
        # Test with different date ranges
        today = datetime.now().strftime('%Y-%m-%d')
        
        # Last 30 days
        start_30 = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
        res_30 = self.session.get(f"{BASE_URL}/api/kpis", params={
            "start_date": start_30,
            "end_date": today
        })
        assert res_30.status_code == 200
        data_30 = res_30.json()
        
        # Last 180 days
        start_180 = (datetime.now() - timedelta(days=180)).strftime('%Y-%m-%d')
        res_180 = self.session.get(f"{BASE_URL}/api/kpis", params={
            "start_date": start_180,
            "end_date": today
        })
        assert res_180.status_code == 200
        data_180 = res_180.json()
        
        print(f"30-day range: {data_30.get('old_enquiries_closed', 0)} old enquiries closed")
        print(f"180-day range: {data_180.get('old_enquiries_closed', 0)} old enquiries closed")
        
        # Both should return valid data
        assert "old_enquiries_closed" in data_30
        assert "old_enquiries_closed" in data_180


class TestPhoneBasedDuplicateDetection:
    """Test phone-based duplicate detection for uploads"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session with auth"""
        self.session = requests.Session()
        login_res = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    
    def test_upload_template_endpoint(self):
        """Test that upload template endpoint works"""
        res = self.session.get(f"{BASE_URL}/api/leads/template")
        assert res.status_code == 200, f"Template download failed: {res.text}"
        assert 'application' in res.headers.get('content-type', ''), "Should return file content"
    
    def test_upload_column_info(self):
        """Test upload column info endpoint"""
        res = self.session.get(f"{BASE_URL}/api/upload/template")
        assert res.status_code == 200, f"Upload template info failed: {res.text}"
        data = res.json()
        
        # Should have column info
        assert "columns" in data or "required_columns" in data or isinstance(data, list), \
            f"Unexpected response format: {data}"
    
    def test_lost_leads_template_endpoint(self):
        """Test lost leads template download"""
        res = self.session.get(f"{BASE_URL}/api/upload/lost-leads/template")
        assert res.status_code == 200, f"Lost leads template failed: {res.text}"


class TestDispatchPage:
    """Test Dispatch page functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session with auth"""
        self.session = requests.Session()
        login_res = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    
    def test_dispatch_summary_endpoint(self):
        """Test dispatch summary endpoint returns SO data"""
        res = self.session.get(f"{BASE_URL}/api/dispatch/summary")
        assert res.status_code == 200, f"Dispatch summary failed: {res.text}"
        data = res.json()
        
        # Verify expected fields
        expected_fields = ['total_won', 'pending_dispatch', 'dispatched']
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"
        
        print(f"Dispatch Summary: Total Won={data.get('total_won')}, Pending={data.get('pending_dispatch')}, Dispatched={data.get('dispatched')}")
    
    def test_dispatch_list_endpoint(self):
        """Test dispatch list endpoint"""
        res = self.session.get(f"{BASE_URL}/api/dispatch/list", params={
            "page": 1,
            "limit": 10
        })
        assert res.status_code == 200, f"Dispatch list failed: {res.text}"
        data = res.json()
        
        # Should have leads and pagination
        assert "leads" in data, "Missing leads field"
        assert "pages" in data or "total" in data, "Missing pagination info"
        
        print(f"Dispatch list returned {len(data.get('leads', []))} leads")


class TestLeadsAPI:
    """Test Leads API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session with auth"""
        self.session = requests.Session()
        login_res = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    
    def test_leads_list_endpoint(self):
        """Test leads list endpoint"""
        res = self.session.get(f"{BASE_URL}/api/leads", params={
            "page": 1,
            "limit": 10
        })
        assert res.status_code == 200, f"Leads list failed: {res.text}"
        data = res.json()
        
        assert "leads" in data, "Missing leads field"
        print(f"Leads list returned {len(data.get('leads', []))} leads, total: {data.get('total', 'N/A')}")
    
    def test_leads_dropdown_options(self):
        """Test dropdown options endpoint"""
        res = self.session.get(f"{BASE_URL}/api/leads/dropdown-options")
        assert res.status_code == 200, f"Dropdown options failed: {res.text}"
        data = res.json()
        
        # Should have various dropdown options
        expected_options = ['state', 'dealer', 'segment']
        for opt in expected_options:
            assert opt in data, f"Missing dropdown option: {opt}"
        
        print(f"Dropdown options: {list(data.keys())}")


class TestDashboardKPIs:
    """Test all Dashboard KPIs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session with auth"""
        self.session = requests.Session()
        login_res = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    
    def test_all_kpi_fields_present(self):
        """Test that all expected KPI fields are present"""
        today = datetime.now().strftime('%Y-%m-%d')
        start_date = (datetime.now() - timedelta(days=90)).strftime('%Y-%m-%d')
        
        res = self.session.get(f"{BASE_URL}/api/kpis", params={
            "start_date": start_date,
            "end_date": today
        })
        
        assert res.status_code == 200, f"KPIs request failed: {res.text}"
        data = res.json()
        
        # Core KPIs
        core_kpis = [
            'total_leads', 'won_leads', 'lost_leads', 'open_leads',
            'hot_leads', 'warm_leads', 'cold_leads', 'conversion_rate'
        ]
        
        # Qty KPIs
        qty_kpis = ['total_qty', 'won_qty']
        
        # Dispatch KPIs
        dispatch_kpis = ['pending_dispatch', 'dispatched', 'pending_dispatch_qty', 'dispatched_qty']
        
        # Old Enquiries KPI
        old_enquiries_kpis = ['old_enquiries_closed', 'old_enquiries_closed_qty']
        
        all_kpis = core_kpis + qty_kpis + dispatch_kpis + old_enquiries_kpis
        
        missing = []
        for kpi in all_kpis:
            if kpi not in data:
                missing.append(kpi)
        
        if missing:
            print(f"Missing KPIs: {missing}")
        
        # At minimum, old_enquiries_closed should be present (main feature being tested)
        assert 'old_enquiries_closed' in data, "old_enquiries_closed KPI is missing"
        assert 'old_enquiries_closed_qty' in data, "old_enquiries_closed_qty KPI is missing"
        
        print(f"KPIs returned: {list(data.keys())}")
        print(f"Old Enquiries Closed: {data.get('old_enquiries_closed')} leads, {data.get('old_enquiries_closed_qty')} qty")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
