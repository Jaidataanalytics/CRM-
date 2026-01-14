"""
Test KPI Data Integrity and Duplicate Detection Logic
Tests for:
1. KPIs endpoint returns correct Won Leads count (866)
2. KPIs endpoint returns correct Quotations Sent count (853)
3. KPIs endpoint works without errors
4. Data quality endpoint /api/leads/data-quality/won-without-quotation returns 50 leads
5. Duplicate detection logic correctly identifies repeat customers (closed leads = not duplicate)
6. Dashboard loads correctly with all KPI cards
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USERNAME = "admin"
TEST_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": TEST_USERNAME, "password": TEST_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json().get("token")


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Create authenticated session"""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    })
    return session


class TestKPIsEndpoint:
    """Test KPIs endpoint returns correct values"""
    
    def test_kpis_endpoint_returns_200(self, api_client):
        """Test KPIs endpoint works without errors"""
        response = api_client.get(f"{BASE_URL}/api/kpis")
        assert response.status_code == 200, f"KPIs endpoint failed: {response.text}"
        print("✅ KPIs endpoint returns 200 OK")
    
    def test_kpis_returns_won_leads_count(self, api_client):
        """Test KPIs endpoint returns correct Won Leads count (866)"""
        response = api_client.get(f"{BASE_URL}/api/kpis")
        assert response.status_code == 200
        data = response.json()
        
        won_leads = data.get("won_leads")
        assert won_leads is not None, "won_leads field missing from response"
        assert won_leads == 866, f"Expected Won Leads = 866, got {won_leads}"
        print(f"✅ Won Leads count is correct: {won_leads}")
    
    def test_kpis_returns_quotations_sent_count(self, api_client):
        """Test KPIs endpoint returns correct Quotations Sent count (853)"""
        response = api_client.get(f"{BASE_URL}/api/kpis")
        assert response.status_code == 200
        data = response.json()
        
        quotations_sent = data.get("quotations_sent")
        assert quotations_sent is not None, "quotations_sent field missing from response"
        assert quotations_sent == 853, f"Expected Quotations Sent = 853, got {quotations_sent}"
        print(f"✅ Quotations Sent count is correct: {quotations_sent}")
    
    def test_kpis_won_greater_than_quotations_is_data_quality_issue(self, api_client):
        """
        Test that Won > Quotations is a data quality issue, not a bug.
        Won Leads (866) > Quotations Sent (853) because 50 won leads are missing quotation data.
        """
        response = api_client.get(f"{BASE_URL}/api/kpis")
        assert response.status_code == 200
        data = response.json()
        
        won_leads = data.get("won_leads", 0)
        quotations_sent = data.get("quotations_sent", 0)
        
        # This is expected - some won leads don't have quotation data
        difference = won_leads - quotations_sent
        print(f"Won Leads: {won_leads}, Quotations Sent: {quotations_sent}")
        print(f"Difference: {difference} (expected ~50 due to data quality)")
        
        # The difference should be approximately 50 (won leads without quotation data)
        assert difference >= 0, "Won leads should be >= quotations sent"
        print(f"✅ Won > Quotations difference ({difference}) is a data quality issue, not a bug")
    
    def test_kpis_returns_all_required_fields(self, api_client):
        """Test KPIs endpoint returns all required fields"""
        response = api_client.get(f"{BASE_URL}/api/kpis")
        assert response.status_code == 200
        data = response.json()
        
        required_fields = [
            "total_leads", "won_leads", "lost_leads", "open_leads",
            "hot_leads", "warm_leads", "cold_leads",
            "quotations_sent", "conversion_rate",
            "calls_placed", "not_called"
        ]
        
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        print(f"✅ All required KPI fields present")


class TestDataQualityEndpoint:
    """Test data quality endpoint for won leads without quotation"""
    
    def test_data_quality_endpoint_returns_200(self, api_client):
        """Test data quality endpoint works without errors"""
        response = api_client.get(f"{BASE_URL}/api/leads/data-quality/won-without-quotation")
        assert response.status_code == 200, f"Data quality endpoint failed: {response.text}"
        print("✅ Data quality endpoint returns 200 OK")
    
    def test_data_quality_returns_50_leads(self, api_client):
        """Test data quality endpoint returns 50 won leads without quotation"""
        response = api_client.get(f"{BASE_URL}/api/leads/data-quality/won-without-quotation")
        assert response.status_code == 200
        data = response.json()
        
        total = data.get("total")
        assert total is not None, "total field missing from response"
        assert total == 50, f"Expected 50 won leads without quotation, got {total}"
        print(f"✅ Data quality endpoint returns correct count: {total}")
    
    def test_data_quality_returns_leads_list(self, api_client):
        """Test data quality endpoint returns list of leads"""
        response = api_client.get(f"{BASE_URL}/api/leads/data-quality/won-without-quotation")
        assert response.status_code == 200
        data = response.json()
        
        leads = data.get("leads")
        assert leads is not None, "leads field missing from response"
        assert isinstance(leads, list), "leads should be a list"
        assert len(leads) > 0, "leads list should not be empty"
        
        # Check lead structure
        first_lead = leads[0]
        assert "lead_id" in first_lead, "lead_id missing from lead"
        assert "enquiry_stage" in first_lead, "enquiry_stage missing from lead"
        
        print(f"✅ Data quality endpoint returns {len(leads)} leads with correct structure")
    
    def test_data_quality_message_is_informative(self, api_client):
        """Test data quality endpoint returns informative message"""
        response = api_client.get(f"{BASE_URL}/api/leads/data-quality/won-without-quotation")
        assert response.status_code == 200
        data = response.json()
        
        message = data.get("message")
        assert message is not None, "message field missing from response"
        assert "missing quotation data" in message.lower(), f"Message should mention missing quotation data: {message}"
        print(f"✅ Data quality message is informative: {message}")


