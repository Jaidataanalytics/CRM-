"""
Test suite for Model Optimization Feature:
1. POST /api/forecast - model_info should show selected model name (e.g., 'Weighted Moving Average')
2. POST /api/forecast - model_info.accuracy should be >= 70%
3. POST /api/forecast - model_info.meets_threshold should be true
4. POST /api/forecast - model_info.optimization_results should show top 5 models tested
5. POST /api/forecast - model_info.recommendation should provide guidance text
6. POST /api/forecast - source_of_truth.accuracy should be >= 70%
7. POST /api/forecast - dimension_accuracies should show model name for each dimension
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestModelOptimization:
    """Test suite for model optimization - auto-selecting best forecasting model"""
    
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
        
        TestModelOptimization.forecast_data = data
        print("✅ Forecast generated successfully")
    
    def test_03_model_info_exists(self):
        """Test model_info object is returned in response"""
        assert self.forecast_data is not None, "Forecast data should exist"
        assert "model_info" in self.forecast_data, "Response should have 'model_info' key"
        
        model_info = self.forecast_data["model_info"]
        assert model_info is not None, "model_info should not be None"
        print(f"✅ model_info object exists: {model_info}")
    
    def test_04_model_info_has_type(self):
        """Test model_info has 'type' field with model name"""
        model_info = self.forecast_data["model_info"]
        
        assert "type" in model_info, "model_info should have 'type' field"
        model_type = model_info["type"]
        assert model_type is not None, "type should not be None"
        assert isinstance(model_type, str), "type should be a string"
        assert len(model_type) > 0, "type should not be empty"
        
        # Model type should be one of the valid model names
        valid_models = [
            "Simple Moving Average", 
            "Weighted Moving Average", 
            "Exponential Smoothing",
            "Seasonal (Same-Month)",
            "Linear Trend",
            "Random Forest",
            "XGBoost",
            "Ensemble (Hybrid)",
            "Simple Moving Average (Fallback)"
        ]
        
        # Check if model type contains any valid model name (for ensemble models)
        model_found = any(valid in model_type for valid in valid_models)
        assert model_found, f"model type '{model_type}' should be a valid model name"
        
        print(f"✅ model_info.type = '{model_type}'")
    
    def test_05_model_info_accuracy_at_least_70(self):
        """Test model_info.accuracy should be >= 70%"""
        model_info = self.forecast_data["model_info"]
        
        assert "accuracy" in model_info, "model_info should have 'accuracy' field"
        accuracy = model_info["accuracy"]
        assert accuracy is not None, "accuracy should not be None"
        assert isinstance(accuracy, (int, float)), "accuracy should be numeric"
        assert 0 <= accuracy <= 100, f"accuracy {accuracy} should be between 0 and 100"
        
        # Key requirement: accuracy should be >= 70%
        assert accuracy >= 70, f"Model accuracy ({accuracy}%) should be >= 70% (requirement)"
        
        print(f"✅ model_info.accuracy = {accuracy}% (>= 70% requirement met)")
    
    def test_06_model_info_meets_threshold_true(self):
        """Test model_info.meets_threshold should be true"""
        model_info = self.forecast_data["model_info"]
        
        assert "meets_threshold" in model_info, "model_info should have 'meets_threshold' field"
        meets_threshold = model_info["meets_threshold"]
        assert meets_threshold is not None, "meets_threshold should not be None"
        assert isinstance(meets_threshold, bool), "meets_threshold should be boolean"
        
        # Key requirement: meets_threshold should be True
        assert meets_threshold == True, f"meets_threshold should be True (accuracy >= 70%)"
        
        print(f"✅ model_info.meets_threshold = {meets_threshold}")
    
    def test_07_model_info_has_optimization_results(self):
        """Test model_info.optimization_results shows top 5 models tested"""
        model_info = self.forecast_data["model_info"]
        
        assert "optimization_results" in model_info, "model_info should have 'optimization_results' field"
        optimization_results = model_info["optimization_results"]
        assert optimization_results is not None, "optimization_results should not be None"
        assert isinstance(optimization_results, list), "optimization_results should be a list"
        
        # Should have up to 5 models
        assert len(optimization_results) > 0, "optimization_results should have at least 1 model"
        assert len(optimization_results) <= 5, "optimization_results should have at most 5 models"
        
        # Each result should have model name and accuracy
        for idx, result in enumerate(optimization_results):
            assert "model" in result, f"optimization_results[{idx}] should have 'model' field"
            assert "accuracy" in result, f"optimization_results[{idx}] should have 'accuracy' field"
            
            model_name = result["model"]
            model_accuracy = result["accuracy"]
            
            assert isinstance(model_name, str), f"model name should be string"
            assert isinstance(model_accuracy, (int, float)), f"model accuracy should be numeric"
            
            print(f"  Model {idx+1}: {model_name} - {model_accuracy}%")
        
        print(f"✅ optimization_results has {len(optimization_results)} models tested")
    
    def test_08_model_info_has_recommendation(self):
        """Test model_info.recommendation provides guidance text"""
        model_info = self.forecast_data["model_info"]
        
        assert "recommendation" in model_info, "model_info should have 'recommendation' field"
        recommendation = model_info["recommendation"]
        assert recommendation is not None, "recommendation should not be None"
        assert isinstance(recommendation, str), "recommendation should be a string"
        assert len(recommendation) > 0, "recommendation should not be empty"
        
        print(f"✅ model_info.recommendation = '{recommendation}'")
    
    def test_09_model_info_has_training_months(self):
        """Test model_info has training_months field"""
        model_info = self.forecast_data["model_info"]
        
        assert "training_months" in model_info, "model_info should have 'training_months' field"
        training_months = model_info["training_months"]
        assert training_months is not None, "training_months should not be None"
        assert isinstance(training_months, int), "training_months should be integer"
        assert training_months > 0, "training_months should be positive"
        
        print(f"✅ model_info.training_months = {training_months}")
    
    def test_10_source_of_truth_accuracy_at_least_70(self):
        """Test source_of_truth.accuracy should be >= 70%"""
        assert "source_of_truth" in self.forecast_data, "Response should have 'source_of_truth' key"
        source_of_truth = self.forecast_data["source_of_truth"]
        
        assert "accuracy" in source_of_truth, "source_of_truth should have 'accuracy' field"
        accuracy = source_of_truth["accuracy"]
        assert accuracy is not None, "accuracy should not be None"
        assert isinstance(accuracy, (int, float)), "accuracy should be numeric"
        
        # Key requirement: source_of_truth accuracy should be >= 70%
        assert accuracy >= 70, f"source_of_truth accuracy ({accuracy}%) should be >= 70% (requirement)"
        
        print(f"✅ source_of_truth.accuracy = {accuracy}% (>= 70% requirement met)")
    
    def test_11_dimension_accuracies_show_model_name(self):
        """Test dimension_accuracies should show model name for each dimension"""
        assert "dimension_accuracies" in self.forecast_data, "Response should have 'dimension_accuracies' key"
        dimension_accuracies = self.forecast_data["dimension_accuracies"]
        
        assert isinstance(dimension_accuracies, list), "dimension_accuracies should be a list"
        assert len(dimension_accuracies) > 0, "dimension_accuracies should have at least 1 dimension"
        
        for dim in dimension_accuracies:
            assert "dimension" in dim, "Each dimension accuracy should have 'dimension' field"
            assert "model" in dim, "Each dimension accuracy should have 'model' field"
            
            dimension_name = dim.get("dimension")
            model_name = dim.get("model")
            accuracy = dim.get("accuracy", 0)
            
            assert model_name is not None, f"model should not be None for dimension {dimension_name}"
            assert isinstance(model_name, str), f"model should be string for dimension {dimension_name}"
            
            print(f"  {dimension_name}: model='{model_name}', accuracy={accuracy}%")
        
        print(f"✅ All {len(dimension_accuracies)} dimensions have model name")
    
    def test_12_optimization_results_sorted_by_accuracy(self):
        """Test optimization_results are sorted by accuracy (highest first)"""
        model_info = self.forecast_data["model_info"]
        optimization_results = model_info.get("optimization_results", [])
        
        if len(optimization_results) > 1:
            accuracies = [r.get("accuracy", 0) for r in optimization_results]
            
            # Check if sorted in descending order
            is_sorted = all(accuracies[i] >= accuracies[i+1] for i in range(len(accuracies)-1))
            assert is_sorted, f"optimization_results should be sorted by accuracy (descending): {accuracies}"
            
            print(f"✅ optimization_results sorted by accuracy: {accuracies}")
        else:
            print("⚠️ Only 1 model in optimization_results, skipping sort check")
    
    def test_13_best_model_matches_first_optimization_result(self):
        """Test best model type matches the first (highest accuracy) optimization result"""
        model_info = self.forecast_data["model_info"]
        
        model_type = model_info.get("type", "")
        optimization_results = model_info.get("optimization_results", [])
        
        if optimization_results:
            best_result = optimization_results[0]
            best_model_name = best_result.get("model", "")
            
            # The model type should match or contain the best model name
            assert model_type == best_model_name or best_model_name in model_type, \
                f"model_info.type '{model_type}' should match best optimization result '{best_model_name}'"
            
            print(f"✅ Best model '{model_type}' matches top optimization result '{best_model_name}'")
        else:
            print("⚠️ No optimization_results to compare")
    
    def test_14_model_accuracy_consistency(self):
        """Test model accuracy is consistent between model_info and source_of_truth"""
        model_info = self.forecast_data["model_info"]
        source_of_truth = self.forecast_data["source_of_truth"]
        
        model_accuracy = model_info.get("accuracy", 0)
        source_accuracy = source_of_truth.get("accuracy", 0)
        
        # Source of truth accuracy should be >= model accuracy (it takes max of both)
        assert source_accuracy >= model_accuracy or abs(source_accuracy - model_accuracy) <= 1, \
            f"source_of_truth accuracy ({source_accuracy}%) should be >= model accuracy ({model_accuracy}%)"
        
        print(f"✅ Accuracy consistency: model={model_accuracy}%, source_of_truth={source_accuracy}%")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
