import React, { useState, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Upload, FileSpreadsheet, Check, X, Download, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * Unified File Upload Component
 * - Single upload button that auto-detects template type
 * - Shows confirmation modal before processing
 * - Handles LEAD, LOST, SO, and REMARK uploads
 */
const FileUpload = ({ onUploadComplete, className = '' }) => {
  const fileInputRef = useRef(null);
  
  // State
  const [isDetecting, setIsDetecting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [detectedTemplate, setDetectedTemplate] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Template type labels and colors
  const templateConfig = {
    LEAD: { label: 'Lead Upload', color: 'bg-blue-100 text-blue-800', description: 'New enquiries and leads' },
    LOST: { label: 'Lost Leads Upload', color: 'bg-red-100 text-red-800', description: 'Mark leads as lost with competitor info' },
    SO: { label: 'Sales Order Upload', color: 'bg-green-100 text-green-800', description: 'Sales orders - mark leads as won' },
    REMARK: { label: 'Remark Upload', color: 'bg-purple-100 text-purple-800', description: 'Update follow-up info' }
  };

  // Handle file selection
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error('Please upload an Excel file (.xlsx, .xls) or CSV file');
      return;
    }

    setSelectedFile(file);
    setIsDetecting(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(`${API}/upload/detect-template`, formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        setDetectedTemplate(response.data);
        setShowConfirmModal(true);
      } else {
        toast.error('Failed to detect template type');
      }
    } catch (error) {
      console.error('Template detection error:', error);
      toast.error(error.response?.data?.detail || 'Failed to detect template type');
    } finally {
      setIsDetecting(false);
    }
  };

  // Handle upload confirmation
  const handleConfirmUpload = async () => {
    if (!selectedFile || !detectedTemplate) return;

    setShowConfirmModal(false);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('template_type', detectedTemplate.template_type);

      const response = await axios.post(`${API}/upload/process`, formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(Math.min(percentCompleted, 50)); // Upload is 0-50%
        }
      });

      setUploadProgress(100);
      setUploadResult(response.data);
      setShowResultModal(true);

      // Notify parent component
      if (onUploadComplete) {
        onUploadComplete(response.data);
      }

      toast.success(response.data.message || 'Upload completed successfully');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.response?.data?.detail || 'Failed to process upload');
    } finally {
      setIsUploading(false);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setShowConfirmModal(false);
    setSelectedFile(null);
    setDetectedTemplate(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handle template download
  const handleDownloadTemplate = async (templateType) => {
    try {
      const response = await axios.get(`${API}/upload/templates/${templateType}`, {
        withCredentials: true,
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${templateType}_Upload_Template.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
      
      toast.success('Template downloaded');
      setShowTemplateModal(false);
    } catch (error) {
      console.error('Template download error:', error);
      toast.error('Failed to download template');
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Upload Button */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleFileSelect}
        disabled={isDetecting || isUploading}
      />
      
      <Button
        variant="default"
        onClick={() => fileInputRef.current?.click()}
        disabled={isDetecting || isUploading}
        data-testid="upload-file-btn"
      >
        {isDetecting ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Detecting...</>
        ) : isUploading ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading...</>
        ) : (
          <><Upload className="h-4 w-4 mr-2" /> Upload File</>
        )}
      </Button>

      {/* Download Template Button */}
      <Button
        variant="outline"
        onClick={() => setShowTemplateModal(true)}
        data-testid="download-template-btn"
      >
        <Download className="h-4 w-4 mr-2" /> Download Template
      </Button>

      {/* Confirmation Modal */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Confirm Upload
            </DialogTitle>
            <DialogDescription>
              We detected the template type from your file
            </DialogDescription>
          </DialogHeader>

          {detectedTemplate && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Detected Template</p>
                  <p className="text-lg font-semibold">{detectedTemplate.template_name}</p>
                </div>
                <Badge className={templateConfig[detectedTemplate.template_type]?.color || 'bg-gray-100'}>
                  {detectedTemplate.template_type}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">File</p>
                  <p className="font-medium truncate">{selectedFile?.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Rows to Process</p>
                  <p className="font-medium">{detectedTemplate.row_count?.toLocaleString()}</p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                {templateConfig[detectedTemplate.template_type]?.description}
              </p>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleConfirmUpload} data-testid="confirm-upload-btn">
              <Check className="h-4 w-4 mr-2" /> Proceed with Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Progress Modal */}
      <Dialog open={isUploading} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" hideCloseButton>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Processing Upload
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <Progress value={uploadProgress} className="h-3" />
            <p className="text-sm text-center text-muted-foreground">
              {uploadProgress < 50 ? 'Uploading file...' : 'Processing records...'}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Result Modal */}
      <Dialog open={showResultModal} onOpenChange={setShowResultModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {uploadResult?.success ? (
                <Check className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              Upload {uploadResult?.success ? 'Complete' : 'Failed'}
            </DialogTitle>
          </DialogHeader>

          {uploadResult && (
            <div className="py-4 space-y-4">
              <Badge className={templateConfig[uploadResult.template_type]?.color || 'bg-gray-100'}>
                {uploadResult.template_type} Upload
              </Badge>

              {uploadResult.success && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {uploadResult.created !== undefined && (
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-2xl font-bold text-green-600">{uploadResult.created}</p>
                        <p className="text-sm text-muted-foreground">Created</p>
                      </CardContent>
                    </Card>
                  )}
                  {uploadResult.updated !== undefined && (
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-2xl font-bold text-blue-600">{uploadResult.updated}</p>
                        <p className="text-sm text-muted-foreground">Updated</p>
                      </CardContent>
                    </Card>
                  )}
                  {uploadResult.duplicates_merged !== undefined && (
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-2xl font-bold text-purple-600">{uploadResult.duplicates_merged}</p>
                        <p className="text-sm text-muted-foreground">Merged</p>
                      </CardContent>
                    </Card>
                  )}
                  {uploadResult.skipped !== undefined && uploadResult.skipped > 0 && (
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-2xl font-bold text-gray-600">{uploadResult.skipped}</p>
                        <p className="text-sm text-muted-foreground">Skipped</p>
                      </CardContent>
                    </Card>
                  )}
                  {uploadResult.skipped_won !== undefined && uploadResult.skipped_won > 0 && (
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-2xl font-bold text-amber-600">{uploadResult.skipped_won}</p>
                        <p className="text-sm text-muted-foreground">Won (Skipped)</p>
                      </CardContent>
                    </Card>
                  )}
                  {uploadResult.skipped_no_match !== undefined && uploadResult.skipped_no_match > 0 && (
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-2xl font-bold text-orange-600">{uploadResult.skipped_no_match}</p>
                        <p className="text-sm text-muted-foreground">No Match</p>
                      </CardContent>
                    </Card>
                  )}
                  {uploadResult.so_info_added !== undefined && uploadResult.so_info_added > 0 && (
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-2xl font-bold text-green-600">{uploadResult.so_info_added}</p>
                        <p className="text-sm text-muted-foreground">SO Info Added</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {uploadResult.total_errors > 0 && (
                <div className="p-3 bg-red-50 rounded-lg">
                  <p className="text-sm font-medium text-red-800">
                    {uploadResult.total_errors} rows had errors
                  </p>
                  {uploadResult.errors?.slice(0, 3).map((err, idx) => (
                    <p key={idx} className="text-xs text-red-600 mt-1">
                      Row {err.row}: {err.error}
                    </p>
                  ))}
                </div>
              )}

              <p className="text-sm text-muted-foreground text-center">
                {uploadResult.message}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setShowResultModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Download Modal */}
      <Dialog open={showTemplateModal} onOpenChange={setShowTemplateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Download Template
            </DialogTitle>
            <DialogDescription>
              Select a template to download with sample data
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 py-4">
            {Object.entries(templateConfig).map(([type, config]) => (
              <Button
                key={type}
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={() => handleDownloadTemplate(type)}
                data-testid={`download-${type.toLowerCase()}-template-btn`}
              >
                <div className="flex items-center gap-3 w-full">
                  <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                  <div className="text-left">
                    <p className="font-medium">{config.label}</p>
                    <p className="text-xs text-muted-foreground">{config.description}</p>
                  </div>
                  <Badge className={`ml-auto ${config.color}`}>{type}</Badge>
                </div>
              </Button>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateModal(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FileUpload;
