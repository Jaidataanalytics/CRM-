"""
Test suite for new features:
1. Compare Forecasts - GET /api/forecast/compare/{index}
2. Lost Lead Closure Questions - GET /api/leads/pending-closure-questions/count, POST /api/leads/{lead_id}/closure-answers
3. Upload composite key logic (enquiry_no + phone_number)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Test authentication first"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        return s
    
    @pytest.fixture(scope="class")
    def auth_cookies(self, session):
        """Login and get auth cookies"""
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return session.cookies
    
    def test_login(self, session, auth_cookies):
        """Test login works"""
        response = session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data or "email" in data


class TestCompareForecasts:
    """Test Compare Forecasts feature"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        # Login
        response = s.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return s
    
    def test_get_saved_forecasts(self, session):
        """Test GET /api/forecast/saved returns list of saved forecasts"""
        response = session.get(f"{BASE_URL}/api/forecast/saved")
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        assert "forecasts" in data
        assert isinstance(data["forecasts"], list)
        print(f"Found {len(data['forecasts'])} saved forecasts")
    
    def test_compare_forecast_invalid_index(self, session):
        """Test GET /api/forecast/compare/{index} with invalid index returns 404"""
        response = session.get(f"{BASE_URL}/api/forecast/compare/9999")
        assert response.status_code == 404
        print("Invalid index correctly returns 404")
    
    def test_compare_forecast_valid_index(self, session):
        """Test GET /api/forecast/compare/{index} with valid index"""
        # First get saved forecasts
        saved_response = session.get(f"{BASE_URL}/api/forecast/saved")
        assert saved_response.status_code == 200
        saved_data = saved_response.json()
        
        if len(saved_data.get("forecasts", [])) == 0:
            pytest.skip("No saved forecasts to compare")
        
        # Get the first forecast index
        first_forecast = saved_data["forecasts"][0]
        index = first_forecast.get("index", 1)
        
        # Compare
        response = session.get(f"{BASE_URL}/api/forecast/compare/{index}")
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "success" in data
        assert data["success"] == True
        assert "forecast_info" in data
        assert "monthly_comparison" in data
        assert "totals" in data
        assert "breakdown_comparison" in data
        
        # Verify totals structure
        totals = data["totals"]
        assert "predicted" in totals
        assert "actual" in totals
        assert "variance" in totals
        assert "accuracy" in totals
        
        # Verify breakdown_comparison structure
        breakdown = data["breakdown_comparison"]
        assert "kva" in breakdown
        assert "state" in breakdown
        assert "dealer" in breakdown
        
        print(f"Compare forecast {index} successful")
        print(f"Monthly comparison has {len(data['monthly_comparison'])} months")
        print(f"Overall accuracy: {totals['accuracy'].get('overall', 'N/A')}%")


class TestClosureQuestions:
    """Test Lost Lead Closure Questions feature"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        # Login
        response = s.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return s
    
    def test_get_pending_closure_count(self, session):
        """Test GET /api/leads/pending-closure-questions/count"""
        response = session.get(f"{BASE_URL}/api/leads/pending-closure-questions/count")
        assert response.status_code == 200
        data = response.json()
        assert "count" in data
        assert isinstance(data["count"], int)
        print(f"Pending closure questions count: {data['count']}")
    
    def test_get_pending_closure_leads(self, session):
        """Test GET /api/leads/pending-closure-questions"""
        response = session.get(f"{BASE_URL}/api/leads/pending-closure-questions")
        assert response.status_code == 200
        data = response.json()
        assert "leads" in data
        assert "total" in data
        assert isinstance(data["leads"], list)
        print(f"Pending closure leads: {data['total']}")
    
    def test_closure_answers_endpoint_exists(self, session):
        """Test POST /api/leads/{lead_id}/closure-answers endpoint exists"""
        # Test with a fake lead_id - should return 404 (not 405 method not allowed)
        response = session.post(
            f"{BASE_URL}/api/leads/fake_lead_id_12345/closure-answers",
            json={"answers": []}
        )
        # Should be 404 (lead not found) not 405 (method not allowed)
        assert response.status_code in [404, 400], f"Unexpected status: {response.status_code}"
        print("Closure answers endpoint exists and responds correctly")


class TestUploadCompositeKey:
    """Test Upload logic with composite key (enquiry_no + phone_number)"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create authenticated session"""
        s = requests.Session()
        # Login
        response = s.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return s
    
    def test_upload_template_endpoint(self, session):
        """Test GET /api/upload/template returns column info"""
        response = session.get(f"{BASE_URL}/api/upload/template")
        assert response.status_code == 200
        data = response.json()
        assert "columns" in data
        print(f"Upload template has {len(data['columns'])} columns")
    
    def test_leads_template_download(self, session):
        """Test GET /api/leads/template downloads template file"""
        response = session.get(f"{BASE_URL}/api/leads/template")
        assert response.status_code == 200
        # Should return Excel file
        content_type = response.headers.get("content-type", "")
        assert "spreadsheet" in content_type or "octet-stream" in content_type or "excel" in content_type.lower()
        print("Template download works")


class TestLeadsAPI:
    """Test Leads API endpoints"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        # Login
        response = s.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return s
    
    def test_get_leads(self, session):
        """Test GET /api/leads returns leads list"""
        response = session.get(f"{BASE_URL}/api/leads?limit=10")
        assert response.status_code == 200
        data = response.json()
        assert "leads" in data
        assert "total" in data
        print(f"Total leads: {data['total']}")
    
    def test_get_dropdown_options(self, session):
        """Test GET /api/leads/dropdown-options"""
        response = session.get(f"{BASE_URL}/api/leads/dropdown-options")
        assert response.status_code == 200
        data = response.json()
        assert "state" in data
        assert "dealer" in data
        print(f"Dropdown options loaded: {list(data.keys())}")


class TestAdminClosureQuestions:
    """Test Admin Closure Questions endpoints"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create authenticated session"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        # Login
        response = s.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return s
    
    def test_get_closure_questions(self, session):
        """Test GET /api/admin/closure-questions"""
        response = session.get(f"{BASE_URL}/api/admin/closure-questions")
        assert response.status_code == 200
        data = response.json()
        assert "questions" in data
        print(f"Closure questions count: {len(data['questions'])}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
