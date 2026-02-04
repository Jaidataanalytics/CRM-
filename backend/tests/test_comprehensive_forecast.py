"""
Test suite for AI-Powered Comprehensive Forecast API
Tests the /api/forecast-enhanced/comprehensive-forecast endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test session token - will be created in setup
SESSION_TOKEN = None


@pytest.fixture(scope="module", autouse=True)
def setup_session():
    """Create test session for authentication"""
    global SESSION_TOKEN
    # Login to get session
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": "admin", "password": "admin123"}
    )
    if response.status_code == 200:
        # Extract session token from cookies
        SESSION_TOKEN = response.cookies.get('session_token')
    yield
    # Cleanup if needed


@pytest.fixture
def auth_headers():
    """Get authentication headers/cookies"""
    return {"Cookie": f"session_token={SESSION_TOKEN}"}


class TestComprehensiveForecastEndpoint:
    """Tests for POST /api/forecast-enhanced/comprehensive-forecast"""
    
    def test_basic_forecast_success(self, auth_headers):
        """Test basic forecast generation with default parameters"""
        response = requests.post(
            f"{BASE_URL}/api/forecast-enhanced/comprehensive-forecast",
            json={
                "months_ahead": 3,
                "years_back": 3,
                "include_current_month": True
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify success
        assert data.get("success") == True
        
        # Verify model metrics exist
        assert "model_metrics" in data
        assert "leads_model" in data["model_metrics"]
        assert "closures_model" in data["model_metrics"]
        
    def test_model_auto_selection(self, auth_headers):
        """Test that models are auto-selected with accuracy metrics"""
        response = requests.post(
            f"{BASE_URL}/api/forecast-enhanced/comprehensive-forecast",
            json={
                "months_ahead": 3,
                "years_back": 3,
                "include_current_month": True
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify model selection mode
        assert data.get("model_selection_mode") == "auto"
        
        # Verify leads model has name and accuracy
        leads_model = data["model_metrics"]["leads_model"]
        assert "name" in leads_model
        assert "accuracy" in leads_model
        assert leads_model["accuracy"] is not None
        assert leads_model["accuracy"] > 0
        
        # Verify closures model has name and accuracy
        closures_model = data["model_metrics"]["closures_model"]
        assert "name" in closures_model
        assert "accuracy" in closures_model
        assert closures_model["accuracy"] is not None
        assert closures_model["accuracy"] > 0
        
    def test_organization_forecast_structure(self, auth_headers):
        """Test organization_forecast contains totals, by_dealer, by_kva, by_district"""
        response = requests.post(
            f"{BASE_URL}/api/forecast-enhanced/comprehensive-forecast",
            json={
                "months_ahead": 3,
                "years_back": 3,
                "include_current_month": True
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify organization_forecast exists
        assert "organization_forecast" in data
        org = data["organization_forecast"]
        
        # Verify totals
        assert "totals" in org
        assert "leads" in org["totals"]
        assert "closures" in org["totals"]
        assert org["totals"]["leads"] > 0
        assert org["totals"]["closures"] > 0
        
        # Verify months array with breakdowns
        assert "months" in org
        assert len(org["months"]) == 3  # 3 months ahead
        
        # Check first month has all breakdowns
        first_month = org["months"][0]
        assert "dealer_breakdown" in first_month
        assert "kva_breakdown" in first_month
        assert "district_breakdown" in first_month
        assert len(first_month["dealer_breakdown"]) > 0
        assert len(first_month["kva_breakdown"]) > 0
        assert len(first_month["district_breakdown"]) > 0
        
    def test_dealer_forecasts_structure(self, auth_headers):
        """Test dealer_forecasts contains detailed breakdowns for each dealer"""
        response = requests.post(
            f"{BASE_URL}/api/forecast-enhanced/comprehensive-forecast",
            json={
                "months_ahead": 3,
                "years_back": 3,
                "include_current_month": True
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify dealer_forecasts exists and is a dict
        assert "dealer_forecasts" in data
        dealer_forecasts = data["dealer_forecasts"]
        assert isinstance(dealer_forecasts, dict)
        assert len(dealer_forecasts) > 0
        
        # Check first dealer structure
        first_dealer_name = list(dealer_forecasts.keys())[0]
        first_dealer = dealer_forecasts[first_dealer_name]
        
        # Verify dealer has historical data
        assert "historical" in first_dealer
        assert "total_leads" in first_dealer["historical"]
        assert "total_closures" in first_dealer["historical"]
        
        # Verify dealer has months with by_kva and by_district
        assert "months" in first_dealer
        assert len(first_dealer["months"]) == 3
        
        first_month = first_dealer["months"][0]
        assert "by_kva" in first_month
        assert "by_district" in first_month
        
    def test_consistency_check_passed(self, auth_headers):
        """Test consistency_check.passed is true (totals match)"""
        response = requests.post(
            f"{BASE_URL}/api/forecast-enhanced/comprehensive-forecast",
            json={
                "months_ahead": 3,
                "years_back": 3,
                "include_current_month": True
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify consistency check
        assert "consistency_check" in data
        assert data["consistency_check"]["passed"] == True
        assert data["consistency_check"]["issues"] == []
        
    def test_years_back_parameter_1_year(self, auth_headers):
        """Test years_back parameter with 1 year - may fail if not enough data"""
        response = requests.post(
            f"{BASE_URL}/api/forecast-enhanced/comprehensive-forecast",
            json={
                "months_ahead": 3,
                "years_back": 1,
                "include_current_month": True
            },
            headers=auth_headers
        )
        
        # May return success or error depending on data availability
        assert response.status_code in [200, 400]
        
    def test_years_back_parameter_2_years(self, auth_headers):
        """Test years_back parameter with 2 years"""
        response = requests.post(
            f"{BASE_URL}/api/forecast-enhanced/comprehensive-forecast",
            json={
                "months_ahead": 3,
                "years_back": 2,
                "include_current_month": True
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        
        # Verify historical summary reflects 2 years
        assert "historical_summary" in data
        
    def test_years_back_parameter_3_years(self, auth_headers):
        """Test years_back parameter with 3 years (default)"""
        response = requests.post(
            f"{BASE_URL}/api/forecast-enhanced/comprehensive-forecast",
            json={
                "months_ahead": 3,
                "years_back": 3,
                "include_current_month": True
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        
    def test_force_model_xgboost(self, auth_headers):
        """Test force_model parameter with XGBoost"""
        response = requests.post(
            f"{BASE_URL}/api/forecast-enhanced/comprehensive-forecast",
            json={
                "months_ahead": 3,
                "years_back": 3,
                "include_current_month": True,
                "force_model": "XGBoost"
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        
        # Verify manual model selection
        assert data.get("model_selection_mode") == "manual"
        
        # Verify XGBoost is used for both models
        assert data["model_metrics"]["leads_model"]["name"] == "XGBoost"
        assert data["model_metrics"]["closures_model"]["name"] == "XGBoost"
        
    def test_force_model_exponential_smoothing(self, auth_headers):
        """Test force_model parameter with Exponential Smoothing"""
        response = requests.post(
            f"{BASE_URL}/api/forecast-enhanced/comprehensive-forecast",
            json={
                "months_ahead": 3,
                "years_back": 3,
                "include_current_month": True,
                "force_model": "Exponential Smoothing"
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data.get("model_selection_mode") == "manual"
        
    def test_available_models_list(self, auth_headers):
        """Test that available_models list is returned"""
        response = requests.post(
            f"{BASE_URL}/api/forecast-enhanced/comprehensive-forecast",
            json={
                "months_ahead": 3,
                "years_back": 3,
                "include_current_month": True
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify available models list
        assert "model_metrics" in data
        assert "available_models" in data["model_metrics"]
        available = data["model_metrics"]["available_models"]
        
        # Check expected models are in the list
        expected_models = [
            "Simple Moving Average",
            "Weighted Moving Average",
            "Exponential Smoothing",
            "XGBoost",
            "Random Forest"
        ]
        for model in expected_models:
            assert model in available, f"Expected model '{model}' not in available_models"
            
    def test_all_models_tested_list(self, auth_headers):
        """Test that all_models_tested list is returned with accuracy"""
        response = requests.post(
            f"{BASE_URL}/api/forecast-enhanced/comprehensive-forecast",
            json={
                "months_ahead": 3,
                "years_back": 3,
                "include_current_month": True
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify all_models_tested for leads
        leads_tested = data["model_metrics"]["leads_model"]["all_models_tested"]
        assert len(leads_tested) > 0
        
        # Each tested model should have model name and accuracy
        for model in leads_tested:
            assert "model" in model
            assert "accuracy" in model
            
    def test_months_ahead_6_months(self, auth_headers):
        """Test with 6 months forecast horizon"""
        response = requests.post(
            f"{BASE_URL}/api/forecast-enhanced/comprehensive-forecast",
            json={
                "months_ahead": 6,
                "years_back": 3,
                "include_current_month": True
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        
        # Verify 6 months of predictions
        assert len(data["organization_forecast"]["months"]) == 6
        
    def test_chart_data_structure(self, auth_headers):
        """Test chart_data is returned with correct structure"""
        response = requests.post(
            f"{BASE_URL}/api/forecast-enhanced/comprehensive-forecast",
            json={
                "months_ahead": 3,
                "years_back": 3,
                "include_current_month": True
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify chart_data exists
        assert "chart_data" in data
        chart = data["chart_data"]
        
        # Verify chart data arrays
        assert "months" in chart
        assert "leads" in chart
        assert "closures" in chart
        assert "conversion_rates" in chart
        
        # Verify arrays have correct length
        assert len(chart["months"]) == 3
        assert len(chart["leads"]) == 3
        assert len(chart["closures"]) == 3
        assert len(chart["conversion_rates"]) == 3


class TestDataIntegrity:
    """Tests for data integrity and consistency"""
    
    def test_dealer_totals_match_org_totals(self, auth_headers):
        """Verify sum of dealer predictions matches organization totals"""
        response = requests.post(
            f"{BASE_URL}/api/forecast-enhanced/comprehensive-forecast",
            json={
                "months_ahead": 3,
                "years_back": 3,
                "include_current_month": True
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # For each month, sum dealer breakdowns should match org totals
        for month_data in data["organization_forecast"]["months"]:
            org_leads = month_data["predicted_leads"]
            org_closures = month_data["predicted_closures"]
            
            dealer_leads_sum = sum(d["predicted_leads"] for d in month_data["dealer_breakdown"])
            dealer_closures_sum = sum(d["predicted_closures"] for d in month_data["dealer_breakdown"])
            
            assert dealer_leads_sum == org_leads, f"Dealer leads sum {dealer_leads_sum} != org {org_leads}"
            assert dealer_closures_sum == org_closures, f"Dealer closures sum {dealer_closures_sum} != org {org_closures}"
            
    def test_closures_not_exceed_leads(self, auth_headers):
        """Verify closures never exceed leads"""
        response = requests.post(
            f"{BASE_URL}/api/forecast-enhanced/comprehensive-forecast",
            json={
                "months_ahead": 3,
                "years_back": 3,
                "include_current_month": True
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check organization totals
        org = data["organization_forecast"]
        assert org["totals"]["closures"] <= org["totals"]["leads"]
        
        # Check each month
        for month in org["months"]:
            assert month["predicted_closures"] <= month["predicted_leads"]


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
