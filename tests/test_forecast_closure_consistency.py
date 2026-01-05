"""
Test suite for Forecast Closure Consistency Feature:
1. POST /api/forecast - verify source_of_truth object is returned with dimension, accuracy, and explanation
2. POST /api/forecast - verify dimension_accuracies array is returned with accuracy for each dimension
3. POST /api/forecast - verify ALL breakdown closure totals are EQUAL (KVA sum = State sum = Dealer sum = Employee sum = Segment sum)
4. POST /api/forecast - verify breakdown closure totals MATCH the monthly predicted_closures
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestForecastClosureConsistency:
    """Test suite for forecast closure consistency - all breakdowns should sum to same total"""
    
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
            cls.session_token = cls.session.cookies.get('session_token')
            print(f"✅ Login successful")
        else:
            print(f"❌ Login failed: {login_response.status_code} - {login_response.text}")
    
    def test_01_login_success(self):
        """Test admin login works"""
        assert self.session_token is not None, "Session token should be obtained after login"
        print("✅ Admin login successful")
    
    def test_02_generate_forecast(self):
        """Generate forecast and store data for subsequent tests"""
        response = self.session.post(
            f"{BASE_URL}/api/forecast",
            json={"horizon": 3}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("success") == True, "Forecast should return success=True"
        
        TestForecastClosureConsistency.forecast_data = data
        print("✅ Forecast generated successfully")
    
    def test_03_source_of_truth_exists(self):
        """Test source_of_truth object is returned in response"""
        assert self.forecast_data is not None, "Forecast data should exist"
        assert "source_of_truth" in self.forecast_data, "Response should have 'source_of_truth' key"
        
        source_of_truth = self.forecast_data["source_of_truth"]
        assert source_of_truth is not None, "source_of_truth should not be None"
        print(f"✅ source_of_truth object exists: {source_of_truth}")
    
    def test_04_source_of_truth_has_dimension(self):
        """Test source_of_truth has 'dimension' field"""
        source_of_truth = self.forecast_data["source_of_truth"]
        
        assert "dimension" in source_of_truth, "source_of_truth should have 'dimension' field"
        dimension = source_of_truth["dimension"]
        assert dimension is not None, "dimension should not be None"
        assert isinstance(dimension, str), "dimension should be a string"
        
        # Dimension should be one of the valid options
        valid_dimensions = ["KVA", "State", "Dealer", "Employee", "Segment", "Overall"]
        assert dimension in valid_dimensions, f"dimension '{dimension}' should be one of {valid_dimensions}"
        
        print(f"✅ source_of_truth.dimension = '{dimension}'")
    
    def test_05_source_of_truth_has_accuracy(self):
        """Test source_of_truth has 'accuracy' field"""
        source_of_truth = self.forecast_data["source_of_truth"]
        
        assert "accuracy" in source_of_truth, "source_of_truth should have 'accuracy' field"
        accuracy = source_of_truth["accuracy"]
        assert accuracy is not None, "accuracy should not be None"
        assert isinstance(accuracy, (int, float)), "accuracy should be numeric"
        assert 0 <= accuracy <= 100, f"accuracy {accuracy} should be between 0 and 100"
        
        print(f"✅ source_of_truth.accuracy = {accuracy}%")
    
    def test_06_source_of_truth_has_explanation(self):
        """Test source_of_truth has 'explanation' field"""
        source_of_truth = self.forecast_data["source_of_truth"]
        
        assert "explanation" in source_of_truth, "source_of_truth should have 'explanation' field"
        explanation = source_of_truth["explanation"]
        assert explanation is not None, "explanation should not be None"
        assert isinstance(explanation, str), "explanation should be a string"
        assert len(explanation) > 0, "explanation should not be empty"
        
        print(f"✅ source_of_truth.explanation = '{explanation}'")
    
    def test_07_dimension_accuracies_exists(self):
        """Test dimension_accuracies array is returned"""
        assert "dimension_accuracies" in self.forecast_data, "Response should have 'dimension_accuracies' key"
        
        dimension_accuracies = self.forecast_data["dimension_accuracies"]
        assert dimension_accuracies is not None, "dimension_accuracies should not be None"
        assert isinstance(dimension_accuracies, list), "dimension_accuracies should be a list"
        
        print(f"✅ dimension_accuracies array exists with {len(dimension_accuracies)} items")
    
    def test_08_dimension_accuracies_has_all_dimensions(self):
        """Test dimension_accuracies has accuracy for each dimension"""
        dimension_accuracies = self.forecast_data["dimension_accuracies"]
        
        # Should have 5 dimensions: KVA, State, Dealer, Employee, Segment
        expected_dimensions = ["KVA", "State", "Dealer", "Employee", "Segment"]
        
        found_dimensions = [d.get("dimension") for d in dimension_accuracies]
        
        for expected in expected_dimensions:
            assert expected in found_dimensions, f"dimension_accuracies should include '{expected}'"
        
        print(f"✅ dimension_accuracies has all 5 dimensions: {found_dimensions}")
    
    def test_09_dimension_accuracies_have_required_fields(self):
        """Test each dimension accuracy has required fields"""
        dimension_accuracies = self.forecast_data["dimension_accuracies"]
        
        for dim in dimension_accuracies:
            assert "dimension" in dim, f"Dimension accuracy should have 'dimension' field"
            assert "accuracy" in dim, f"Dimension accuracy should have 'accuracy' field"
            
            # Accuracy should be numeric
            accuracy = dim.get("accuracy", 0)
            assert isinstance(accuracy, (int, float)), f"accuracy should be numeric, got {type(accuracy)}"
        
        print("✅ All dimension accuracies have required fields")
    
    def test_10_breakdown_closure_totals_are_equal(self):
        """CRITICAL: Test ALL breakdown closure totals are EQUAL for each month"""
        predictions = self.forecast_data["forecast"]["predictions"]
        
        for pred_idx, pred in enumerate(predictions):
            month = pred.get("month", f"Month {pred_idx}")
            breakdown = pred.get("breakdown", {})
            
            # Calculate sum of closures for each dimension
            kva_sum = sum(item.get("predicted_closures_category", 0) for item in breakdown.get("by_kva", []))
            state_sum = sum(item.get("predicted_closures_category", 0) for item in breakdown.get("by_state", []))
            dealer_sum = sum(item.get("predicted_closures_category", 0) for item in breakdown.get("by_dealer", []))
            employee_sum = sum(item.get("predicted_closures_category", 0) for item in breakdown.get("by_employee", []))
            segment_sum = sum(item.get("predicted_closures_category", 0) for item in breakdown.get("by_segment", []))
            
            print(f"\n  {month} closure totals:")
            print(f"    KVA sum:      {kva_sum}")
            print(f"    State sum:    {state_sum}")
            print(f"    Dealer sum:   {dealer_sum}")
            print(f"    Employee sum: {employee_sum}")
            print(f"    Segment sum:  {segment_sum}")
            
            # All sums should be equal
            all_sums = [kva_sum, state_sum, dealer_sum, employee_sum, segment_sum]
            
            # Check if all sums are equal (allowing for small rounding differences)
            max_sum = max(all_sums)
            min_sum = min(all_sums)
            
            # Allow tolerance of 1 for rounding errors
            assert max_sum - min_sum <= 1, \
                f"{month}: Closure totals differ! KVA={kva_sum}, State={state_sum}, Dealer={dealer_sum}, Employee={employee_sum}, Segment={segment_sum}"
        
        print("\n✅ ALL breakdown closure totals are EQUAL for all months")
    
    def test_11_breakdown_totals_match_monthly_closures(self):
        """CRITICAL: Test breakdown closure totals MATCH the monthly predicted_closures"""
        predictions = self.forecast_data["forecast"]["predictions"]
        
        for pred_idx, pred in enumerate(predictions):
            month = pred.get("month", f"Month {pred_idx}")
            monthly_closures = pred.get("predicted_closures", 0)
            breakdown = pred.get("breakdown", {})
            
            # Calculate sum of closures for KVA (representative of all breakdowns since they should be equal)
            kva_sum = sum(item.get("predicted_closures_category", 0) for item in breakdown.get("by_kva", []))
            
            print(f"\n  {month}:")
            print(f"    Monthly predicted_closures: {monthly_closures}")
            print(f"    KVA breakdown sum:          {kva_sum}")
            
            # Allow tolerance of 1 for rounding errors
            assert abs(monthly_closures - kva_sum) <= 1, \
                f"{month}: Monthly closures ({monthly_closures}) doesn't match breakdown sum ({kva_sum})"
        
        print("\n✅ Breakdown totals MATCH monthly predicted_closures for all months")
    
    def test_12_source_of_truth_dimension_has_highest_accuracy(self):
        """Test that source_of_truth dimension has the highest accuracy among all dimensions"""
        source_of_truth = self.forecast_data["source_of_truth"]
        dimension_accuracies = self.forecast_data["dimension_accuracies"]
        
        winning_dimension = source_of_truth.get("dimension")
        winning_accuracy = source_of_truth.get("accuracy")
        
        # Find max accuracy from dimension_accuracies
        valid_accuracies = [d for d in dimension_accuracies if d.get("accuracy", 0) > 0]
        
        if valid_accuracies:
            max_accuracy_dim = max(valid_accuracies, key=lambda x: x.get("accuracy", 0))
            
            print(f"\n  Winning dimension: {winning_dimension} ({winning_accuracy}%)")
            print(f"  Max accuracy dimension: {max_accuracy_dim.get('dimension')} ({max_accuracy_dim.get('accuracy')}%)")
            
            # The winning dimension should match the one with highest accuracy
            assert winning_dimension == max_accuracy_dim.get("dimension"), \
                f"source_of_truth dimension ({winning_dimension}) should be the one with highest accuracy ({max_accuracy_dim.get('dimension')})"
            
            print(f"\n✅ source_of_truth dimension '{winning_dimension}' has the highest accuracy")
        else:
            print("⚠️ No valid dimension accuracies to compare")
    
    def test_13_all_breakdowns_have_data(self):
        """Test that all breakdown types have data"""
        predictions = self.forecast_data["forecast"]["predictions"]
        
        for pred_idx, pred in enumerate(predictions):
            month = pred.get("month", f"Month {pred_idx}")
            breakdown = pred.get("breakdown", {})
            
            assert len(breakdown.get("by_kva", [])) > 0, f"{month}: by_kva should have data"
            assert len(breakdown.get("by_state", [])) > 0, f"{month}: by_state should have data"
            assert len(breakdown.get("by_dealer", [])) > 0, f"{month}: by_dealer should have data"
            assert len(breakdown.get("by_employee", [])) > 0, f"{month}: by_employee should have data"
            assert len(breakdown.get("by_segment", [])) > 0, f"{month}: by_segment should have data"
        
        print("✅ All breakdown types have data for all months")
    
    def test_14_conversion_rate_in_source_of_truth(self):
        """Test source_of_truth has conversion_rate field"""
        source_of_truth = self.forecast_data["source_of_truth"]
        
        assert "conversion_rate" in source_of_truth, "source_of_truth should have 'conversion_rate' field"
        conv_rate = source_of_truth["conversion_rate"]
        assert conv_rate is not None, "conversion_rate should not be None"
        assert isinstance(conv_rate, (int, float)), "conversion_rate should be numeric"
        assert 0 <= conv_rate <= 100, f"conversion_rate {conv_rate} should be between 0 and 100"
        
        print(f"✅ source_of_truth.conversion_rate = {conv_rate}%")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
