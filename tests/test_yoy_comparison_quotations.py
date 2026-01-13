"""
Test YoY Historical Comparison and Quotations View Lead Features
- Summary Builder YoY comparison toggle (compare_historical=true)
- YoY table columns (Current, Prev, YoY%)
- YoY insight card
- Quotations View Lead button
- Quotations Enquiry No column
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestYoYComparison:
    """Test Summary Builder YoY Historical Comparison feature"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": "admin", "password": "admin123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
    
    def test_summary_builder_supports_compare_historical_param(self):
        """Test that summary-builder endpoint accepts compare_historical parameter"""
        response = self.session.get(
            f"{BASE_URL}/api/insights/summary-builder",
            params={
                "metric": "leads",
                "time_frame": "quarterly",
                "dimension": "employee",
                "start_date": "2024-01-01",
                "end_date": "2024-12-31",
                "compare_historical": "true"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify meta includes compare_historical
        assert "meta" in data
        assert data["meta"].get("compare_historical") == True, "Meta should show compare_historical=True"
    
    def test_yoy_returns_historical_comparison_data(self):
        """Test that YoY mode returns historical_comparison object"""
        response = self.session.get(
            f"{BASE_URL}/api/insights/summary-builder",
            params={
                "metric": "leads",
                "time_frame": "quarterly",
                "dimension": "employee",
                "start_date": "2024-01-01",
                "end_date": "2024-12-31",
                "compare_historical": "true"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify historical_comparison structure
        assert "historical_comparison" in data, "Response should contain historical_comparison"
        hc = data["historical_comparison"]
        assert hc is not None, "historical_comparison should not be None"
        
        assert "columns" in hc, "historical_comparison should have columns"
        assert "rows" in hc, "historical_comparison should have rows"
        assert "column_totals" in hc, "historical_comparison should have column_totals"
        assert "grand_total" in hc, "historical_comparison should have grand_total"
        assert "hist_date_range" in hc, "historical_comparison should have hist_date_range"
    
    def test_yoy_columns_have_current_and_historical(self):
        """Test that YoY columns contain current and historical period mapping"""
        response = self.session.get(
            f"{BASE_URL}/api/insights/summary-builder",
            params={
                "metric": "leads",
                "time_frame": "quarterly",
                "dimension": "employee",
                "start_date": "2024-01-01",
                "end_date": "2024-12-31",
                "compare_historical": "true"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        columns = data["historical_comparison"]["columns"]
        assert len(columns) > 0, "Should have at least one column"
        
        # Each column should have current and historical period
        for col in columns:
            assert "current" in col, f"Column should have 'current': {col}"
            assert "historical" in col, f"Column should have 'historical': {col}"
            
            # Verify format (e.g., 2024-Q1 -> 2023-Q1)
            if "-Q" in col["current"]:
                current_year = int(col["current"].split("-Q")[0])
                hist_year = int(col["historical"].split("-Q")[0])
                assert hist_year == current_year - 1, f"Historical year should be 1 year before current"
    
    def test_yoy_rows_have_yoy_change_values(self):
        """Test that YoY rows contain current, historical, and yoy_change values"""
        response = self.session.get(
            f"{BASE_URL}/api/insights/summary-builder",
            params={
                "metric": "leads",
                "time_frame": "quarterly",
                "dimension": "employee",
                "start_date": "2024-01-01",
                "end_date": "2024-12-31",
                "compare_historical": "true"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        rows = data["historical_comparison"]["rows"]
        if len(rows) > 0:
            row = rows[0]
            assert "dimension" in row, "Row should have dimension"
            assert "periods" in row, "Row should have periods"
            assert "total" in row, "Row should have total"
            assert "hist_total" in row, "Row should have hist_total"
            assert "yoy_change" in row, "Row should have yoy_change"
            
            # Check period data structure
            if row["periods"]:
                period_key = list(row["periods"].keys())[0]
                period_data = row["periods"][period_key]
                assert "current" in period_data, "Period should have current value"
                assert "historical" in period_data, "Period should have historical value"
                assert "yoy_change" in period_data, "Period should have yoy_change value"
    
    def test_yoy_grand_total_has_comparison(self):
        """Test that YoY grand_total has current, historical, and yoy_change"""
        response = self.session.get(
            f"{BASE_URL}/api/insights/summary-builder",
            params={
                "metric": "leads",
                "time_frame": "quarterly",
                "dimension": "employee",
                "start_date": "2024-01-01",
                "end_date": "2024-12-31",
                "compare_historical": "true"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        grand_total = data["historical_comparison"]["grand_total"]
        assert "current" in grand_total, "grand_total should have current"
        assert "historical" in grand_total, "grand_total should have historical"
        assert "yoy_change" in grand_total, "grand_total should have yoy_change"
    
    def test_yoy_insight_card_present(self):
        """Test that YoY comparison insight card is present in insights"""
        response = self.session.get(
            f"{BASE_URL}/api/insights/summary-builder",
            params={
                "metric": "leads",
                "time_frame": "quarterly",
                "dimension": "employee",
                "start_date": "2024-01-01",
                "end_date": "2024-12-31",
                "compare_historical": "true"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        insights = data.get("insights", [])
        insight_types = [i["type"] for i in insights]
        
        assert "yoy_comparison" in insight_types, "Should have yoy_comparison insight when compare_historical=true"
        
        # Find the YoY insight and verify structure
        yoy_insight = next((i for i in insights if i["type"] == "yoy_comparison"), None)
        assert yoy_insight is not None
        assert "message" in yoy_insight, "YoY insight should have message"
        assert "growth" in yoy_insight, "YoY insight should have growth value"
    
    def test_yoy_works_with_all_metrics(self):
        """Test YoY comparison works with all metric options"""
        metrics = ["leads", "qty", "won_leads", "lost_leads", "conversion_rate"]
        
        for metric in metrics:
            response = self.session.get(
                f"{BASE_URL}/api/insights/summary-builder",
                params={
                    "metric": metric,
                    "time_frame": "quarterly",
                    "dimension": "employee",
                    "start_date": "2024-01-01",
                    "end_date": "2024-12-31",
                    "compare_historical": "true"
                }
            )
            assert response.status_code == 200, f"YoY with metric {metric} failed: {response.text}"
            data = response.json()
            assert "historical_comparison" in data, f"YoY with metric {metric} should return historical_comparison"
    
    def test_yoy_works_with_all_time_frames(self):
        """Test YoY comparison works with all time frame options"""
        time_frames = ["monthly", "quarterly", "yearly"]
        
        for tf in time_frames:
            response = self.session.get(
                f"{BASE_URL}/api/insights/summary-builder",
                params={
                    "metric": "leads",
                    "time_frame": tf,
                    "dimension": "employee",
                    "start_date": "2024-01-01",
                    "end_date": "2024-12-31",
                    "compare_historical": "true"
                }
            )
            assert response.status_code == 200, f"YoY with time_frame {tf} failed: {response.text}"
            data = response.json()
            assert "historical_comparison" in data, f"YoY with time_frame {tf} should return historical_comparison"
    
    def test_yoy_works_with_all_dimensions(self):
        """Test YoY comparison works with all dimension options"""
        dimensions = ["employee", "dealer", "state", "location", "segment", "source"]
        
        for dim in dimensions:
            response = self.session.get(
                f"{BASE_URL}/api/insights/summary-builder",
                params={
                    "metric": "leads",
                    "time_frame": "quarterly",
                    "dimension": dim,
                    "start_date": "2024-01-01",
                    "end_date": "2024-12-31",
                    "compare_historical": "true"
                }
            )
            assert response.status_code == 200, f"YoY with dimension {dim} failed: {response.text}"
            data = response.json()
            assert "historical_comparison" in data, f"YoY with dimension {dim} should return historical_comparison"
    
    def test_yoy_false_does_not_return_historical(self):
        """Test that compare_historical=false does not return historical_comparison"""
        response = self.session.get(
            f"{BASE_URL}/api/insights/summary-builder",
            params={
                "metric": "leads",
                "time_frame": "quarterly",
                "dimension": "employee",
                "start_date": "2024-01-01",
                "end_date": "2024-12-31",
                "compare_historical": "false"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        # historical_comparison should be None when compare_historical=false
        assert data.get("historical_comparison") is None, "historical_comparison should be None when compare_historical=false"


class TestQuotationsViewLead:
    """Test Quotations page View Lead feature"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": "admin", "password": "admin123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
    
    def test_quotations_endpoint_returns_data(self):
        """Test that quotations endpoint returns data"""
        response = self.session.get(
            f"{BASE_URL}/api/leads/quotations",
            params={"page": 1, "limit": 10, "status": "all"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "quotations" in data, "Response should contain quotations"
        assert "total" in data, "Response should contain total"
        assert "pages" in data, "Response should contain pages"
    
    def test_quotations_have_enquiry_no_field(self):
        """Test that quotations include enquiry_no field for View Lead navigation"""
        response = self.session.get(
            f"{BASE_URL}/api/leads/quotations",
            params={"page": 1, "limit": 10, "status": "all"}
        )
        assert response.status_code == 200
        data = response.json()
        
        quotations = data.get("quotations", [])
        if len(quotations) > 0:
            q = quotations[0]
            assert "enquiry_no" in q, "Quotation should have enquiry_no field"
            assert "lead_id" in q, "Quotation should have lead_id field"
            assert "phone_number" in q, "Quotation should have phone_number field"
    
    def test_quotations_have_required_fields_for_table(self):
        """Test that quotations have all required fields for the table display"""
        response = self.session.get(
            f"{BASE_URL}/api/leads/quotations",
            params={"page": 1, "limit": 10, "status": "all"}
        )
        assert response.status_code == 200
        data = response.json()
        
        quotations = data.get("quotations", [])
        if len(quotations) > 0:
            q = quotations[0]
            required_fields = [
                "lead_id",
                "quotation_no",
                "name",
                "phone_number",
                "enquiry_no",
                "quotation_date",
                "enquiry_stage",
                "quotation_status"
            ]
            for field in required_fields:
                assert field in q, f"Quotation should have {field} field"
    
    def test_quotations_summary_endpoint(self):
        """Test that quotations summary endpoint works"""
        response = self.session.get(f"{BASE_URL}/api/leads/quotations/summary")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "total" in data, "Summary should have total"
        assert "pending" in data, "Summary should have pending"
        assert "won" in data, "Summary should have won"
        assert "lost" in data, "Summary should have lost"
        assert "conversion_rate" in data, "Summary should have conversion_rate"
    
    def test_quotations_search_by_enquiry_no(self):
        """Test that quotations can be searched by enquiry_no"""
        # First get a quotation to get an enquiry_no
        response = self.session.get(
            f"{BASE_URL}/api/leads/quotations",
            params={"page": 1, "limit": 1, "status": "all"}
        )
        assert response.status_code == 200
        data = response.json()
        
        quotations = data.get("quotations", [])
        if len(quotations) > 0 and quotations[0].get("enquiry_no"):
            enquiry_no = quotations[0]["enquiry_no"]
            
            # Search by enquiry_no
            search_response = self.session.get(
                f"{BASE_URL}/api/leads/quotations",
                params={"page": 1, "limit": 10, "status": "all", "search": enquiry_no}
            )
            assert search_response.status_code == 200, f"Search failed: {search_response.text}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
