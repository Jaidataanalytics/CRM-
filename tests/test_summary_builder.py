"""
Test Summary Builder and Location Comparison Features
- Summary Builder pivot table endpoint
- Location dimension in top-performers
- Filters/all endpoint returns locations
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSummaryBuilder:
    """Summary Builder / Pivot Table endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": "admin", "password": "admin123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json().get("token")
    
    def test_summary_builder_endpoint_exists(self):
        """Test that summary-builder endpoint exists and returns 200"""
        response = self.session.get(
            f"{BASE_URL}/api/insights/summary-builder",
            params={
                "metric": "leads",
                "time_frame": "monthly",
                "dimension": "employee",
                "start_date": "2024-01-01",
                "end_date": "2024-12-31"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_summary_builder_returns_pivot_table(self):
        """Test that summary-builder returns pivot_table structure"""
        response = self.session.get(
            f"{BASE_URL}/api/insights/summary-builder",
            params={
                "metric": "leads",
                "time_frame": "monthly",
                "dimension": "employee",
                "start_date": "2024-01-01",
                "end_date": "2024-12-31"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify pivot_table structure
        assert "pivot_table" in data, "Response should contain pivot_table"
        pivot = data["pivot_table"]
        assert "columns" in pivot, "pivot_table should have columns"
        assert "rows" in pivot, "pivot_table should have rows"
        assert "column_totals" in pivot, "pivot_table should have column_totals"
        assert "grand_total" in pivot, "pivot_table should have grand_total"
        
        # Verify rows structure
        if len(pivot["rows"]) > 0:
            row = pivot["rows"][0]
            assert "dimension" in row, "Row should have dimension"
            assert "periods" in row, "Row should have periods"
            assert "total" in row, "Row should have total"
    
    def test_summary_builder_returns_meta(self):
        """Test that summary-builder returns meta information"""
        response = self.session.get(
            f"{BASE_URL}/api/insights/summary-builder",
            params={
                "metric": "leads",
                "time_frame": "monthly",
                "dimension": "employee",
                "start_date": "2024-01-01",
                "end_date": "2024-12-31"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "meta" in data, "Response should contain meta"
        meta = data["meta"]
        assert meta["metric"] == "leads"
        assert meta["time_frame"] == "monthly"
        assert meta["dimension"] == "employee"
        assert "date_range" in meta
    
    def test_summary_builder_returns_insights(self):
        """Test that summary-builder returns insights cards"""
        response = self.session.get(
            f"{BASE_URL}/api/insights/summary-builder",
            params={
                "metric": "leads",
                "time_frame": "monthly",
                "dimension": "employee",
                "start_date": "2024-01-01",
                "end_date": "2024-12-31"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "insights" in data, "Response should contain insights"
        insights = data["insights"]
        assert isinstance(insights, list), "Insights should be a list"
        
        # Check insight types
        insight_types = [i["type"] for i in insights]
        assert "top_performer" in insight_types, "Should have top_performer insight"
    
    def test_summary_builder_metric_options(self):
        """Test all metric options work"""
        metrics = ["leads", "qty", "won_leads", "lost_leads", "conversion_rate"]
        
        for metric in metrics:
            response = self.session.get(
                f"{BASE_URL}/api/insights/summary-builder",
                params={
                    "metric": metric,
                    "time_frame": "monthly",
                    "dimension": "employee",
                    "start_date": "2024-01-01",
                    "end_date": "2024-12-31"
                }
            )
            assert response.status_code == 200, f"Metric {metric} failed: {response.text}"
            data = response.json()
            assert data["meta"]["metric"] == metric
    
    def test_summary_builder_time_frame_options(self):
        """Test all time frame options work"""
        time_frames = ["monthly", "quarterly", "yearly"]
        
        for tf in time_frames:
            response = self.session.get(
                f"{BASE_URL}/api/insights/summary-builder",
                params={
                    "metric": "leads",
                    "time_frame": tf,
                    "dimension": "employee",
                    "start_date": "2024-01-01",
                    "end_date": "2024-12-31"
                }
            )
            assert response.status_code == 200, f"Time frame {tf} failed: {response.text}"
            data = response.json()
            assert data["meta"]["time_frame"] == tf
    
    def test_summary_builder_dimension_options(self):
        """Test all dimension options work"""
        dimensions = ["employee", "dealer", "state", "location", "segment", "source"]
        
        for dim in dimensions:
            response = self.session.get(
                f"{BASE_URL}/api/insights/summary-builder",
                params={
                    "metric": "leads",
                    "time_frame": "monthly",
                    "dimension": dim,
                    "start_date": "2024-01-01",
                    "end_date": "2024-12-31"
                }
            )
            assert response.status_code == 200, f"Dimension {dim} failed: {response.text}"
            data = response.json()
            assert data["meta"]["dimension"] == dim
    
    def test_summary_builder_handles_empty_data(self):
        """Test that summary-builder handles empty data gracefully"""
        response = self.session.get(
            f"{BASE_URL}/api/insights/summary-builder",
            params={
                "metric": "leads",
                "time_frame": "monthly",
                "dimension": "employee",
                "start_date": "2030-01-01",
                "end_date": "2030-12-31"
            }
        )
        # Should return 200 with empty data, not 500
        assert response.status_code == 200, f"Should handle empty data: {response.text}"
        data = response.json()
        assert "pivot_table" in data


class TestLocationComparison:
    """Test Location dimension in comparison views"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": "admin", "password": "admin123"}
        )
        assert login_response.status_code == 200
    
    def test_top_performers_supports_location(self):
        """Test that top-performers endpoint supports location dimension"""
        response = self.session.get(
            f"{BASE_URL}/api/insights/top-performers",
            params={
                "by": "location",
                "metric": "total",
                "start_date": "2024-01-01",
                "end_date": "2024-12-31"
            }
        )
        assert response.status_code == 200, f"Location dimension failed: {response.text}"
        data = response.json()
        
        assert "performers" in data
        assert data["by"] == "location"
        
        # Verify performers have expected fields
        if len(data["performers"]) > 0:
            performer = data["performers"][0]
            assert "name" in performer
            assert "total_leads" in performer
            assert "won_leads" in performer
            assert "conversion_rate" in performer
    
    def test_filters_all_returns_locations(self):
        """Test that /api/filters/all returns locations (not areas)"""
        response = self.session.get(f"{BASE_URL}/api/filters/all")
        assert response.status_code == 200
        data = response.json()
        
        # Should have locations key
        assert "locations" in data, "filters/all should return 'locations'"
        assert isinstance(data["locations"], list)
        
        # Should NOT have areas key (renamed to locations)
        # Note: areas endpoint still exists separately for backward compatibility
    
    def test_filters_locations_endpoint(self):
        """Test that /api/filters/locations endpoint exists"""
        response = self.session.get(f"{BASE_URL}/api/filters/locations")
        assert response.status_code == 200
        data = response.json()
        
        assert "locations" in data
        assert isinstance(data["locations"], list)


class TestSummaryBuilderQuarterly:
    """Test quarterly time frame specifically"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": "admin", "password": "admin123"}
        )
        assert login_response.status_code == 200
    
    def test_quarterly_columns_format(self):
        """Test that quarterly time frame returns Q1-Q4 format"""
        response = self.session.get(
            f"{BASE_URL}/api/insights/summary-builder",
            params={
                "metric": "leads",
                "time_frame": "quarterly",
                "dimension": "employee",
                "start_date": "2024-01-01",
                "end_date": "2024-12-31"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        columns = data["pivot_table"]["columns"]
        # Should have quarterly format like "2024-Q1", "2024-Q2", etc.
        for col in columns:
            assert "-Q" in col, f"Column {col} should be in quarterly format"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
