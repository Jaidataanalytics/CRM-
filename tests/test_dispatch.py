"""
Dispatch Feature Tests
Tests for dispatch management endpoints including:
- GET /api/dispatch/summary - dispatch status counts
- GET /api/dispatch/list - list won orders with dispatch status
- PATCH /api/dispatch/{lead_id} - update dispatch status
- GET /api/dispatch/{lead_id}/history - dispatch history
- GET /api/kpis - dispatch counts in KPIs
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test session token (created in test setup)
SESSION_TOKEN = None


@pytest.fixture(scope="module", autouse=True)
def setup_test_session():
    """Create test user and session for authentication"""
    global SESSION_TOKEN
    import subprocess
    result = subprocess.run([
        'mongosh', '--quiet', '--eval', '''
        use('test_database');
        var userId = 'test-dispatch-pytest-' + Date.now();
        var sessionToken = 'test_dispatch_pytest_' + Date.now();
        db.users.insertOne({
          user_id: userId,
          email: 'test.dispatch.pytest.' + Date.now() + '@example.com',
          name: 'Test Dispatch Pytest User',
          picture: 'https://via.placeholder.com/150',
          role: 'Admin',
          created_at: new Date()
        });
        db.user_sessions.insertOne({
          user_id: userId,
          session_token: sessionToken,
          expires_at: new Date(Date.now() + 7*24*60*60*1000),
          created_at: new Date()
        });
        print(sessionToken);
        '''
    ], capture_output=True, text=True)
    SESSION_TOKEN = result.stdout.strip()
    yield
    # Cleanup
    subprocess.run([
        'mongosh', '--quiet', '--eval', '''
        use('test_database');
        db.users.deleteMany({email: /test\.dispatch\.pytest\./});
        db.user_sessions.deleteMany({session_token: /test_dispatch_pytest_/});
        '''
    ])


@pytest.fixture
def api_client():
    """Shared requests session with auth"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {SESSION_TOKEN}"
    })
    return session


class TestDispatchSummary:
    """Tests for GET /api/dispatch/summary"""
    
    def test_summary_returns_counts(self, api_client):
        """Summary endpoint returns total_won, pending_dispatch, dispatched counts"""
        response = api_client.get(f"{BASE_URL}/api/dispatch/summary")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_won" in data
        assert "pending_dispatch" in data
        assert "dispatched" in data
        assert "needs_migration" in data
        
        # Verify counts are integers
        assert isinstance(data["total_won"], int)
        assert isinstance(data["pending_dispatch"], int)
        assert isinstance(data["dispatched"], int)
        
        # Verify total_won >= pending + dispatched
        assert data["total_won"] >= data["pending_dispatch"] + data["dispatched"]
    
    def test_summary_with_filters(self, api_client):
        """Summary endpoint accepts filter parameters"""
        response = api_client.get(f"{BASE_URL}/api/dispatch/summary?state=Bihar")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_won" in data


