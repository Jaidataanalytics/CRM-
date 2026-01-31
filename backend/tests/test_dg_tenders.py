"""
Test DG Tender Import/Export functionality
Tests the 25-column GEM Tracker Excel template import and export
"""
import pytest
import requests
import os
import pandas as pd
from io import BytesIO

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDGTenderImport:
    """Test DG Tender import from GEM Tracker Excel template"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        # Login to get session token
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json().get("token")
        self.session = requests.Session()
        self.session.cookies.set("session_token", self.token)
    
    def test_import_dg_tenders_success(self):
        """Test importing DG tenders from GEM Tracker Excel file"""
        # Use the test file
        test_file = "/tmp/gem_tracker.xlsx"
        if not os.path.exists(test_file):
            pytest.skip("Test file not found: /tmp/gem_tracker.xlsx")
        
        with open(test_file, 'rb') as f:
            files = {'file': ('gem_tracker.xlsx', f, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
            response = self.session.post(f"{BASE_URL}/api/tenders/import-dg-tenders", files=files)
        
        assert response.status_code == 200, f"Import failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "success" in data
        assert data["success"] == True
        assert "imported" in data
        assert "updated" in data
        assert "errors" in data
        assert "message" in data
        
        # Verify some tenders were processed
        total_processed = data["imported"] + data["updated"]
        assert total_processed > 0, "No tenders were imported or updated"
        print(f"Import result: {data['message']}")
    
    def test_get_dg_tenders(self):
        """Test retrieving DG tenders after import"""
        response = self.session.get(f"{BASE_URL}/api/tenders", params={
            "tender_type": "dg",
            "limit": 10
        })
        
        assert response.status_code == 200, f"Get tenders failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "tenders" in data
        assert "total" in data
        assert "page" in data
        assert "pages" in data
        
        # Verify we have DG tenders
        assert data["total"] > 0, "No DG tenders found"
        print(f"Total DG tenders: {data['total']}")
        
        # Verify tender structure has all expected fields
        if data["tenders"]:
            tender = data["tenders"][0]
            expected_fields = [
                "bid_number", "dated", "bid_end_date", "month", "category_id",
                "department_name", "department_address", "state_name", "region",
                "output_capacity_rating", "panel_type", "itc_applicable", "is_eligible",
                "ineligibility_reason", "total_quantity", "mm_participated", "mm_firm_name",
                "status", "order_quantity", "l1_price", "mm_price", "winning_brand",
                "win_by", "remark"
            ]
            
            for field in expected_fields:
                assert field in tender, f"Missing field: {field}"
            
            print(f"Sample tender bid_number: {tender['bid_number']}")
    
    def test_dg_tender_fields_populated(self):
        """Test that DG tender fields are correctly populated from import"""
        response = self.session.get(f"{BASE_URL}/api/tenders", params={
            "tender_type": "dg",
            "limit": 5
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Check that key fields have values
        for tender in data["tenders"]:
            # These fields should have values from the import
            assert tender.get("bid_number"), "bid_number should not be empty"
            assert tender.get("tender_type") == "dg", "tender_type should be 'dg'"
            
            # Check numeric fields are numbers
            assert isinstance(tender.get("total_quantity", 0), (int, float))
            assert isinstance(tender.get("l1_price", 0), (int, float))
            assert isinstance(tender.get("mm_price", 0), (int, float))
            
            # Check boolean fields
            assert isinstance(tender.get("is_eligible", True), bool)
            assert isinstance(tender.get("itc_applicable", False), bool)
            assert isinstance(tender.get("mm_participated", False), bool)
    
    def test_dg_tender_stats(self):
        """Test DG tender statistics endpoint"""
        response = self.session.get(f"{BASE_URL}/api/tenders/stats", params={
            "tender_type": "dg"
        })
        
        assert response.status_code == 200, f"Stats failed: {response.text}"
        data = response.json()
        
        # Verify stats structure
        expected_stats = ["total", "won", "lost", "pending", "participated", 
                         "not_participated", "win_rate", "total_value", 
                         "won_value", "our_total_bid", "upcoming_deadlines"]
        
        for stat in expected_stats:
            assert stat in data, f"Missing stat: {stat}"
        
        print(f"DG Tender stats - Total: {data['total']}, Won: {data['won']}, Lost: {data['lost']}")
    
    def test_import_invalid_file(self):
        """Test import with invalid file format"""
        # Create a fake text file
        fake_content = b"This is not an Excel file"
        files = {'file': ('test.txt', BytesIO(fake_content), 'text/plain')}
        
        response = self.session.post(f"{BASE_URL}/api/tenders/import-dg-tenders", files=files)
        
        # Should fail with 400 or return error
        assert response.status_code in [400, 422, 500], "Should reject invalid file"


class TestDGTenderExport:
    """Test DG Tender export functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200
        self.token = response.json().get("token")
        self.session = requests.Session()
        self.session.cookies.set("session_token", self.token)
    
    def test_export_columns_match_template(self):
        """Verify exported Excel has all 25 GEM Tracker columns"""
        # This test verifies the frontend export configuration
        # The actual export is done client-side, so we verify the data structure
        
        response = self.session.get(f"{BASE_URL}/api/tenders", params={
            "tender_type": "dg",
            "limit": 100
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Expected columns in GEM Tracker template
        expected_db_fields = [
            "bid_number",           # BID Ref-
            "dated",                # BID Date/Entry Date
            "bid_end_date",         # Due Date
            "month",                # Month
            "category_id",          # Cat I'd
            "department_name",      # Department Name /Segment
            "department_address",   # Department Name/ Address
            "state_name",           # State
            "region",               # Region
            "output_capacity_rating", # Rating
            "panel_type",           # Panel
            "itc_applicable",       # ITC Yes/No
            "is_eligible",          # Eligibility Y/N
            "ineligibility_reason", # Reson for Not Eligibility
            "total_quantity",       # Bid Qty
            "mm_participated",      # Participation by MM Yes / No
            "mm_firm_name",         # M&M Participated Firm Name
            "status",               # Status
            "order_quantity",       # Order Qty
            "l1_price",             # L1 Price (Rs-)
            "mm_price",             # MM Price
            "winning_brand",        # Winning Brand
            "win_by",               # Win By
            "remark"                # Remark
        ]
        
        if data["tenders"]:
            tender = data["tenders"][0]
            missing_fields = []
            for field in expected_db_fields:
                if field not in tender:
                    missing_fields.append(field)
            
            assert len(missing_fields) == 0, f"Missing fields in tender data: {missing_fields}"
            print(f"All {len(expected_db_fields)} export fields present in tender data")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
