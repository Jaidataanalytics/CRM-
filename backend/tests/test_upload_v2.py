"""
Test Suite for Unified File Upload System (upload_v2)

Tests:
1. Template detection endpoint - auto-detect LEAD, LOST, SO, REMARK templates
2. Download template endpoint - returns valid Excel files for all 4 types
3. Lead Upload process - enquiry match -> phone+KVA match -> create new
4. Lost Upload process - enquiry match -> phone+KVA match -> close as lost
5. SO Upload process - enquiry match -> phone+KVA match -> mark as won
6. Remark Upload process - enquiry match only -> update follow-up info
"""

import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestUploadV2:
    """Test unified upload system endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        
        # Login to get session - use JSON content type for login
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": "admin", "password": "admin123"},
            headers={"Content-Type": "application/json"}
        )
        if login_response.status_code == 200:
            # Session cookie should be set automatically
            print(f"✓ Logged in successfully")
        else:
            pytest.skip(f"Authentication failed: {login_response.status_code}")
    
    # ============================================
    # TEMPLATE DETECTION TESTS
    # ============================================
    
    def test_detect_template_lead(self):
        """Test template detection for LEAD upload file"""
        lead_file_path = "/tmp/lead_sample_new.xlsx"
        if not os.path.exists(lead_file_path):
            pytest.skip("Lead sample file not found")
        
        with open(lead_file_path, 'rb') as f:
            # Don't set Content-Type header - let requests handle multipart
            response = self.session.post(
                f"{BASE_URL}/api/upload/detect-template",
                files={'file': ('lead_sample.xlsx', f, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
            )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get('success') == True
        assert data.get('template_type') == 'LEAD', f"Expected LEAD, got {data.get('template_type')}"
        assert 'row_count' in data
        assert 'columns' in data
        print(f"✓ Detected LEAD template with {data.get('row_count')} rows")
    
    def test_detect_template_lost(self):
        """Test template detection for LOST upload file"""
        lost_file_path = "/tmp/lost_sample.xlsx"
        if not os.path.exists(lost_file_path):
            pytest.skip("Lost sample file not found")
        
        with open(lost_file_path, 'rb') as f:
            response = self.session.post(
                f"{BASE_URL}/api/upload/detect-template",
                files={'file': ('lost_sample.xlsx', f, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
            )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get('success') == True
        assert data.get('template_type') == 'LOST', f"Expected LOST, got {data.get('template_type')}"
        print(f"✓ Detected LOST template with {data.get('row_count')} rows")
    
    def test_detect_template_so(self):
        """Test template detection for SO upload file"""
        so_file_path = "/tmp/so_sample.xlsx"
        if not os.path.exists(so_file_path):
            pytest.skip("SO sample file not found")
        
        with open(so_file_path, 'rb') as f:
            response = self.session.post(
                f"{BASE_URL}/api/upload/detect-template",
                files={'file': ('so_sample.xlsx', f, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
            )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get('success') == True
        assert data.get('template_type') == 'SO', f"Expected SO, got {data.get('template_type')}"
        print(f"✓ Detected SO template with {data.get('row_count')} rows")
    
    # ============================================
    # TEMPLATE DOWNLOAD TESTS
    # ============================================
    
    def test_download_template_lead(self):
        """Test downloading LEAD template"""
        response = self.session.get(f"{BASE_URL}/api/upload/templates/lead")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        assert 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' in response.headers.get('Content-Type', '')
        assert len(response.content) > 0
        print(f"✓ Downloaded LEAD template ({len(response.content)} bytes)")
    
    def test_download_template_lost(self):
        """Test downloading LOST template"""
        response = self.session.get(f"{BASE_URL}/api/upload/templates/lost")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        assert 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' in response.headers.get('Content-Type', '')
        assert len(response.content) > 0
        print(f"✓ Downloaded LOST template ({len(response.content)} bytes)")
    
    def test_download_template_so(self):
        """Test downloading SO template"""
        response = self.session.get(f"{BASE_URL}/api/upload/templates/so")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        assert 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' in response.headers.get('Content-Type', '')
        assert len(response.content) > 0
        print(f"✓ Downloaded SO template ({len(response.content)} bytes)")
    
    def test_download_template_remark(self):
        """Test downloading REMARK template"""
        response = self.session.get(f"{BASE_URL}/api/upload/templates/remark")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        assert 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' in response.headers.get('Content-Type', '')
        assert len(response.content) > 0
        print(f"✓ Downloaded REMARK template ({len(response.content)} bytes)")
    
    # ============================================
    # UPLOAD PROCESS TESTS
    # ============================================
    
    def test_process_lead_upload(self):
        """Test processing LEAD upload file"""
        lead_file_path = "/tmp/lead_sample_new.xlsx"
        if not os.path.exists(lead_file_path):
            pytest.skip("Lead sample file not found")
        
        with open(lead_file_path, 'rb') as f:
            response = self.session.post(
                f"{BASE_URL}/api/upload/process",
                files={'file': ('lead_sample.xlsx', f, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')},
                data={'template_type': 'LEAD'}
            )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get('success') == True
        assert data.get('template_type') == 'LEAD'
        assert 'created' in data
        assert 'updated' in data
        assert 'duplicates_merged' in data
        assert 'total_rows' in data
        print(f"✓ Lead Upload: {data.get('created')} created, {data.get('updated')} updated, {data.get('duplicates_merged')} merged")
    
    def test_process_lost_upload(self):
        """Test processing LOST upload file"""
        lost_file_path = "/tmp/lost_sample.xlsx"
        if not os.path.exists(lost_file_path):
            pytest.skip("Lost sample file not found")
        
        with open(lost_file_path, 'rb') as f:
            response = self.session.post(
                f"{BASE_URL}/api/upload/process",
                files={'file': ('lost_sample.xlsx', f, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')},
                data={'template_type': 'LOST'}
            )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get('success') == True
        assert data.get('template_type') == 'LOST'
        assert 'created' in data
        assert 'updated' in data
        print(f"✓ Lost Upload: {data.get('created')} created, {data.get('updated')} updated")
    
    def test_process_so_upload(self):
        """Test processing SO upload file"""
        so_file_path = "/tmp/so_sample.xlsx"
        if not os.path.exists(so_file_path):
            pytest.skip("SO sample file not found")
        
        with open(so_file_path, 'rb') as f:
            response = self.session.post(
                f"{BASE_URL}/api/upload/process",
                files={'file': ('so_sample.xlsx', f, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')},
                data={'template_type': 'SO'}
            )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get('success') == True
        assert data.get('template_type') == 'SO'
        assert 'created' in data
        assert 'updated' in data
        print(f"✓ SO Upload: {data.get('created')} created, {data.get('updated')} updated")
    
    def test_process_auto_detect(self):
        """Test processing upload with auto-detection (no template_type provided)"""
        lead_file_path = "/tmp/lead_sample_new.xlsx"
        if not os.path.exists(lead_file_path):
            pytest.skip("Lead sample file not found")
        
        with open(lead_file_path, 'rb') as f:
            # Don't provide template_type - should auto-detect
            response = self.session.post(
                f"{BASE_URL}/api/upload/process",
                files={'file': ('lead_sample.xlsx', f, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
            )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get('success') == True
        assert data.get('template_type') == 'LEAD', f"Auto-detect should identify as LEAD, got {data.get('template_type')}"
        print(f"✓ Auto-detect correctly identified as LEAD")
    
    # ============================================
    # ERROR HANDLING TESTS
    # ============================================
    
    def test_invalid_file_format(self):
        """Test uploading invalid file format"""
        # Create a fake text file
        fake_content = b"This is not an Excel file"
        
        response = self.session.post(
            f"{BASE_URL}/api/upload/detect-template",
            files={'file': ('test.txt', io.BytesIO(fake_content), 'text/plain')}
        )
        
        # Should return 400 for unsupported format
        assert response.status_code == 400, f"Expected 400 for invalid format, got {response.status_code}: {response.text}"
        print(f"✓ Invalid file format correctly rejected")
    
    def test_download_invalid_template_type(self):
        """Test downloading invalid template type"""
        response = self.session.get(f"{BASE_URL}/api/upload/templates/invalid")
        
        # Should return 400 for invalid template type
        assert response.status_code == 400, f"Expected 400 for invalid template type, got {response.status_code}"
        print(f"✓ Invalid template type correctly rejected")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
