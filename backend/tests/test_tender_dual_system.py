"""
Test suite for Dual-Tender System (MLT vs DG)
Tests:
- Toggle between MLT and DG tender types
- Create MLT tender with all fields
- Create DG tender with DG-specific fields
- Verify updated_at and updated_by tracking
- Verify DG-specific fields in response
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestTenderDualSystem:
    """Test dual-tender system (MLT vs DG)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": "admin", "password": "admin123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        # Store cookies for subsequent requests
        self.cookies = login_response.cookies
        
    def test_01_list_mlt_tenders(self):
        """Test listing MLT tenders"""
        response = self.session.get(
            f"{BASE_URL}/api/tenders?tender_type=mlt&page=1&limit=10",
            cookies=self.cookies
        )
        assert response.status_code == 200, f"Failed to list MLT tenders: {response.text}"
        
        data = response.json()
        assert "tenders" in data
        assert "total" in data
        assert "page" in data
        print(f"✓ MLT tenders list: {data['total']} total tenders")
        
    def test_02_list_dg_tenders(self):
        """Test listing DG tenders"""
        response = self.session.get(
            f"{BASE_URL}/api/tenders?tender_type=dg&page=1&limit=10",
            cookies=self.cookies
        )
        assert response.status_code == 200, f"Failed to list DG tenders: {response.text}"
        
        data = response.json()
        assert "tenders" in data
        assert "total" in data
        print(f"✓ DG tenders list: {data['total']} total tenders")
        
    def test_03_get_mlt_stats(self):
        """Test getting MLT tender stats"""
        response = self.session.get(
            f"{BASE_URL}/api/tenders/stats?tender_type=mlt",
            cookies=self.cookies
        )
        assert response.status_code == 200, f"Failed to get MLT stats: {response.text}"
        
        data = response.json()
        assert "total" in data
        assert "won" in data
        assert "lost" in data
        assert "pending" in data
        print(f"✓ MLT stats: total={data['total']}, won={data['won']}, lost={data['lost']}")
        
    def test_04_get_dg_stats(self):
        """Test getting DG tender stats"""
        response = self.session.get(
            f"{BASE_URL}/api/tenders/stats?tender_type=dg",
            cookies=self.cookies
        )
        assert response.status_code == 200, f"Failed to get DG stats: {response.text}"
        
        data = response.json()
        assert "total" in data
        assert "won" in data
        assert "lost" in data
        print(f"✓ DG stats: total={data['total']}, won={data['won']}, lost={data['lost']}")
        
    def test_05_create_mlt_tender(self):
        """Test creating an MLT tender"""
        mlt_tender = {
            "tender_type": "mlt",
            "bid_number": f"TEST_MLT_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "dated": "2025-01-29",
            "bid_end_date": "2025-02-15 17:00:00",
            "bid_opening_date": "2025-02-16 10:00:00",
            "department_name": "Test Department MLT",
            "total_quantity": 100,
            "estimated_value": 5000000,
            "beneficiary": "Test Beneficiary",
            "emd_amount": 50000,
            "item_specifications": "Test MLT specifications",
            "product_category": "MLT Product",
            "delivery_period": 30,
            "warranty_period": "12 months",
            "payment_terms": "30 days",
            "status": "pending",
            "our_bid_amount": 4500000,
            "assigned_employee": "Test Employee",
            "notes": "Test MLT tender notes"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/tenders",
            json=mlt_tender,
            cookies=self.cookies
        )
        assert response.status_code == 200, f"Failed to create MLT tender: {response.text}"
        
        data = response.json()
        assert data["tender_type"] == "mlt"
        assert data["bid_number"] == mlt_tender["bid_number"]
        assert data["department_name"] == mlt_tender["department_name"]
        assert "created_at" in data
        assert "updated_at" in data
        assert "updated_by" in data
        assert "created_by" in data
        
        # Store for cleanup
        self.__class__.mlt_tender_id = data["_id"]
        print(f"✓ Created MLT tender: {data['bid_number']}, updated_by: {data['updated_by']}")
        
    def test_06_create_dg_tender_with_all_fields(self):
        """Test creating a DG tender with all DG-specific fields"""
        dg_tender = {
            "tender_type": "dg",
            "bid_number": f"TEST_DG_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "dated": "2025-01-29",
            "bid_end_date": "2025-02-20 17:00:00",
            "bid_opening_date": "2025-02-21 10:00:00",
            "department_name": "Test DG Department",
            "total_quantity": 5,
            # DG-specific fields
            "address": "123 Test Address, Test City",
            "state_name": "Maharashtra",
            "output_capacity_rating": "125 KVA / Three Phase",
            "control_panel": "Digital Control Panel",
            "installation": "yes",
            "is_eligible": True,
            "eligibility_reason": "",
            "l1_price": 1500000,
            "mm_price": 1450000,
            "winning_brand": "Test Brand",
            "participation_by_mm": "yes",
            "win_by": "M&M",
            "remark": "Test DG tender remark",
            "status": "won"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/tenders",
            json=dg_tender,
            cookies=self.cookies
        )
        assert response.status_code == 200, f"Failed to create DG tender: {response.text}"
        
        data = response.json()
        
        # Verify tender_type
        assert data["tender_type"] == "dg"
        
        # Verify DG-specific fields
        assert data["state_name"] == dg_tender["state_name"]
        assert data["output_capacity_rating"] == dg_tender["output_capacity_rating"]
        assert data["control_panel"] == dg_tender["control_panel"]
        assert data["installation"] == dg_tender["installation"]
        assert data["is_eligible"] == dg_tender["is_eligible"]
        assert data["l1_price"] == dg_tender["l1_price"]
        assert data["mm_price"] == dg_tender["mm_price"]
        assert data["winning_brand"] == dg_tender["winning_brand"]
        assert data["participation_by_mm"] == dg_tender["participation_by_mm"]
        assert data["win_by"] == dg_tender["win_by"]
        assert data["remark"] == dg_tender["remark"]
        
        # Verify tracking fields
        assert "created_at" in data
        assert "updated_at" in data
        assert "updated_by" in data
        assert "created_by" in data
        
        # Store for cleanup and further tests
        self.__class__.dg_tender_id = data["_id"]
        print(f"✓ Created DG tender with all fields: {data['bid_number']}")
        print(f"  - State: {data['state_name']}")
        print(f"  - KVA Rating: {data['output_capacity_rating']}")
        print(f"  - L1 Price: {data['l1_price']}")
        print(f"  - MM Price: {data['mm_price']}")
        print(f"  - Winning Brand: {data['winning_brand']}")
        print(f"  - updated_by: {data['updated_by']}")
        
    def test_07_get_dg_tender_detail(self):
        """Test getting DG tender detail with all DG fields"""
        if not hasattr(self.__class__, 'dg_tender_id'):
            pytest.skip("DG tender not created")
            
        response = self.session.get(
            f"{BASE_URL}/api/tenders/{self.__class__.dg_tender_id}",
            cookies=self.cookies
        )
        assert response.status_code == 200, f"Failed to get DG tender: {response.text}"
        
        data = response.json()
        
        # Verify DG-specific fields are present
        assert "state_name" in data
        assert "output_capacity_rating" in data
        assert "l1_price" in data
        assert "mm_price" in data
        assert "winning_brand" in data
        assert "participation_by_mm" in data
        assert "win_by" in data
        assert "remark" in data
        assert "updated_at" in data
        assert "updated_by" in data
        
        print(f"✓ DG tender detail retrieved with all DG fields")
        
    def test_08_update_tender_and_verify_updated_by(self):
        """Test updating a tender and verify updated_at/updated_by are set"""
        if not hasattr(self.__class__, 'dg_tender_id'):
            pytest.skip("DG tender not created")
            
        update_data = {
            "status": "participated",
            "l1_price": 1600000,
            "mm_price": 1550000,
            "remark": "Updated remark after participation"
        }
        
        response = self.session.put(
            f"{BASE_URL}/api/tenders/{self.__class__.dg_tender_id}",
            json=update_data,
            cookies=self.cookies
        )
        assert response.status_code == 200, f"Failed to update tender: {response.text}"
        
        data = response.json()
        
        # Verify updated fields
        assert data["status"] == "participated"
        assert data["l1_price"] == 1600000
        assert data["mm_price"] == 1550000
        assert data["remark"] == "Updated remark after participation"
        
        # Verify updated_at and updated_by are set
        assert "updated_at" in data
        assert "updated_by" in data
        assert data["updated_by"] is not None
        
        print(f"✓ Tender updated successfully")
        print(f"  - updated_at: {data['updated_at']}")
        print(f"  - updated_by: {data['updated_by']}")
        
    def test_09_create_ineligible_dg_tender(self):
        """Test creating a DG tender marked as ineligible"""
        dg_tender = {
            "tender_type": "dg",
            "bid_number": f"TEST_DG_INELIG_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "dated": "2025-01-29",
            "bid_end_date": "2025-02-25 17:00:00",
            "department_name": "Test Ineligible DG Dept",
            "total_quantity": 3,
            "state_name": "Gujarat",
            "output_capacity_rating": "50 KVA / Single Phase",
            "is_eligible": False,
            "eligibility_reason": "Does not meet technical specifications",
            "status": "not_participated"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/tenders",
            json=dg_tender,
            cookies=self.cookies
        )
        assert response.status_code == 200, f"Failed to create ineligible DG tender: {response.text}"
        
        data = response.json()
        assert data["is_eligible"] == False
        assert data["eligibility_reason"] == "Does not meet technical specifications"
        
        # Store for cleanup
        self.__class__.ineligible_tender_id = data["_id"]
        print(f"✓ Created ineligible DG tender: is_eligible={data['is_eligible']}")
        
    def test_10_verify_dg_tenders_in_list(self):
        """Verify DG tenders appear in DG list with correct columns"""
        response = self.session.get(
            f"{BASE_URL}/api/tenders?tender_type=dg&page=1&limit=50",
            cookies=self.cookies
        )
        assert response.status_code == 200
        
        data = response.json()
        
        # Find our test DG tender
        test_tenders = [t for t in data["tenders"] if t["bid_number"].startswith("TEST_DG")]
        assert len(test_tenders) > 0, "Test DG tenders not found in list"
        
        for tender in test_tenders:
            # Verify DG-specific fields are present
            assert "state_name" in tender
            assert "output_capacity_rating" in tender
            assert "is_eligible" in tender
            assert "updated_at" in tender
            assert "updated_by" in tender
            
        print(f"✓ Found {len(test_tenders)} test DG tenders in list with all DG fields")
        
    def test_11_cleanup_test_tenders(self):
        """Cleanup test tenders"""
        deleted = 0
        
        if hasattr(self.__class__, 'mlt_tender_id'):
            response = self.session.delete(
                f"{BASE_URL}/api/tenders/{self.__class__.mlt_tender_id}",
                cookies=self.cookies
            )
            if response.status_code == 200:
                deleted += 1
                
        if hasattr(self.__class__, 'dg_tender_id'):
            response = self.session.delete(
                f"{BASE_URL}/api/tenders/{self.__class__.dg_tender_id}",
                cookies=self.cookies
            )
            if response.status_code == 200:
                deleted += 1
                
        if hasattr(self.__class__, 'ineligible_tender_id'):
            response = self.session.delete(
                f"{BASE_URL}/api/tenders/{self.__class__.ineligible_tender_id}",
                cookies=self.cookies
            )
            if response.status_code == 200:
                deleted += 1
                
        print(f"✓ Cleaned up {deleted} test tenders")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
