"""
Test suite for Forecast Features:
1. POST /api/forecast - verify breakdown data includes predicted_closures_category and conversion_rate
2. POST /api/forecast/save - verify saving a forecast returns success and projection_id
3. GET /api/forecast/saved - verify listing saved forecasts returns success with forecasts array
4. DELETE /api/forecast/saved/{index} - verify deleting a saved forecast works
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestForecastFeatures:
    """Test suite for forecast features including closures and conversion rates"""
    
    session = None
    session_token = None
    forecast_data = None
    
    @classmethod
    def setup_class(cls):
        """Login and get session token"""
        cls.session = requests.Session()
        cls.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = cls.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": "admin", "password": "admin123"}
        )
        
        if login_response.status_code == 200:
            # Extract session token from cookies
            cls.session_token = cls.session.cookies.get('session_token')
            print(f"✅ Login successful, session token obtained")
        else:
            print(f"❌ Login failed: {login_response.status_code} - {login_response.text}")
    
    def test_01_login_success(self):
        """Test admin login works"""
        assert self.session_token is not None, "Session token should be obtained after login"
        print("✅ Admin login successful")
    
    def test_02_generate_forecast_returns_success(self):
        """Test POST /api/forecast returns success"""
        response = self.session.post(
            f"{BASE_URL}/api/forecast",
            json={"horizon": 3}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("success") == True, "Forecast should return success=True"
        
        # Store forecast data for later tests
        TestForecastFeatures.forecast_data = data
        print("✅ Forecast generated successfully")
    
    def test_03_forecast_has_predictions(self):
        """Test forecast response has predictions array"""
        assert self.forecast_data is not None, "Forecast data should exist"
        assert "forecast" in self.forecast_data, "Response should have 'forecast' key"
        assert "predictions" in self.forecast_data["forecast"], "Forecast should have 'predictions'"
        
        predictions = self.forecast_data["forecast"]["predictions"]
        assert len(predictions) > 0, "Should have at least one prediction"
        print(f"✅ Forecast has {len(predictions)} predictions")
    
    def test_04_predictions_have_breakdown(self):
        """Test each prediction has breakdown data"""
        predictions = self.forecast_data["forecast"]["predictions"]
        
        for idx, pred in enumerate(predictions):
            assert "breakdown" in pred, f"Prediction {idx} should have 'breakdown'"
            breakdown = pred["breakdown"]
            
            # Check all breakdown types exist
            assert "by_kva" in breakdown, f"Prediction {idx} should have 'by_kva' breakdown"
            assert "by_state" in breakdown, f"Prediction {idx} should have 'by_state' breakdown"
            assert "by_dealer" in breakdown, f"Prediction {idx} should have 'by_dealer' breakdown"
            assert "by_employee" in breakdown, f"Prediction {idx} should have 'by_employee' breakdown"
            assert "by_segment" in breakdown, f"Prediction {idx} should have 'by_segment' breakdown"
        
        print("✅ All predictions have breakdown data for all dimensions")
    
    def test_05_kva_breakdown_has_closures_and_conversion(self):
        """Test KVA breakdown includes predicted_closures_category and conversion_rate"""
        predictions = self.forecast_data["forecast"]["predictions"]
        
        for pred_idx, pred in enumerate(predictions):
            kva_breakdown = pred["breakdown"]["by_kva"]
            
            for item_idx, item in enumerate(kva_breakdown):
                assert "predicted_closures_category" in item, \
                    f"KVA item {item_idx} in prediction {pred_idx} should have 'predicted_closures_category'"
                assert "conversion_rate" in item, \
                    f"KVA item {item_idx} in prediction {pred_idx} should have 'conversion_rate'"
                assert "predicted_leads" in item, \
                    f"KVA item {item_idx} in prediction {pred_idx} should have 'predicted_leads'"
                
                # Validate data types
                assert isinstance(item["predicted_closures_category"], (int, float)), \
                    "predicted_closures_category should be numeric"
                assert isinstance(item["conversion_rate"], (int, float)), \
                    "conversion_rate should be numeric"
        
        print("✅ KVA breakdown has predicted_closures_category and conversion_rate")
    
    def test_06_state_breakdown_has_closures_and_conversion(self):
        """Test State breakdown includes predicted_closures_category and conversion_rate"""
        predictions = self.forecast_data["forecast"]["predictions"]
        
        for pred_idx, pred in enumerate(predictions):
            state_breakdown = pred["breakdown"]["by_state"]
            
            if len(state_breakdown) > 0:
                for item_idx, item in enumerate(state_breakdown[:5]):  # Check first 5
                    assert "predicted_closures_category" in item, \
                        f"State item {item_idx} should have 'predicted_closures_category'"
                    assert "conversion_rate" in item, \
                        f"State item {item_idx} should have 'conversion_rate'"
        
        print("✅ State breakdown has predicted_closures_category and conversion_rate")
    
    def test_07_dealer_breakdown_has_closures_and_conversion(self):
        """Test Dealer breakdown includes predicted_closures_category and conversion_rate"""
        predictions = self.forecast_data["forecast"]["predictions"]
        
        for pred_idx, pred in enumerate(predictions):
            dealer_breakdown = pred["breakdown"]["by_dealer"]
            
            if len(dealer_breakdown) > 0:
                for item_idx, item in enumerate(dealer_breakdown[:5]):  # Check first 5
                    assert "predicted_closures_category" in item, \
                        f"Dealer item {item_idx} should have 'predicted_closures_category'"
                    assert "conversion_rate" in item, \
                        f"Dealer item {item_idx} should have 'conversion_rate'"
        
        print("✅ Dealer breakdown has predicted_closures_category and conversion_rate")
    
    def test_08_employee_breakdown_has_closures_and_conversion(self):
        """Test Employee breakdown includes predicted_closures_category and conversion_rate"""
        predictions = self.forecast_data["forecast"]["predictions"]
        
        for pred_idx, pred in enumerate(predictions):
            employee_breakdown = pred["breakdown"]["by_employee"]
            
            if len(employee_breakdown) > 0:
                for item_idx, item in enumerate(employee_breakdown[:5]):  # Check first 5
                    assert "predicted_closures_category" in item, \
                        f"Employee item {item_idx} should have 'predicted_closures_category'"
                    assert "conversion_rate" in item, \
                        f"Employee item {item_idx} should have 'conversion_rate'"
        
        print("✅ Employee breakdown has predicted_closures_category and conversion_rate")
    
    def test_09_segment_breakdown_has_closures_and_conversion(self):
        """Test Segment breakdown includes predicted_closures_category and conversion_rate"""
        predictions = self.forecast_data["forecast"]["predictions"]
        
        for pred_idx, pred in enumerate(predictions):
            segment_breakdown = pred["breakdown"]["by_segment"]
            
            if len(segment_breakdown) > 0:
                for item_idx, item in enumerate(segment_breakdown[:5]):  # Check first 5
                    assert "predicted_closures_category" in item, \
                        f"Segment item {item_idx} should have 'predicted_closures_category'"
                    assert "conversion_rate" in item, \
                        f"Segment item {item_idx} should have 'conversion_rate'"
        
        print("✅ Segment breakdown has predicted_closures_category and conversion_rate")
    
    def test_10_save_forecast_returns_success(self):
        """Test POST /api/forecast/save returns success and projection_id"""
        assert self.forecast_data is not None, "Need forecast data to save"
        
        response = self.session.post(
            f"{BASE_URL}/api/forecast/save",
            json={"forecast_data": self.forecast_data}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get("success") == True, "Save should return success=True"
        assert "projection_id" in data, "Save should return projection_id"
        assert data["projection_id"] is not None, "projection_id should not be None"
        
        print(f"✅ Forecast saved successfully with projection_id: {data['projection_id']}")
    
    def test_11_get_saved_forecasts_returns_list(self):
        """Test GET /api/forecast/saved returns forecasts array"""
        response = self.session.get(f"{BASE_URL}/api/forecast/saved")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert data.get("success") == True, "Should return success=True"
        assert "forecasts" in data, "Should have 'forecasts' key"
        assert isinstance(data["forecasts"], list), "forecasts should be a list"
        assert "total" in data, "Should have 'total' count"
        
        print(f"✅ Retrieved {data['total']} saved forecasts")
    
    def test_12_saved_forecasts_have_required_fields(self):
        """Test saved forecasts have required fields"""
        response = self.session.get(f"{BASE_URL}/api/forecast/saved")
        data = response.json()
        
        if len(data["forecasts"]) > 0:
            forecast = data["forecasts"][0]
            
            # Check required fields
            assert "saved_at" in forecast, "Saved forecast should have 'saved_at'"
            assert "saved_by" in forecast, "Saved forecast should have 'saved_by'"
            assert "horizon_months" in forecast, "Saved forecast should have 'horizon_months'"
            assert "index" in forecast, "Saved forecast should have 'index'"
            
            print(f"✅ Saved forecast has all required fields")
        else:
            print("⚠️ No saved forecasts to verify fields")
    
    def test_13_delete_saved_forecast(self):
        """Test DELETE /api/forecast/saved/{index} works"""
        # First get the list to find an index to delete
        response = self.session.get(f"{BASE_URL}/api/forecast/saved")
        data = response.json()
        
        if len(data["forecasts"]) > 0:
            # Get the first forecast's index
            index_to_delete = data["forecasts"][0]["index"]
            
            # Delete it
            delete_response = self.session.delete(
                f"{BASE_URL}/api/forecast/saved/{index_to_delete}"
            )
            
            assert delete_response.status_code == 200, \
                f"Expected 200, got {delete_response.status_code}: {delete_response.text}"
            delete_data = delete_response.json()
            
            assert delete_data.get("success") == True, "Delete should return success=True"
            print(f"✅ Successfully deleted forecast at index {index_to_delete}")
        else:
            print("⚠️ No saved forecasts to delete")
    
    def test_14_conversion_rate_is_percentage(self):
        """Test conversion_rate values are reasonable percentages (0-100)"""
        predictions = self.forecast_data["forecast"]["predictions"]
        
        for pred in predictions:
            for item in pred["breakdown"]["by_kva"]:
                conv_rate = item.get("conversion_rate", 0)
                assert 0 <= conv_rate <= 100, \
                    f"Conversion rate {conv_rate} should be between 0 and 100"
        
        print("✅ Conversion rates are valid percentages (0-100)")
    
    def test_15_closures_less_than_or_equal_to_leads(self):
        """Test predicted_closures_category <= predicted_leads"""
        predictions = self.forecast_data["forecast"]["predictions"]
        
        for pred in predictions:
            for item in pred["breakdown"]["by_kva"]:
                leads = item.get("predicted_leads", 0)
                closures = item.get("predicted_closures_category", 0)
                assert closures <= leads, \
                    f"Closures ({closures}) should be <= leads ({leads})"
        
        print("✅ Closures are always <= leads (logically correct)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