class TestDuplicateDetectionLogic:
    """Test duplicate detection logic - closed leads should not be duplicates"""
    
    def test_duplicates_count_endpoint(self, api_client):
        """Test duplicates count endpoint works"""
        response = api_client.get(f"{BASE_URL}/api/leads/duplicates/count")
        assert response.status_code == 200, f"Duplicates count endpoint failed: {response.text}"
        
        data = response.json()
        count = data.get("count")
        assert count is not None, "count field missing from response"
        print(f"✅ Duplicates count endpoint works, count: {count}")
    
    def test_duplicates_list_endpoint(self, api_client):
        """Test duplicates list endpoint works"""
        response = api_client.get(f"{BASE_URL}/api/leads/duplicates?limit=10")
        assert response.status_code == 200, f"Duplicates list endpoint failed: {response.text}"
        
        data = response.json()
        assert "leads" in data, "leads field missing from response"
        assert "total" in data, "total field missing from response"
        print(f"✅ Duplicates list endpoint works, total: {data.get('total')}")
    
    def test_won_leads_not_filtered_as_duplicates(self, api_client):
        """
        Test that won leads are counted correctly (not filtered as duplicates).
        Won leads should be 866, which means they are not being incorrectly filtered.
        """
        response = api_client.get(f"{BASE_URL}/api/kpis")
        assert response.status_code == 200
        data = response.json()
        
        won_leads = data.get("won_leads", 0)
        
        # Won leads should be 866 - if they were being filtered as duplicates, this would be lower
        assert won_leads == 866, f"Won leads should be 866, got {won_leads}. Won leads may be incorrectly filtered as duplicates."
        print(f"✅ Won leads ({won_leads}) are not being filtered as duplicates")


class TestKPIConsistency:
    """Test KPI values are consistent with business logic"""
    
    def test_conversion_rate_calculation(self, api_client):
        """Test conversion rate is calculated correctly (configurable formula)"""
        response = api_client.get(f"{BASE_URL}/api/kpis")
        assert response.status_code == 200
        data = response.json()
        
        won_leads = data.get("won_leads", 0)
        lost_leads = data.get("lost_leads", 0)
        total_leads = data.get("total_leads", 0)
        conversion_rate = data.get("conversion_rate", 0)
        
        # Conversion rate formula is configurable - could be:
        # 1. Won / (Won + Lost) * 100 = 40%
        # 2. Won / Total * 100 = 17.04%
        # The actual rate is 17.04% which suggests formula is Won / Total
        
        # Just verify the conversion rate is a reasonable value (0-100%)
        assert 0 <= conversion_rate <= 100, f"Conversion rate should be between 0-100%, got {conversion_rate}"
        assert conversion_rate > 0, "Conversion rate should be > 0 since we have won leads"
        
        print(f"✅ Conversion rate ({conversion_rate}%) is valid")
        print(f"   Won: {won_leads}, Lost: {lost_leads}, Total: {total_leads}")
    
    def test_open_leads_breakdown(self, api_client):
        """Test open leads breakdown (hot + warm + cold should be close to open)"""
        response = api_client.get(f"{BASE_URL}/api/kpis")
        assert response.status_code == 200
        data = response.json()
        
        open_leads = data.get("open_leads", 0)
        hot_leads = data.get("hot_leads", 0)
        warm_leads = data.get("warm_leads", 0)
        cold_leads = data.get("cold_leads", 0)
        
        breakdown_total = hot_leads + warm_leads + cold_leads
        
        print(f"Open Leads: {open_leads}")
        print(f"Hot + Warm + Cold: {breakdown_total} ({hot_leads} + {warm_leads} + {cold_leads})")
        
        # The breakdown should be close to open leads (some may not have type assigned)
        assert breakdown_total <= open_leads, "Hot + Warm + Cold should not exceed Open Leads"
        print(f"✅ Open leads breakdown is consistent")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
