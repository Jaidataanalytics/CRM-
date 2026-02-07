"""
Test suite for Source and Segment Market Potential endpoints
Tests the new CRUD operations for sources and segments market potential management
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSourcePotentialEndpoints:
    """Tests for Source Market Potential CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login to get session cookie
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": "admin@example.com", "password": "admin123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        yield
        # Cleanup test data
        try:
            self.session.delete(f"{BASE_URL}/api/market-potential/sources/TEST_Source_1")
            self.session.delete(f"{BASE_URL}/api/market-potential/sources/TEST_Source_2")
        except:
            pass
    
    def test_get_sources_list_from_leads(self):
        """GET /api/market-potential/sources/list - should return unique sources from leads"""
        response = self.session.get(f"{BASE_URL}/api/market-potential/sources/list")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "sources" in data, "Response should contain 'sources' key"
        assert isinstance(data["sources"], list), "Sources should be a list"
        print(f"Found {len(data['sources'])} unique sources from leads")
    
    def test_get_source_potentials(self):
        """GET /api/market-potential/sources - should return list of source potentials"""
        response = self.session.get(f"{BASE_URL}/api/market-potential/sources")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "sources" in data, "Response should contain 'sources' key"
        assert isinstance(data["sources"], list), "Sources should be a list"
        print(f"Found {len(data['sources'])} source potentials")
    
    def test_add_source_potential(self):
        """POST /api/market-potential/sources - should add/update source potential"""
        payload = {
            "source": "TEST_Source_1",
            "potential": 500,
            "market_size": 1000
        }
        response = self.session.post(
            f"{BASE_URL}/api/market-potential/sources",
            json=payload
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("status") == "success", f"Expected success status: {data}"
        print(f"Successfully added source potential: {payload['source']}")
        
        # Verify it was added by fetching
        get_response = self.session.get(f"{BASE_URL}/api/market-potential/sources")
        assert get_response.status_code == 200
        sources = get_response.json().get("sources", [])
        test_source = next((s for s in sources if s.get("source") == "TEST_Source_1"), None)
        assert test_source is not None, "Test source should exist after creation"
        assert test_source.get("potential") == 500, "Potential should be 500"
        assert test_source.get("market_size") == 1000, "Market size should be 1000"
    
    def test_update_source_potential(self):
        """POST /api/market-potential/sources - should update existing source potential"""
        # First create
        self.session.post(
            f"{BASE_URL}/api/market-potential/sources",
            json={"source": "TEST_Source_2", "potential": 100, "market_size": 200}
        )
        
        # Then update
        payload = {
            "source": "TEST_Source_2",
            "potential": 999,
            "market_size": 1999
        }
        response = self.session.post(
            f"{BASE_URL}/api/market-potential/sources",
            json=payload
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify update
        get_response = self.session.get(f"{BASE_URL}/api/market-potential/sources")
        sources = get_response.json().get("sources", [])
        test_source = next((s for s in sources if s.get("source") == "TEST_Source_2"), None)
        assert test_source is not None, "Test source should exist"
        assert test_source.get("potential") == 999, f"Potential should be 999, got {test_source.get('potential')}"
        assert test_source.get("market_size") == 1999, f"Market size should be 1999, got {test_source.get('market_size')}"
        print("Successfully updated source potential")
    
    def test_delete_source_potential(self):
        """DELETE /api/market-potential/sources/{source} - should delete source potential"""
        # First create
        self.session.post(
            f"{BASE_URL}/api/market-potential/sources",
            json={"source": "TEST_Source_Delete", "potential": 100, "market_size": 200}
        )
        
        # Then delete
        response = self.session.delete(f"{BASE_URL}/api/market-potential/sources/TEST_Source_Delete")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("status") == "success", f"Expected success status: {data}"
        print("Successfully deleted source potential")
        
        # Verify deletion
        get_response = self.session.get(f"{BASE_URL}/api/market-potential/sources")
        sources = get_response.json().get("sources", [])
        test_source = next((s for s in sources if s.get("source") == "TEST_Source_Delete"), None)
        assert test_source is None, "Test source should not exist after deletion"
    
    def test_delete_nonexistent_source(self):
        """DELETE /api/market-potential/sources/{source} - should return 404 for nonexistent"""
        response = self.session.delete(f"{BASE_URL}/api/market-potential/sources/NONEXISTENT_SOURCE_XYZ")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
    
    def test_add_source_without_name(self):
        """POST /api/market-potential/sources - should return 400 for missing source name"""
        payload = {
            "source": "",
            "potential": 500
        }
        response = self.session.post(
            f"{BASE_URL}/api/market-potential/sources",
            json=payload
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"


class TestSegmentPotentialEndpoints:
    """Tests for Segment Market Potential CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login to get session cookie
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": "admin@example.com", "password": "admin123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        yield
        # Cleanup test data
        try:
            self.session.delete(f"{BASE_URL}/api/market-potential/segments/TEST_Segment_1")
            self.session.delete(f"{BASE_URL}/api/market-potential/segments/TEST_Segment_2")
        except:
            pass
    
    def test_get_segments_list_from_leads(self):
        """GET /api/market-potential/segments/list - should return unique segments from leads"""
        response = self.session.get(f"{BASE_URL}/api/market-potential/segments/list")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "segments" in data, "Response should contain 'segments' key"
        assert isinstance(data["segments"], list), "Segments should be a list"
        print(f"Found {len(data['segments'])} unique segments from leads")
    
    def test_get_segment_potentials(self):
        """GET /api/market-potential/segments - should return list of segment potentials"""
        response = self.session.get(f"{BASE_URL}/api/market-potential/segments")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "segments" in data, "Response should contain 'segments' key"
        assert isinstance(data["segments"], list), "Segments should be a list"
        print(f"Found {len(data['segments'])} segment potentials")
    
    def test_add_segment_potential(self):
        """POST /api/market-potential/segments - should add/update segment potential"""
        payload = {
            "segment": "TEST_Segment_1",
            "potential": 750,
            "market_size": 1500
        }
        response = self.session.post(
            f"{BASE_URL}/api/market-potential/segments",
            json=payload
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("status") == "success", f"Expected success status: {data}"
        print(f"Successfully added segment potential: {payload['segment']}")
        
        # Verify it was added by fetching
        get_response = self.session.get(f"{BASE_URL}/api/market-potential/segments")
        assert get_response.status_code == 200
        segments = get_response.json().get("segments", [])
        test_segment = next((s for s in segments if s.get("segment") == "TEST_Segment_1"), None)
        assert test_segment is not None, "Test segment should exist after creation"
        assert test_segment.get("potential") == 750, "Potential should be 750"
        assert test_segment.get("market_size") == 1500, "Market size should be 1500"
    
    def test_update_segment_potential(self):
        """POST /api/market-potential/segments - should update existing segment potential"""
        # First create
        self.session.post(
            f"{BASE_URL}/api/market-potential/segments",
            json={"segment": "TEST_Segment_2", "potential": 100, "market_size": 200}
        )
        
        # Then update
        payload = {
            "segment": "TEST_Segment_2",
            "potential": 888,
            "market_size": 1888
        }
        response = self.session.post(
            f"{BASE_URL}/api/market-potential/segments",
            json=payload
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify update
        get_response = self.session.get(f"{BASE_URL}/api/market-potential/segments")
        segments = get_response.json().get("segments", [])
        test_segment = next((s for s in segments if s.get("segment") == "TEST_Segment_2"), None)
        assert test_segment is not None, "Test segment should exist"
        assert test_segment.get("potential") == 888, f"Potential should be 888, got {test_segment.get('potential')}"
        assert test_segment.get("market_size") == 1888, f"Market size should be 1888, got {test_segment.get('market_size')}"
        print("Successfully updated segment potential")
    
    def test_delete_segment_potential(self):
        """DELETE /api/market-potential/segments/{segment} - should delete segment potential"""
        # First create
        self.session.post(
            f"{BASE_URL}/api/market-potential/segments",
            json={"segment": "TEST_Segment_Delete", "potential": 100, "market_size": 200}
        )
        
        # Then delete
        response = self.session.delete(f"{BASE_URL}/api/market-potential/segments/TEST_Segment_Delete")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("status") == "success", f"Expected success status: {data}"
        print("Successfully deleted segment potential")
        
        # Verify deletion
        get_response = self.session.get(f"{BASE_URL}/api/market-potential/segments")
        segments = get_response.json().get("segments", [])
        test_segment = next((s for s in segments if s.get("segment") == "TEST_Segment_Delete"), None)
        assert test_segment is None, "Test segment should not exist after deletion"
    
    def test_delete_nonexistent_segment(self):
        """DELETE /api/market-potential/segments/{segment} - should return 404 for nonexistent"""
        response = self.session.delete(f"{BASE_URL}/api/market-potential/segments/NONEXISTENT_SEGMENT_XYZ")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
    
    def test_add_segment_without_name(self):
        """POST /api/market-potential/segments - should return 400 for missing segment name"""
        payload = {
            "segment": "",
            "potential": 500
        }
        response = self.session.post(
            f"{BASE_URL}/api/market-potential/segments",
            json=payload
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"


class TestComparisonBySourceSegment:
    """Tests for comparison endpoint with source and segment compare_by options"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login to get session cookie
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": "admin@example.com", "password": "admin123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
    
    def test_comparison_by_source(self):
        """GET /api/market-potential/comparison?compare_by=source - should compare by source"""
        response = self.session.get(f"{BASE_URL}/api/market-potential/comparison?compare_by=source")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("compare_by") == "source", f"Expected compare_by=source, got {data.get('compare_by')}"
        assert "data" in data, "Response should contain 'data' key"
        assert "totals" in data, "Response should contain 'totals' key"
        assert "date_range" in data, "Response should contain 'date_range' key"
        
        # Verify data structure
        if len(data["data"]) > 0:
            item = data["data"][0]
            assert "name" in item, "Each item should have 'name'"
            assert "potential" in item, "Each item should have 'potential'"
            assert "current_sales" in item, "Each item should have 'current_sales'"
            assert "last_year_sales" in item, "Each item should have 'last_year_sales'"
            assert "market_share" in item, "Each item should have 'market_share'"
            assert "yoy_change" in item, "Each item should have 'yoy_change'"
        
        print(f"Comparison by source returned {len(data['data'])} items")
        print(f"Totals: potential={data['totals'].get('potential')}, current_sales={data['totals'].get('current_sales')}")
    
    def test_comparison_by_segment(self):
        """GET /api/market-potential/comparison?compare_by=segment - should compare by segment"""
        response = self.session.get(f"{BASE_URL}/api/market-potential/comparison?compare_by=segment")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("compare_by") == "segment", f"Expected compare_by=segment, got {data.get('compare_by')}"
        assert "data" in data, "Response should contain 'data' key"
        assert "totals" in data, "Response should contain 'totals' key"
        assert "date_range" in data, "Response should contain 'date_range' key"
        
        # Verify data structure
        if len(data["data"]) > 0:
            item = data["data"][0]
            assert "name" in item, "Each item should have 'name'"
            assert "potential" in item, "Each item should have 'potential'"
            assert "current_sales" in item, "Each item should have 'current_sales'"
            assert "last_year_sales" in item, "Each item should have 'last_year_sales'"
            assert "market_share" in item, "Each item should have 'market_share'"
            assert "yoy_change" in item, "Each item should have 'yoy_change'"
        
        print(f"Comparison by segment returned {len(data['data'])} items")
        print(f"Totals: potential={data['totals'].get('potential')}, current_sales={data['totals'].get('current_sales')}")
    
    def test_comparison_by_district_still_works(self):
        """GET /api/market-potential/comparison?compare_by=district - existing functionality should work"""
        response = self.session.get(f"{BASE_URL}/api/market-potential/comparison?compare_by=district")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("compare_by") == "district", f"Expected compare_by=district, got {data.get('compare_by')}"
        print(f"Comparison by district returned {len(data['data'])} items")
    
    def test_comparison_by_kva_still_works(self):
        """GET /api/market-potential/comparison?compare_by=kva - existing functionality should work"""
        response = self.session.get(f"{BASE_URL}/api/market-potential/comparison?compare_by=kva")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("compare_by") == "kva", f"Expected compare_by=kva, got {data.get('compare_by')}"
        print(f"Comparison by KVA returned {len(data['data'])} items")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