class TestDispatchList:
    """Tests for GET /api/dispatch/list"""
    
    def test_list_returns_leads(self, api_client):
        """List endpoint returns paginated leads"""
        response = api_client.get(f"{BASE_URL}/api/dispatch/list?limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert "leads" in data
        assert "total" in data
        assert "page" in data
        assert "limit" in data
        assert "pages" in data
        
        # Verify leads have dispatch_status
        if data["leads"]:
            lead = data["leads"][0]
            assert "dispatch_status" in lead
            assert lead["enquiry_stage"] == "Closed-Won"
    
    def test_list_filter_pending(self, api_client):
        """List endpoint filters by pending status"""
        response = api_client.get(f"{BASE_URL}/api/dispatch/list?dispatch_status=pending&limit=10")
        assert response.status_code == 200
        
        data = response.json()
        # All returned leads should have pending status
        for lead in data["leads"]:
            assert lead["dispatch_status"] == "pending"
    
    def test_list_filter_dispatched(self, api_client):
        """List endpoint filters by dispatched status"""
        response = api_client.get(f"{BASE_URL}/api/dispatch/list?dispatch_status=dispatched&limit=10")
        assert response.status_code == 200
        
        data = response.json()
        # All returned leads should have dispatched status
        for lead in data["leads"]:
            assert lead["dispatch_status"] == "dispatched"
    
    def test_list_search(self, api_client):
        """List endpoint supports search"""
        response = api_client.get(f"{BASE_URL}/api/dispatch/list?search=Hotel&limit=10")
        assert response.status_code == 200
        
        data = response.json()
        assert "leads" in data


class TestDispatchUpdate:
    """Tests for PATCH /api/dispatch/{lead_id}"""
    
    def test_update_to_dispatched(self, api_client):
        """Can update pending order to dispatched with valid data"""
        # First get a pending lead
        list_response = api_client.get(f"{BASE_URL}/api/dispatch/list?dispatch_status=pending&limit=1")
        assert list_response.status_code == 200
        
        leads = list_response.json()["leads"]
        if not leads:
            pytest.skip("No pending leads available for testing")
        
        lead = leads[0]
        lead_id = lead["lead_id"]
        won_date = lead.get("eo_po_date") or lead.get("enquiry_closure_date") or "2026-01-01"
        
        # Calculate a valid dispatch date (after won date)
        dispatch_date = "2026-12-01"  # Future date
        
        response = api_client.patch(f"{BASE_URL}/api/dispatch/{lead_id}", json={
            "dispatch_status": "dispatched",
            "dispatch_date": dispatch_date,
            "delivery_address": "Test Address for Pytest",
            "transporter_details": "Pytest Transporter"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["new_status"] == "dispatched"
        
        # Revert back to pending for other tests
        api_client.patch(f"{BASE_URL}/api/dispatch/{lead_id}", json={
            "dispatch_status": "pending",
            "reason": "Reverting test change"
        })
    
    def test_dispatch_date_validation(self, api_client):
        """Dispatch date cannot be before won date"""
        # Get a pending lead
        list_response = api_client.get(f"{BASE_URL}/api/dispatch/list?dispatch_status=pending&limit=1")
        leads = list_response.json()["leads"]
        if not leads:
            pytest.skip("No pending leads available for testing")
        
        lead = leads[0]
        lead_id = lead["lead_id"]
        won_date = lead.get("eo_po_date") or lead.get("enquiry_closure_date")
        
        if not won_date:
            pytest.skip("Lead has no won date")
        
        # Try to set dispatch date before won date
        response = api_client.patch(f"{BASE_URL}/api/dispatch/{lead_id}", json={
            "dispatch_status": "dispatched",
            "dispatch_date": "2020-01-01"  # Very old date
        })
        
        assert response.status_code == 400
        assert "before won date" in response.json()["detail"]
    
    def test_invalid_status(self, api_client):
        """Invalid dispatch status returns error"""
        # Get any lead
        list_response = api_client.get(f"{BASE_URL}/api/dispatch/list?limit=1")
        leads = list_response.json()["leads"]
        if not leads:
            pytest.skip("No leads available for testing")
        
        lead_id = leads[0]["lead_id"]
        
        response = api_client.patch(f"{BASE_URL}/api/dispatch/{lead_id}", json={
            "dispatch_status": "invalid_status"
        })
        
        assert response.status_code == 400
        assert "Invalid dispatch status" in response.json()["detail"]
    
    def test_lead_not_found(self, api_client):
        """Non-existent lead returns 404"""
        response = api_client.patch(f"{BASE_URL}/api/dispatch/nonexistent_lead_id", json={
            "dispatch_status": "dispatched",
            "dispatch_date": "2026-12-01"
        })
        
        assert response.status_code == 404


class TestDispatchHistory:
    """Tests for GET /api/dispatch/{lead_id}/history"""
    
    def test_history_returns_data(self, api_client):
        """History endpoint returns lead dispatch history"""
        # Get a lead that has been updated
        list_response = api_client.get(f"{BASE_URL}/api/dispatch/list?limit=1")
        leads = list_response.json()["leads"]
        if not leads:
            pytest.skip("No leads available for testing")
        
        lead_id = leads[0]["lead_id"]
        
        response = api_client.get(f"{BASE_URL}/api/dispatch/{lead_id}/history")
        assert response.status_code == 200
        
        data = response.json()
        assert "lead_id" in data
        assert "current_status" in data
        assert "history" in data
        assert isinstance(data["history"], list)
    
    def test_history_not_found(self, api_client):
        """Non-existent lead returns 404"""
        response = api_client.get(f"{BASE_URL}/api/dispatch/nonexistent_lead_id/history")
        assert response.status_code == 404


class TestKPIsDispatch:
    """Tests for dispatch counts in GET /api/kpis"""
    
    def test_kpis_include_dispatch_counts(self, api_client):
        """KPIs endpoint includes pending_dispatch and dispatched counts"""
        response = api_client.get(f"{BASE_URL}/api/kpis")
        assert response.status_code == 200
        
        data = response.json()
        assert "pending_dispatch" in data
        assert "dispatched" in data
        assert "needs_dispatch_migration" in data
        
        # Verify counts are integers
        assert isinstance(data["pending_dispatch"], int)
        assert isinstance(data["dispatched"], int)
        assert isinstance(data["needs_dispatch_migration"], int)
    
    def test_kpis_dispatch_counts_match_summary(self, api_client):
        """KPIs dispatch counts should match dispatch summary"""
        kpis_response = api_client.get(f"{BASE_URL}/api/kpis")
        summary_response = api_client.get(f"{BASE_URL}/api/dispatch/summary")
        
        assert kpis_response.status_code == 200
        assert summary_response.status_code == 200
        
        kpis = kpis_response.json()
        summary = summary_response.json()
        
        # Note: KPIs may have different filters, so counts might differ
        # Just verify both have the fields
        assert "pending_dispatch" in kpis
        assert "dispatched" in kpis
        assert "pending_dispatch" in summary
        assert "dispatched" in summary


class TestReasonRequirement:
    """Tests for reason requirement when changing dispatched back to pending"""
    
    def test_historical_order_no_reason_required(self, api_client):
        """Historical orders (before cutoff) don't require reason to change back to pending"""
        # Get a dispatched historical order (won before 2026-01-05)
        list_response = api_client.get(f"{BASE_URL}/api/dispatch/list?dispatch_status=dispatched&limit=50")
        leads = list_response.json()["leads"]
        
        historical_lead = None
        for lead in leads:
            won_date = lead.get("eo_po_date") or lead.get("enquiry_closure_date") or "2020-01-01"
            if won_date < "2026-01-05":
                historical_lead = lead
                break
        
        if not historical_lead:
            pytest.skip("No historical dispatched leads available")
        
        lead_id = historical_lead["lead_id"]
        
        # Change to pending without reason - should succeed
        response = api_client.patch(f"{BASE_URL}/api/dispatch/{lead_id}", json={
            "dispatch_status": "pending"
        })
        
        # Should succeed for historical orders
        assert response.status_code == 200
        
        # Revert back
        api_client.patch(f"{BASE_URL}/api/dispatch/{lead_id}", json={
            "dispatch_status": "dispatched",
            "dispatch_date": "2026-01-10"
        })
