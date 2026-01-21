import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { Users, Activity, Settings, Shield, UserX, UserCheck, ChevronLeft, ChevronRight, Plus, Trash2, ShieldCheck, Save, Upload, Database, Calendar, FileSpreadsheet, AlertTriangle, BarChart3, RefreshCw, Check, X, Calculator, Clock, Key } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';

// Import refactored components
import { UserManagement, ActivityLogs } from '@/components/admin';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Admin = () => {
  const [stats, setStats] = useState(null);
  // Users and logs state now managed by components
  const [closureQuestions, setClosureQuestions] = useState([]);
  const [closureQuestions, setClosureQuestions] = useState([]);
  const [qualificationQuestions, setQualificationQuestions] = useState([]);
  const [qualificationSettings, setQualificationSettings] = useState({ threshold_score: 0 });
  const [loading, setLoading] = useState(true);
  
  // Closure question dialog
  const [isClosureDialogOpen, setIsClosureDialogOpen] = useState(false);
  const [newClosureQuestion, setNewClosureQuestion] = useState({ question: '', type: 'text', applies_to: 'all' });
  
  // Qualification question dialog
  const [isQualDialogOpen, setIsQualDialogOpen] = useState(false);
  const [newQualQuestion, setNewQualQuestion] = useState({
    question: '',
    description: '',
    options: [{ text: '', score: 0 }],
    is_required: true
  });
  
  // Password change dialog
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [passwordChangeUser, setPasswordChangeUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  
  // Data Management state
  const [dataStats, setDataStats] = useState(null);
  const [uploadingHistorical, setUploadingHistorical] = useState(false);
  const [historicalUploadResult, setHistoricalUploadResult] = useState(null);
  const [uploadProgress, setUploadProgress] = useState({ progress: 0, message: '', status: '' });
  
  // Recent Uploads state
  const [recentUploads, setRecentUploads] = useState([]);
  const [loadingUploads, setLoadingUploads] = useState(false);
  const [deletingBatch, setDeletingBatch] = useState(null);
  
  // Delete Leads state
  const [deleteFilters, setDeleteFilters] = useState({
    deleteAll: false,
    startDate: '',
    endDate: '',
    state: '',
    dealer: '',
    employee: '',
    stage: '',
    segment: '',
    source: ''
  });
  const [deleteFilterOptions, setDeleteFilterOptions] = useState({
    states: [], dealers: [], employees: [], stages: [], segments: [], sources: []
  });
  const [deletePreview, setDeletePreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  
  // Trash state
  const [trashStats, setTrashStats] = useState(null);
  const [trashLeads, setTrashLeads] = useState([]);
  const [trashPage, setTrashPage] = useState(1);
  const [trashTotalPages, setTrashTotalPages] = useState(1);
  const [trashTotal, setTrashTotal] = useState(0);
  const [selectedTrashLeads, setSelectedTrashLeads] = useState([]);
  const [recoveringLeads, setRecoveringLeads] = useState(false);
  
  // Data Migration state
  const [migrationStatus, setMigrationStatus] = useState(null);
  const [loadingMigration, setLoadingMigration] = useState(false);
  const [importing, setImporting] = useState(false);
  const [runningCleanup, setRunningCleanup] = useState(false);
  const [cleanupResult, setCleanupResult] = useState(null);
  
  // Entity Profile Config state
  const [entityProfileConfig, setEntityProfileConfig] = useState(null);
  const [availableKpis, setAvailableKpis] = useState({ built_in_metrics: [], configurable_metrics: [] });
  const [savingEntityConfig, setSavingEntityConfig] = useState(false);
  const [permanentDeleting, setPermanentDeleting] = useState(false);
  
  // Metric Settings state
  const [metricSettings, setMetricSettings] = useState(null);
  const [availableFields, setAvailableFields] = useState({});
  const [fieldCounts, setFieldCounts] = useState({});
  const [savingMetric, setSavingMetric] = useState(null);
  const [showCreateMetric, setShowCreateMetric] = useState(false);
  const [newMetric, setNewMetric] = useState({
    metric_id: '',
    metric_name: '',
    description: '',
    field_name: 'segment',
    field_values: [],
    color: 'primary',
    show_on_dashboard: true
  });
  
  // Custom Formula Metric state
  const [showCreateFormula, setShowCreateFormula] = useState(false);
  const [newFormulaMetric, setNewFormulaMetric] = useState({
    metric_id: '',
    metric_name: '',
    description: '',
    metric_type: 'formula',
    numerator_metric: 'won_leads',
    denominator_metric: 'total_leads',
    start_date_field: 'enquiry_date',
    end_date_field: 'today',
    filter_stages: [],
    unit: '%',
    color: 'primary',
    icon: 'Calculator'
  });

  useEffect(() => {
    loadData();
    loadDataStats();
    loadMetricSettings();
    loadDeleteFilterOptions();
    loadTrashStats();
    loadEntityProfileConfig();
    loadRecentUploads();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [logsPage]);

  useEffect(() => {
    loadTrashLeads();
  }, [trashPage]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes, closureRes, qualRes, settingsRes] = await Promise.all([
        axios.get(`${API}/admin/stats`, { withCredentials: true }),
        axios.get(`${API}/admin/users`, { withCredentials: true }),
        axios.get(`${API}/admin/closure-questions`, { withCredentials: true }),
        axios.get(`${API}/qualification/questions`, { withCredentials: true }),
        axios.get(`${API}/qualification/settings`, { withCredentials: true })
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data);
      setClosureQuestions(closureRes.data.questions || []);
      setQualificationQuestions(qualRes.data.questions || []);
      setQualificationSettings(settingsRes.data);
    } catch (error) {
      console.error('Error loading admin data:', error);
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    try {
      const res = await axios.get(`${API}/admin/activity-logs?page=${logsPage}&limit=20`, {
        withCredentials: true
      });
      setLogs(res.data.logs || []);
      setLogsTotalPages(res.data.pages || 1);
    } catch (error) {
      console.error('Error loading logs:', error);
    }
  };

  // Data Migration functions
  const loadMigrationStatus = async () => {
    setLoadingMigration(true);
    try {
      const res = await axios.get(`${API}/data-migration/status`, { withCredentials: true });
      setMigrationStatus(res.data);
    } catch (error) {
      console.error('Error loading migration status:', error);
      toast.error('Failed to load migration status');
    } finally {
      setLoadingMigration(false);
    }
  };

  const runDataImport = async (leadsOnly = false, fullReset = false) => {
    const message = fullReset 
      ? 'This will DELETE ALL data and import fresh data from export. This is a COMPLETE RESET. Are you absolutely sure?'
      : leadsOnly 
        ? 'This will replace ALL leads in the database with the exported data. Are you sure?'
        : 'This will replace ALL data in the database with the exported data. Are you sure?';
    
    if (!window.confirm(message)) {
      return;
    }
    
    // Double confirm for full reset
    if (fullReset && !window.confirm('FINAL WARNING: This will delete everything. Type "RESET" in the next prompt to confirm.')) {
      return;
    }
    
    setImporting(true);
    try {
      const endpoint = fullReset 
        ? '/data-migration/reset-and-import' 
        : leadsOnly 
          ? '/data-migration/import-leads-only' 
          : '/data-migration/import';
      const res = await axios.post(`${API}${endpoint}?clear_existing=true`, {}, { withCredentials: true });
      toast.success(`Import complete! ${res.data.leads_imported || res.data.results?.imported_leads || res.data.total_imported} records imported.`);
      loadMigrationStatus();
      loadDataStats();
    } catch (error) {
      console.error('Error importing data:', error);
      toast.error('Failed to import data: ' + (error.response?.data?.detail || error.message));
    } finally {
      setImporting(false);
    }
  };

  const syncFromPreview = async () => {
    if (!window.confirm('This will DELETE all data and sync from preview environment. Continue?')) {
      return;
    }
    
    setImporting(true);
    try {
      const res = await axios.post(`${API}/data-migration/reset-from-preview`, {}, { 
        withCredentials: true,
        timeout: 120000 // 2 minute timeout for large data
      });
      toast.success(`Sync complete! Imported ${res.data.imported} leads from preview.`);
      loadMigrationStatus();
      loadDataStats();
    } catch (error) {
      console.error('Error syncing from preview:', error);
      toast.error('Failed to sync: ' + (error.response?.data?.detail || error.message));
    } finally {
      setImporting(false);
    }
  };

  const runDataCleanup = async () => {
    if (!window.confirm('This will run the comprehensive data cleanup and merge logic on the current database. This will:\n\n1. Clean concatenated/messy data in all fields\n2. De-duplicate remarks and other text fields\n3. Re-run intelligent merge logic on leads with same phone numbers\n\nAre you sure you want to proceed?')) {
      return;
    }
    
    setRunningCleanup(true);
    setCleanupResult(null);
    try {
      const res = await axios.post(`${API}/data-migration/run-cleanup`, {}, { 
        withCredentials: true,
        timeout: 300000 // 5 minute timeout for large datasets
      });
      toast.success(res.data.message || 'Data cleanup completed successfully');
      setCleanupResult(res.data.results);
      loadDataStats();
      loadMigrationStatus();
    } catch (error) {
      console.error('Error running data cleanup:', error);
      toast.error('Failed to run cleanup: ' + (error.response?.data?.detail || error.message));
    } finally {
      setRunningCleanup(false);
    }
  };

  const loadDataStats = async () => {
    try {
      const res = await axios.get(`${API}/admin/data-stats`, { withCredentials: true });
      setDataStats(res.data);
    } catch (error) {
      console.error('Error loading data stats:', error);
    }
  };

  const loadDeleteFilterOptions = async () => {
    try {
      const res = await axios.get(`${API}/admin/trash/filter-options`, { withCredentials: true });
      setDeleteFilterOptions(res.data);
    } catch (error) {
      console.error('Error loading filter options:', error);
    }
  };

  const loadTrashStats = async () => {
    try {
      const res = await axios.get(`${API}/admin/trash/trash-stats`, { withCredentials: true });
      setTrashStats(res.data);
    } catch (error) {
      console.error('Error loading trash stats:', error);
    }
  };

  const loadRecentUploads = async () => {
    setLoadingUploads(true);
    try {
      const res = await axios.get(`${API}/admin/recent-uploads?days=7`, { withCredentials: true });
      setRecentUploads(res.data.uploads || []);
    } catch (error) {
      console.error('Error loading recent uploads:', error);
    } finally {
      setLoadingUploads(false);
    }
  };

  const handleDeleteUploadBatch = async (batchId) => {
    if (!window.confirm('Are you sure you want to delete all leads from this upload? This action can be undone by restoring from trash.')) {
      return;
    }
    
    setDeletingBatch(batchId);
    try {
      const res = await axios.delete(`${API}/admin/upload-batch/${batchId}`, { withCredentials: true });
      toast.success(res.data.message || 'Upload batch deleted successfully');
      loadRecentUploads();
      loadDataStats();
      loadTrashStats();
    } catch (error) {
      console.error('Error deleting upload batch:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete upload batch');
    } finally {
      setDeletingBatch(null);
    }
  };

  const handleRestoreUploadBatch = async (batchId) => {
    setDeletingBatch(batchId);
    try {
      const res = await axios.post(`${API}/admin/upload-batch/${batchId}/restore`, {}, { withCredentials: true });
      toast.success(res.data.message || 'Upload batch restored successfully');
      loadRecentUploads();
      loadDataStats();
      loadTrashStats();
    } catch (error) {
      console.error('Error restoring upload batch:', error);
      toast.error(error.response?.data?.detail || 'Failed to restore upload batch');
    } finally {
      setDeletingBatch(null);
    }
  };

  const loadEntityProfileConfig = async () => {
    try {
      const [configRes, kpisRes] = await Promise.all([
        axios.get(`${API}/entity/config`, { withCredentials: true }),
        axios.get(`${API}/entity/available-kpis`, { withCredentials: true })
      ]);
      setEntityProfileConfig(configRes.data);
      setAvailableKpis(kpisRes.data);
    } catch (error) {
      console.error('Error loading entity profile config:', error);
    }
  };

  const saveEntityProfileConfig = async () => {
    setSavingEntityConfig(true);
    try {
      await axios.put(`${API}/entity/config`, entityProfileConfig, { withCredentials: true });
      toast.success('Entity profile configuration saved');
    } catch (error) {
      toast.error('Failed to save configuration');
    } finally {
      setSavingEntityConfig(false);
    }
  };

  const toggleKpiEnabled = (metricId) => {
    setEntityProfileConfig(prev => {
      const enabledKpis = prev?.kpis?.enabled_kpis || [];
      const newEnabled = enabledKpis.includes(metricId)
        ? enabledKpis.filter(id => id !== metricId)
        : [...enabledKpis, metricId];
      return {
        ...prev,
        kpis: { ...prev.kpis, enabled_kpis: newEnabled }
      };
    });
  };

  const toggleChartEnabled = (chartKey) => {
    setEntityProfileConfig(prev => ({
      ...prev,
      charts: {
        ...prev.charts,
        [chartKey]: {
          ...prev.charts[chartKey],
          enabled: !prev.charts?.[chartKey]?.enabled
        }
      }
    }));
  };

  const loadTrashLeads = async () => {
    try {
      const res = await axios.get(`${API}/admin/trash/deleted-leads?page=${trashPage}&limit=20`, { withCredentials: true });
      setTrashLeads(res.data.leads || []);
      setTrashTotalPages(res.data.pages || 1);
      setTrashTotal(res.data.total || 0);
    } catch (error) {
      console.error('Error loading trash leads:', error);
    }
  };

  const previewDelete = async () => {
    setLoadingPreview(true);
    setDeletePreview(null);
    try {
      const params = new URLSearchParams();
      if (deleteFilters.deleteAll) params.append('delete_all', 'true');
      if (deleteFilters.startDate) params.append('start_date', deleteFilters.startDate);
      if (deleteFilters.endDate) params.append('end_date', deleteFilters.endDate);
      if (deleteFilters.state) params.append('state', deleteFilters.state);
      if (deleteFilters.dealer) params.append('dealer', deleteFilters.dealer);
      if (deleteFilters.employee) params.append('employee', deleteFilters.employee);
      if (deleteFilters.stage) params.append('stage', deleteFilters.stage);
      if (deleteFilters.segment) params.append('segment', deleteFilters.segment);
      if (deleteFilters.source) params.append('source', deleteFilters.source);
      
      const res = await axios.get(`${API}/admin/trash/preview-delete?${params}`, { withCredentials: true });
      setDeletePreview(res.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to preview deletion');
    } finally {
      setLoadingPreview(false);
    }
  };

  const executeDelete = async () => {
    if (deleteConfirmText !== 'DELETE') {
      toast.error('Please type DELETE to confirm');
      return;
    }
    
    setDeleting(true);
    try {
      const params = new URLSearchParams();
      if (deleteFilters.deleteAll) params.append('delete_all', 'true');
      if (deleteFilters.startDate) params.append('start_date', deleteFilters.startDate);
      if (deleteFilters.endDate) params.append('end_date', deleteFilters.endDate);
      if (deleteFilters.state) params.append('state', deleteFilters.state);
      if (deleteFilters.dealer) params.append('dealer', deleteFilters.dealer);
      if (deleteFilters.employee) params.append('employee', deleteFilters.employee);
      if (deleteFilters.stage) params.append('stage', deleteFilters.stage);
      if (deleteFilters.segment) params.append('segment', deleteFilters.segment);
      if (deleteFilters.source) params.append('source', deleteFilters.source);
      
      const res = await axios.post(`${API}/admin/trash/delete-leads?${params}`, {}, { withCredentials: true });
      toast.success(res.data.message);
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
      setDeletePreview(null);
      setDeleteFilters({
        deleteAll: false, startDate: '', endDate: '', state: '', dealer: '',
        employee: '', stage: '', segment: '', source: ''
      });
      loadDataStats();
      loadTrashStats();
      loadTrashLeads();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete leads');
    } finally {
      setDeleting(false);
    }
  };

  const recoverLeads = async (leadIds = null, recoverAll = false) => {
    setRecoveringLeads(true);
    try {
      const params = new URLSearchParams();
      if (recoverAll) params.append('recover_all', 'true');
      if (leadIds && leadIds.length > 0) {
        leadIds.forEach(id => params.append('lead_ids', id));
      }
      const res = await axios.post(`${API}/admin/trash/recover-leads?${params}`, {}, { withCredentials: true });
      toast.success(res.data.message);
      setSelectedTrashLeads([]);
      loadTrashStats();
      loadTrashLeads();
      loadDataStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to recover leads');
    } finally {
      setRecoveringLeads(false);
    }
  };

  const permanentDeleteLeads = async (leadIds = null, deleteAllTrash = false) => {
    setPermanentDeleting(true);
    try {
      const params = new URLSearchParams();
      if (deleteAllTrash) params.append('delete_all_trash', 'true');
      if (leadIds && leadIds.length > 0) {
        leadIds.forEach(id => params.append('lead_ids', id));
      }
      const res = await axios.post(`${API}/admin/trash/permanent-delete?${params}`, {}, { withCredentials: true });
      toast.success(res.data.message);
      setSelectedTrashLeads([]);
      loadTrashStats();
      loadTrashLeads();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to permanently delete leads');
    } finally {
      setPermanentDeleting(false);
    }
  };

  const loadMetricSettings = async () => {
    try {
      const res = await axios.get(`${API}/metric-settings`, { withCredentials: true });
      setMetricSettings(res.data.metrics || []);
      setAvailableFields(res.data.available_fields || {});
      setFieldCounts(res.data.field_counts || {});
    } catch (error) {
      console.error('Error loading metric settings:', error);
    }
  };

  const updateMetricValues = async (metricId, newValues) => {
    setSavingMetric(metricId);
    try {
      await axios.put(`${API}/metric-settings/${metricId}`, 
        { field_values: newValues },
        { withCredentials: true }
      );
      toast.success('Metric updated successfully');
      loadMetricSettings();
    } catch (error) {
      toast.error('Failed to update metric');
    } finally {
      setSavingMetric(null);
    }
  };

  const toggleMetricValue = (metric, value) => {
    const currentValues = metric.field_values || [];
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];
    updateMetricValues(metric.metric_id, newValues);
  };

  const resetMetricSettings = async () => {
    if (!window.confirm('Reset all metrics to default settings?')) return;
    try {
      await axios.post(`${API}/metric-settings/reset`, {}, { withCredentials: true });
      toast.success('Metrics reset to defaults');
      loadMetricSettings();
    } catch (error) {
      toast.error('Failed to reset metrics');
    }
  };

  const createCustomMetric = async () => {
    if (!newMetric.metric_id || !newMetric.metric_name) {
      toast.error('Please fill in metric ID and name');
      return;
    }
    if (newMetric.field_values.length === 0) {
      toast.error('Please select at least one value');
      return;
    }
    try {
      await axios.post(`${API}/metric-settings/create`, newMetric, { withCredentials: true });
      toast.success('Custom metric created');
      setShowCreateMetric(false);
      setNewMetric({
        metric_id: '',
        metric_name: '',
        description: '',
        field_name: 'segment',
        field_values: [],
        color: 'primary',
        show_on_dashboard: true
      });
      loadMetricSettings();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create metric');
    }
  };

  const deleteCustomMetric = async (metricId) => {
    if (!window.confirm('Delete this custom metric?')) return;
    try {
      await axios.delete(`${API}/metric-settings/${metricId}`, { withCredentials: true });
      toast.success('Metric deleted');
      loadMetricSettings();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete metric');
    }
  };

  // User management functions
  const createUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      toast.error('Please fill in all required fields');
      return;
    }
    setCreatingUser(true);
    try {
      await axios.post(`${API}/admin/users`, newUser, { withCredentials: true });
      toast.success('User created successfully');
      setShowAddUser(false);
      setNewUser({ name: '', email: '', username: '', password: '', role: 'Employee' });
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create user');
    } finally {
      setCreatingUser(false);
    }
  };

  const deleteUser = async (userId, userName) => {
    if (!window.confirm(`Delete user "${userName}"? This action cannot be undone.`)) return;
    try {
      await axios.delete(`${API}/admin/users/${userId}`, { withCredentials: true });
      toast.success('User deleted successfully');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete user');
    }
  };

  const toggleMetricDashboard = async (metric) => {
    try {
      await axios.put(`${API}/metric-settings/${metric.metric_id}`, 
        { show_on_dashboard: !metric.show_on_dashboard },
        { withCredentials: true }
      );
      loadMetricSettings();
    } catch (error) {
      toast.error('Failed to update metric');
    }
  };

  // Update formula metric (numerator/denominator)
  const updateFormulaMetric = async (metricId, field, value) => {
    try {
      await axios.put(`${API}/metric-settings/${metricId}`, 
        { [field]: value },
        { withCredentials: true }
      );
      loadMetricSettings();
      toast.success('Formula updated');
    } catch (error) {
      toast.error('Failed to update formula');
    }
  };

  // Update calculated metric (start_date_field, end_date_field, filter_stages)
  const updateCalculatedMetric = async (metricId, updates) => {
    try {
      await axios.put(`${API}/metric-settings/${metricId}`, 
        updates,
        { withCredentials: true }
      );
      loadMetricSettings();
      toast.success('Metric formula updated');
    } catch (error) {
      toast.error('Failed to update metric');
    }
  };

  // Create custom formula metric
  const createCustomFormulaMetric = async () => {
    if (!newFormulaMetric.metric_id || !newFormulaMetric.metric_name) {
      toast.error('Please fill in metric ID and name');
      return;
    }
    
    try {
      await axios.post(`${API}/metric-settings/custom`, newFormulaMetric, { withCredentials: true });
      toast.success('Custom metric created');
      setShowCreateFormula(false);
      setNewFormulaMetric({
        metric_id: '',
        metric_name: '',
        description: '',
        metric_type: 'formula',
        numerator_metric: 'won_leads',
        denominator_metric: 'total_leads',
        start_date_field: 'enquiry_date',
        end_date_field: 'today',
        filter_stages: [],
        unit: '%',
        color: 'primary',
        icon: 'Calculator'
      });
      loadMetricSettings();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create metric');
    }
  };

  // Delete custom metric
  const deleteCustomFormulaMetric = async (metricId) => {
    if (!window.confirm('Are you sure you want to delete this custom metric?')) return;
    
    try {
      await axios.delete(`${API}/metric-settings/custom/${metricId}`, { withCredentials: true });
      toast.success('Custom metric deleted');
      loadMetricSettings();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete metric');
    }
  };

  const handleHistoricalUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('Please upload an Excel file (.xlsx or .xls)');
      return;
    }
    
    const confirmed = window.confirm(
      'Warning: This will REPLACE all leads with dates up to the maximum date in your file. ' +
      'This action cannot be undone. Are you sure you want to continue?'
    );
    
    if (!confirmed) {
      event.target.value = '';
      return;
    }
    
    setUploadingHistorical(true);
    setHistoricalUploadResult(null);
    setUploadProgress({ progress: 0, message: 'Uploading file...', status: 'uploading' });
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      // Start upload with progress tracking
      const res = await axios.post(`${API}/admin/upload-historical-data`, formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 600000, // 10 minute timeout for large files
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress({ 
            progress: Math.min(percentCompleted, 30), // Upload is 0-30%
            message: `Uploading file... ${percentCompleted}%`, 
            status: 'uploading' 
          });
        }
      });
      
      // If we have an upload_id, poll for processing progress
      if (res.data.upload_id) {
        const uploadId = res.data.upload_id;
        let polling = true;
        
        while (polling) {
          try {
            const progressRes = await axios.get(`${API}/admin/upload-progress/${uploadId}`, { withCredentials: true });
            const progressData = progressRes.data;
            
            if (progressData.status === 'complete' || progressData.status === 'not_found') {
              polling = false;
            } else {
              // Processing progress is 30-100%
              const adjustedProgress = 30 + (progressData.progress * 0.7);
              setUploadProgress({
                progress: Math.min(adjustedProgress, 99),
                message: progressData.message || 'Processing...',
                status: progressData.status
              });
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } catch (e) {
            polling = false;
          }
        }
      }
      
      setUploadProgress({ progress: 100, message: 'Complete!', status: 'complete' });
      setHistoricalUploadResult(res.data);
      toast.success(res.data.message || 'Historical data uploaded successfully');
      loadDataStats();
      loadData();
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to upload historical data';
      toast.error(errorMsg);
      setHistoricalUploadResult({ success: false, error: errorMsg });
      setUploadProgress({ progress: 0, message: errorMsg, status: 'error' });
    } finally {
      setUploadingHistorical(false);
      event.target.value = '';
    }
  };

  const updateUserRole = async (userId, newRole) => {
    try {
      await axios.put(`${API}/admin/users/${userId}/role`, 
        { role: newRole },
        { withCredentials: true }
      );
      toast.success('User role updated');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update role');
    }
  };

  const toggleUserStatus = async (userId, currentStatus) => {
    try {
      await axios.put(`${API}/admin/users/${userId}/status`, 
        { is_active: !currentStatus },
        { withCredentials: true }
      );
      toast.success(`User ${currentStatus ? 'deactivated' : 'activated'}`);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update status');
    }
  };

  // Change user password (Admin only)
  const handleChangePassword = async () => {
    if (!passwordChangeUser || !newPassword) return;
    
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    
    setChangingPassword(true);
    try {
      await axios.put(`${API}/admin/users/${passwordChangeUser.user_id}/password`, 
        { password: newPassword },
        { withCredentials: true }
      );
      toast.success(`Password changed for ${passwordChangeUser.name || passwordChangeUser.email}`);
      setIsPasswordDialogOpen(false);
      setPasswordChangeUser(null);
      setNewPassword('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  // Closure Questions
  const createClosureQuestion = async () => {
    try {
      await axios.post(`${API}/admin/closure-questions`, newClosureQuestion, {
        withCredentials: true
      });
      toast.success('Closure question created');
      setIsClosureDialogOpen(false);
      setNewClosureQuestion({ question: '', type: 'text', applies_to: 'all' });
      loadData();
    } catch (error) {
      toast.error('Failed to create question');
    }
  };

  const deleteClosureQuestion = async (questionId) => {
    if (!window.confirm('Delete this question?')) return;
    try {
      await axios.delete(`${API}/admin/closure-questions/${questionId}`, {
        withCredentials: true
      });
      toast.success('Question deleted');
      loadData();
    } catch (error) {
      toast.error('Failed to delete question');
    }
  };

  // Qualification Questions
  const addQualOption = () => {
    setNewQualQuestion(prev => ({
      ...prev,
      options: [...prev.options, { text: '', score: 0 }]
    }));
  };

  const updateQualOption = (index, field, value) => {
    setNewQualQuestion(prev => ({
      ...prev,
      options: prev.options.map((opt, i) => 
        i === index ? { ...opt, [field]: field === 'score' ? parseInt(value) || 0 : value } : opt
      )
    }));
  };

  const removeQualOption = (index) => {
    setNewQualQuestion(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }));
  };

  const createQualificationQuestion = async () => {
    if (!newQualQuestion.question.trim()) {
      toast.error('Question text is required');
      return;
    }
    if (newQualQuestion.options.length < 2) {
      toast.error('At least 2 answer options are required');
      return;
    }
    
    try {
      await axios.post(`${API}/qualification/questions`, newQualQuestion, {
        withCredentials: true
      });
      toast.success('Qualification question created');
      setIsQualDialogOpen(false);
      setNewQualQuestion({
        question: '',
        description: '',
        options: [{ text: '', score: 0 }],
        is_required: true
      });
      loadData();
    } catch (error) {
      toast.error('Failed to create question');
    }
  };

  const deleteQualificationQuestion = async (questionId) => {
    if (!window.confirm('Delete this qualification question?')) return;
    try {
      await axios.delete(`${API}/qualification/questions/${questionId}`, {
        withCredentials: true
      });
      toast.success('Question deleted');
      loadData();
    } catch (error) {
      toast.error('Failed to delete question');
    }
  };

  const updateThreshold = async () => {
    try {
      await axios.put(`${API}/qualification/settings`, 
        { threshold_score: qualificationSettings.threshold_score },
        { withCredentials: true }
      );
      toast.success('Threshold updated');
    } catch (error) {
      toast.error('Failed to update threshold');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  };

  // Calculate max possible score
  const maxPossibleScore = qualificationQuestions.reduce((sum, q) => {
    const maxOptionScore = Math.max(...(q.options?.map(o => o.score) || [0]));
    return sum + maxOptionScore;
  }, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-8 w-8" />
          Admin Panel
        </h1>
        <p className="text-muted-foreground mt-1">Manage users, questions, and settings</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_users || 0}</div>
            <p className="text-xs text-muted-foreground">{stats?.active_users || 0} active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Leads</CardTitle>
            <Activity className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_leads?.toLocaleString() || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Activity Logs</CardTitle>
            <Activity className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_activities?.toLocaleString() || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Qualification Threshold</CardTitle>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{qualificationSettings.threshold_score} pts</div>
            <p className="text-xs text-muted-foreground">Max possible: {maxPossibleScore}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="metrics">Metric Settings</TabsTrigger>
          <TabsTrigger value="entity-profile">Entity Profiles</TabsTrigger>
          <TabsTrigger value="qualification">Qualification Questions</TabsTrigger>
          <TabsTrigger value="closure">Closure Questions</TabsTrigger>
          <TabsTrigger value="data">Data Management</TabsTrigger>
          <TabsTrigger value="trash" className="flex items-center gap-1">
            Trash
            {trashStats?.total_in_trash > 0 && (
              <Badge variant="destructive" className="ml-1 text-xs">{trashStats.total_in_trash}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="logs">Activity Logs</TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users">
          <UserManagement />
        </TabsContent>

        {/* Metric Settings Tab */}
        <TabsContent value="metrics" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">Configure KPI Metrics</h3>
              <p className="text-sm text-muted-foreground">
                Define which field values should be counted for each metric on the dashboard
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowCreateMetric(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Count Metric
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowCreateFormula(true)}>
                <Calculator className="h-4 w-4 mr-2" />
                Create Formula Metric
              </Button>
              <Button variant="outline" size="sm" onClick={resetMetricSettings}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset to Defaults
              </Button>
            </div>
          </div>

          {/* Create Custom Formula Metric Dialog */}
          {showCreateFormula && (
            <Card className="border-primary">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Create Formula/Calculated Metric
                </CardTitle>
                <CardDescription>Create a metric based on formulas or date calculations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Metric ID (unique)</Label>
                    <Input
                      placeholder="e.g., win_rate"
                      value={newFormulaMetric.metric_id}
                      onChange={(e) => setNewFormulaMetric(prev => ({ ...prev, metric_id: e.target.value.toLowerCase().replace(/\s/g, '_') }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Display Name</Label>
                    <Input
                      placeholder="e.g., Win Rate"
                      value={newFormulaMetric.metric_name}
                      onChange={(e) => setNewFormulaMetric(prev => ({ ...prev, metric_name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Metric Type</Label>
                    <Select 
                      value={newFormulaMetric.metric_type} 
                      onValueChange={(v) => setNewFormulaMetric(prev => ({ ...prev, metric_type: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="formula">Formula (Ratio %)</SelectItem>
                        <SelectItem value="calculated">Calculated (Date Diff)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    placeholder="e.g., Percentage of won leads from total closed"
                    value={newFormulaMetric.description}
                    onChange={(e) => setNewFormulaMetric(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>

                {/* Formula Type Configuration */}
                {newFormulaMetric.metric_type === 'formula' && (
                  <div className="p-4 bg-muted/30 rounded-lg space-y-4">
                    <p className="text-sm font-medium">Formula: Numerator / Denominator × 100</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Numerator</Label>
                        <Select 
                          value={newFormulaMetric.numerator_metric} 
                          onValueChange={(v) => setNewFormulaMetric(prev => ({ ...prev, numerator_metric: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="won_leads">Won Leads</SelectItem>
                            <SelectItem value="lost_leads">Lost Leads</SelectItem>
                            <SelectItem value="open_leads">Open Leads</SelectItem>
                            <SelectItem value="closed_leads">Closed Leads</SelectItem>
                            <SelectItem value="hot_leads">Hot Leads</SelectItem>
                            <SelectItem value="qualified_leads">Qualified Leads</SelectItem>
                            <SelectItem value="total_leads">Total Leads</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Denominator</Label>
                        <Select 
                          value={newFormulaMetric.denominator_metric} 
                          onValueChange={(v) => setNewFormulaMetric(prev => ({ ...prev, denominator_metric: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="total_leads">Total Leads</SelectItem>
                            <SelectItem value="won_leads+lost_leads">Won + Lost</SelectItem>
                            <SelectItem value="closed_leads">Closed Leads</SelectItem>
                            <SelectItem value="open_leads">Open Leads</SelectItem>
                            <SelectItem value="hot_leads+warm_leads+cold_leads">All Typed Leads</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Preview: ({newFormulaMetric.numerator_metric} / {newFormulaMetric.denominator_metric}) × 100 = ?%
                    </p>
                  </div>
                )}

                {/* Calculated Type Configuration */}
                {newFormulaMetric.metric_type === 'calculated' && (
                  <div className="p-4 bg-muted/30 rounded-lg space-y-4">
                    <p className="text-sm font-medium">Formula: (End Date - Start Date) in days</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Start Date Field</Label>
                        <Select 
                          value={newFormulaMetric.start_date_field} 
                          onValueChange={(v) => setNewFormulaMetric(prev => ({ ...prev, start_date_field: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="enquiry_date">Enquiry Date</SelectItem>
                            <SelectItem value="planned_followup_date">Planned Follow-up Date</SelectItem>
                            <SelectItem value="last_followup_date">Last Follow-up Date</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>End Date Field</Label>
                        <Select 
                          value={newFormulaMetric.end_date_field} 
                          onValueChange={(v) => setNewFormulaMetric(prev => ({ ...prev, end_date_field: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="today">Today (Current Date)</SelectItem>
                            <SelectItem value="last_followup_date">Last Follow-up Date</SelectItem>
                            <SelectItem value="planned_followup_date">Planned Follow-up Date</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Filter by Stages</Label>
                      <div className="flex flex-wrap gap-1">
                        {['Prospecting', 'Qualified', 'Proposal', 'Negotiation', 'Closed-Won', 'Order Booked', 'Closed-Lost', 'Closed-Dropped'].map(stage => {
                          const isSelected = newFormulaMetric.filter_stages?.includes(stage);
                          return (
                            <Badge 
                              key={stage}
                              variant={isSelected ? 'default' : 'outline'}
                              className="cursor-pointer"
                              onClick={() => {
                                const newStages = isSelected 
                                  ? newFormulaMetric.filter_stages.filter(s => s !== stage)
                                  : [...(newFormulaMetric.filter_stages || []), stage];
                                setNewFormulaMetric(prev => ({ ...prev, filter_stages: newStages }));
                              }}
                            >
                              {stage}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Unit</Label>
                    <Select 
                      value={newFormulaMetric.unit} 
                      onValueChange={(v) => setNewFormulaMetric(prev => ({ ...prev, unit: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="%">Percentage (%)</SelectItem>
                        <SelectItem value="days">Days</SelectItem>
                        <SelectItem value="none">None</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Color</Label>
                    <Select 
                      value={newFormulaMetric.color} 
                      onValueChange={(v) => setNewFormulaMetric(prev => ({ ...prev, color: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="primary">Primary</SelectItem>
                        <SelectItem value="green">Green</SelectItem>
                        <SelectItem value="red">Red</SelectItem>
                        <SelectItem value="amber">Amber</SelectItem>
                        <SelectItem value="blue">Blue</SelectItem>
                        <SelectItem value="violet">Violet</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Icon</Label>
                    <Select 
                      value={newFormulaMetric.icon} 
                      onValueChange={(v) => setNewFormulaMetric(prev => ({ ...prev, icon: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Calculator">Calculator</SelectItem>
                        <SelectItem value="TrendingUp">Trending Up</SelectItem>
                        <SelectItem value="Clock">Clock</SelectItem>
                        <SelectItem value="Timer">Timer</SelectItem>
                        <SelectItem value="Target">Target</SelectItem>
                        <SelectItem value="BarChart3">Bar Chart</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setShowCreateFormula(false)}>Cancel</Button>
                  <Button onClick={createCustomFormulaMetric}>Create Metric</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Create Custom Metric Form */}
          {showCreateMetric && (
            <Card className="border-primary">
              <CardHeader>
                <CardTitle className="text-lg">Create Custom Metric</CardTitle>
                <CardDescription>Add a new metric to track on the dashboard</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Metric ID (unique, no spaces)</Label>
                    <Input
                      placeholder="e.g., rental_leads"
                      value={newMetric.metric_id}
                      onChange={(e) => setNewMetric(prev => ({ ...prev, metric_id: e.target.value.toLowerCase().replace(/\s/g, '_') }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Display Name</Label>
                    <Input
                      placeholder="e.g., Rental Leads"
                      value={newMetric.metric_name}
                      onChange={(e) => setNewMetric(prev => ({ ...prev, metric_name: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    placeholder="e.g., Leads from rental segment"
                    value={newMetric.description}
                    onChange={(e) => setNewMetric(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Field to Filter By</Label>
                    <Select 
                      value={newMetric.field_name} 
                      onValueChange={(v) => setNewMetric(prev => ({ ...prev, field_name: v, field_values: [] }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(availableFields).map(field => (
                          <SelectItem key={field} value={field}>{field}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Color</Label>
                    <Select 
                      value={newMetric.color} 
                      onValueChange={(v) => setNewMetric(prev => ({ ...prev, color: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="primary">Primary (Blue)</SelectItem>
                        <SelectItem value="green">Green</SelectItem>
                        <SelectItem value="red">Red</SelectItem>
                        <SelectItem value="yellow">Yellow</SelectItem>
                        <SelectItem value="orange">Orange</SelectItem>
                        <SelectItem value="purple">Purple</SelectItem>
                        <SelectItem value="blue">Blue</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Select Values to Count</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-2 border rounded-md">
                    {availableFields[newMetric.field_name]?.map(value => (
                      <div
                        key={value}
                        className={`flex items-center gap-2 p-2 rounded cursor-pointer ${
                          newMetric.field_values.includes(value) ? 'bg-primary/10 border border-primary' : 'bg-muted/50'
                        }`}
                        onClick={() => {
                          setNewMetric(prev => ({
                            ...prev,
                            field_values: prev.field_values.includes(value)
                              ? prev.field_values.filter(v => v !== value)
                              : [...prev.field_values, value]
                          }));
                        }}
                      >
                        <Checkbox checked={newMetric.field_values.includes(value)} className="pointer-events-none" />
                        <span className="text-sm">{value}</span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          ({fieldCounts[newMetric.field_name]?.[value] || 0})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={newMetric.show_on_dashboard}
                    onCheckedChange={(checked) => setNewMetric(prev => ({ ...prev, show_on_dashboard: checked }))}
                  />
                  <Label>Show on Dashboard</Label>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setShowCreateMetric(false)}>Cancel</Button>
                  <Button onClick={createCustomMetric}>Create Metric</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {metricSettings ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {metricSettings.map((metric) => (
                <Card key={metric.metric_id} className={`relative ${!metric.show_on_dashboard ? 'opacity-60' : ''}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        {metric.metric_name}
                        {savingMetric === metric.metric_id && (
                          <Badge variant="secondary" className="text-xs">Saving...</Badge>
                        )}
                        {metric.is_custom && (
                          <Badge variant="outline" className="text-xs">Custom</Badge>
                        )}
                      </CardTitle>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2"
                          onClick={() => toggleMetricDashboard(metric)}
                          title={metric.show_on_dashboard ? 'Hide from dashboard' : 'Show on dashboard'}
                        >
                          {metric.show_on_dashboard ? <Check className="h-3 w-3 text-green-600" /> : <X className="h-3 w-3 text-muted-foreground" />}
                        </Button>
                        {metric.is_custom && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-destructive hover:text-destructive"
                            onClick={() => deleteCustomMetric(metric.metric_id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <CardDescription className="text-xs">
                      {metric.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2">
                    {/* Type badge */}
                    <div className="mb-3 flex items-center gap-2">
                      <Badge variant={metric.metric_type === 'formula' ? 'default' : metric.metric_type === 'calculated' ? 'secondary' : 'outline'}>
                        {metric.metric_type || 'count'}
                      </Badge>
                      {metric.unit && <span className="text-xs text-muted-foreground">Unit: {metric.unit}</span>}
                    </div>
                    
                    {/* For count-based metrics: show field selection */}
                    {(metric.metric_type === 'count' || !metric.metric_type) && metric.field_name && (
                      <>
                        <div className="mb-2">
                          <span className="text-xs font-medium text-muted-foreground">
                            Field: <code className="bg-muted px-1 rounded">{metric.field_name}</code>
                          </span>
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {availableFields[metric.field_name]?.map((value) => {
                            const isSelected = metric.field_values?.includes(value);
                            const count = fieldCounts[metric.field_name]?.[value] || 0;
                            return (
                              <div
                                key={value}
                                className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${
                                  isSelected ? 'bg-primary/10 border border-primary/30' : 'bg-muted/50 hover:bg-muted'
                                }`}
                                onClick={() => toggleMetricValue(metric, value)}
                              >
                                <div className="flex items-center gap-2">
                                  <Checkbox 
                                    checked={isSelected} 
                                    className="pointer-events-none"
                                  />
                                  <span className="text-sm font-medium">{value}</span>
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  {count.toLocaleString()} leads
                                </Badge>
                              </div>
                            );
                          })}
                          {(!availableFields[metric.field_name] || availableFields[metric.field_name].length === 0) && (
                            <p className="text-sm text-muted-foreground">No values found for this field</p>
                          )}
                        </div>
                        <div className="mt-3 pt-2 border-t">
                          <p className="text-xs text-muted-foreground">
                            Currently counting: <span className="font-medium text-foreground">
                              {metric.field_values?.length > 0 ? metric.field_values.join(', ') : 'None selected'}
                            </span>
                          </p>
                        </div>
                      </>
                    )}
                    
                    {/* For formula-based metrics: show formula editor */}
                    {metric.metric_type === 'formula' && (
                      <div className="space-y-3">
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <p className="text-xs font-medium mb-2">Formula: Numerator / Denominator × 100</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Numerator</Label>
                              <Select 
                                value={metric.numerator_metric || ''} 
                                onValueChange={(v) => updateFormulaMetric(metric.metric_id, 'numerator_metric', v)}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Select metric" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="won_leads">Won Leads</SelectItem>
                                  <SelectItem value="lost_leads">Lost Leads</SelectItem>
                                  <SelectItem value="open_leads">Open Leads</SelectItem>
                                  <SelectItem value="closed_leads">Closed Leads</SelectItem>
                                  <SelectItem value="hot_leads">Hot Leads</SelectItem>
                                  <SelectItem value="total_leads">Total Leads</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs">Denominator</Label>
                              <Select 
                                value={metric.denominator_metric || ''} 
                                onValueChange={(v) => updateFormulaMetric(metric.metric_id, 'denominator_metric', v)}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Select metric(s)" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="total_leads">Total Leads</SelectItem>
                                  <SelectItem value="won_leads+lost_leads">Won + Lost</SelectItem>
                                  <SelectItem value="open_leads">Open Leads</SelectItem>
                                  <SelectItem value="closed_leads">Closed Leads</SelectItem>
                                  <SelectItem value="hot_leads+warm_leads+cold_leads">Hot + Warm + Cold</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Current formula: <code className="bg-muted px-1 rounded">
                            {metric.numerator_metric || '?'} / ({metric.denominator_metric || '?'}) × 100
                          </code>
                        </p>
                      </div>
                    )}
                    
                    {/* For calculated metrics: show configurable editor */}
                    {metric.metric_type === 'calculated' && (
                      <div className="space-y-3">
                        <div className="p-3 bg-muted/30 rounded-lg space-y-3">
                          <p className="text-xs font-medium">Formula: (End Date - Start Date) in days</p>
                          
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Start Date Field</Label>
                              <Select 
                                value={metric.start_date_field || 'enquiry_date'} 
                                onValueChange={(v) => updateCalculatedMetric(metric.metric_id, { start_date_field: v })}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="enquiry_date">Enquiry Date</SelectItem>
                                  <SelectItem value="planned_followup_date">Planned Follow-up Date</SelectItem>
                                  <SelectItem value="last_followup_date">Last Follow-up Date</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs">End Date Field</Label>
                              <Select 
                                value={metric.end_date_field || 'today'} 
                                onValueChange={(v) => updateCalculatedMetric(metric.metric_id, { end_date_field: v })}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="today">Today (Current Date)</SelectItem>
                                  <SelectItem value="last_followup_date">Last Follow-up Date</SelectItem>
                                  <SelectItem value="planned_followup_date">Planned Follow-up Date</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          
                          <div>
                            <Label className="text-xs">Filter by Stages (which leads to include)</Label>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {['Prospecting', 'Qualified', 'Proposal', 'Negotiation', 'Closed-Won', 'Order Booked', 'Closed-Lost', 'Closed-Dropped'].map(stage => {
                                const isSelected = metric.filter_stages?.includes(stage);
                                return (
                                  <Badge 
                                    key={stage}
                                    variant={isSelected ? 'default' : 'outline'}
                                    className="cursor-pointer text-xs"
                                    onClick={() => {
                                      const newStages = isSelected 
                                        ? (metric.filter_stages || []).filter(s => s !== stage)
                                        : [...(metric.filter_stages || []), stage];
                                      updateCalculatedMetric(metric.metric_id, { filter_stages: newStages });
                                    }}
                                  >
                                    {stage}
                                  </Badge>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Current: <code className="bg-muted px-1 rounded">
                            ({metric.end_date_field || 'today'} - {metric.start_date_field || 'enquiry_date'}) for {metric.filter_stages?.join(', ') || 'all stages'}
                          </code>
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex justify-center p-8">
              <Skeleton className="h-48 w-full" />
            </div>
          )}

          {/* Legend */}
          <Card className="mt-4">
            <CardContent className="pt-4">
              <h4 className="font-medium mb-2">How it works:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Click on values to toggle them on/off for each metric</li>
                <li>• Changes are saved automatically</li>
                <li>• The dashboard KPIs will update based on your selections</li>
                <li>• <strong>Won Leads</strong>: Leads counted as successful conversions</li>
                <li>• <strong>Lost Leads</strong>: Leads counted as unsuccessful</li>
                <li>• <strong>Conversion Rate</strong>: Won / (Won + Lost) × 100</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Entity Profile Configuration Tab */}
        <TabsContent value="entity-profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Entity Profile Page Settings
              </CardTitle>
              <CardDescription>
                Configure which KPIs and charts appear on entity profile pages (States, Dealers, Employees, Cities)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* KPI Selection */}
              <div>
                <h4 className="font-medium mb-3">KPI Cards to Display</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {availableKpis.built_in_metrics?.map(metric => (
                    <div
                      key={metric.metric_id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        entityProfileConfig?.kpis?.enabled_kpis?.includes(metric.metric_id)
                          ? 'bg-primary/10 border-primary'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => toggleKpiEnabled(metric.metric_id)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{metric.display_name}</span>
                        {entityProfileConfig?.kpis?.enabled_kpis?.includes(metric.metric_id) && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      {metric.unit && (
                        <span className="text-xs text-muted-foreground">Unit: {metric.unit}</span>
                      )}
                    </div>
                  ))}
                  {availableKpis.configurable_metrics?.map(metric => (
                    <div
                      key={metric.metric_id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        entityProfileConfig?.kpis?.enabled_kpis?.includes(metric.metric_id)
                          ? 'bg-primary/10 border-primary'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => toggleKpiEnabled(metric.metric_id)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{metric.display_name}</span>
                        {entityProfileConfig?.kpis?.enabled_kpis?.includes(metric.metric_id) && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      {metric.unit && (
                        <span className="text-xs text-muted-foreground">Unit: {metric.unit}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Chart Selection */}
              <div>
                <h4 className="font-medium mb-3">Charts to Display</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    { key: 'stage_breakdown', label: 'Lead Stage Breakdown', desc: 'Pie chart of lead stages' },
                    { key: 'source_breakdown', label: 'Lead Source Distribution', desc: 'Bar chart of lead sources' },
                    { key: 'segment_performance', label: 'Segment Performance', desc: 'Table of segment metrics' },
                    { key: 'trend', label: 'Lead Trend Over Time', desc: 'Line chart of leads over months' },
                    { key: 'followup_status', label: 'Follow-up Status', desc: 'Overdue vs On-track counts' },
                  ].map(chart => (
                    <div
                      key={chart.key}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        entityProfileConfig?.charts?.[chart.key]?.enabled
                          ? 'bg-primary/10 border-primary'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => toggleChartEnabled(chart.key)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{chart.label}</span>
                        {entityProfileConfig?.charts?.[chart.key]?.enabled && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{chart.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sub-entity Display Options */}
              <div>
                <h4 className="font-medium mb-3">Sub-entity Display Options</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { key: 'show_top_performers', label: 'Top Performers' },
                    { key: 'show_employees', label: 'Employees List' },
                    { key: 'show_dealers', label: 'Dealers List' },
                    { key: 'show_cities', label: 'Cities List' },
                  ].map(option => (
                    <div
                      key={option.key}
                      className="flex items-center gap-2"
                    >
                      <Checkbox
                        id={option.key}
                        checked={entityProfileConfig?.sub_entities?.[option.key] ?? true}
                        onCheckedChange={(checked) => {
                          setEntityProfileConfig(prev => ({
                            ...prev,
                            sub_entities: {
                              ...prev?.sub_entities,
                              [option.key]: checked
                            }
                          }));
                        }}
                      />
                      <Label htmlFor={option.key}>{option.label}</Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end">
                <Button onClick={saveEntityProfileConfig} disabled={savingEntityConfig}>
                  <Save className="h-4 w-4 mr-2" />
                  {savingEntityConfig ? 'Saving...' : 'Save Configuration'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <h4 className="font-medium mb-2">How it works:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Select which KPIs to show on Entity Profile pages (States, Dealers, Employees, Cities)</li>
                <li>• Toggle charts on/off to customize the profile page layout</li>
                <li>• Entity profiles use the same date filter as the Dashboard</li>
                <li>• All data calculations use the same formulas as the main Dashboard metrics</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Qualification Questions Tab */}
        <TabsContent value="qualification" className="space-y-4">
          {/* Threshold Setting */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Qualification Threshold
              </CardTitle>
              <CardDescription>
                Leads with a score ≥ threshold are marked as "Qualified", otherwise "Faulty"
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Slider
                    value={[qualificationSettings.threshold_score]}
                    onValueChange={(v) => setQualificationSettings(prev => ({ ...prev, threshold_score: v[0] }))}
                    max={Math.max(maxPossibleScore, 100)}
                    step={1}
                  />
                </div>
                <Input
                  type="number"
                  value={qualificationSettings.threshold_score}
                  onChange={(e) => setQualificationSettings(prev => ({ ...prev, threshold_score: parseInt(e.target.value) || 0 }))}
                  className="w-24"
                />
                <Button onClick={updateThreshold} className="gap-2">
                  <Save className="h-4 w-4" />
                  Save
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Current threshold: <strong>{qualificationSettings.threshold_score}</strong> points 
                (Max possible from questions: <strong>{maxPossibleScore}</strong>)
              </p>
            </CardContent>
          </Card>

          {/* Questions List */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Qualification Questions</CardTitle>
                <CardDescription>Questions with scored answer options</CardDescription>
              </div>
              <Button onClick={() => setIsQualDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Question
              </Button>
            </CardHeader>
            <CardContent>
              {qualificationQuestions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No qualification questions defined</p>
              ) : (
                <div className="space-y-4">
                  {qualificationQuestions.map((q, idx) => (
                    <Card key={q.question_id} className="bg-muted/50">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium">{idx + 1}. {q.question}</p>
                            {q.description && <p className="text-sm text-muted-foreground mt-1">{q.description}</p>}
                            <div className="flex flex-wrap gap-2 mt-3">
                              {q.options?.map((opt, optIdx) => (
                                <Badge key={optIdx} variant="outline" className="gap-1">
                                  {opt.text}: <strong>+{opt.score}</strong>
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteQualificationQuestion(q.question_id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add Qualification Question Dialog */}
          <Dialog open={isQualDialogOpen} onOpenChange={setIsQualDialogOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add Qualification Question</DialogTitle>
                <DialogDescription>Create a question with scored answer options</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Question *</Label>
                  <Input
                    value={newQualQuestion.question}
                    onChange={(e) => setNewQualQuestion(prev => ({ ...prev, question: e.target.value }))}
                    placeholder="e.g., Is budget confirmed?"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <Input
                    value={newQualQuestion.description}
                    onChange={(e) => setNewQualQuestion(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Additional context for this question"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Answer Options</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addQualOption}>
                      <Plus className="h-3 w-3 mr-1" /> Add Option
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {newQualQuestion.options.map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Input
                          value={opt.text}
                          onChange={(e) => updateQualOption(idx, 'text', e.target.value)}
                          placeholder="Answer text"
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          value={opt.score}
                          onChange={(e) => updateQualOption(idx, 'score', e.target.value)}
                          placeholder="Score"
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">pts</span>
                        {newQualQuestion.options.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeQualOption(idx)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <Button onClick={createQualificationQuestion} className="w-full">
                  Create Question
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Closure Questions Tab */}
        <TabsContent value="closure">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Lead Closure Questions</CardTitle>
                <CardDescription>Questions asked when closing a lead</CardDescription>
              </div>
              <Button onClick={() => setIsClosureDialogOpen(true)}>Add Question</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Question</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Applies To</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {closureQuestions.map((q) => (
                    <TableRow key={q.question_id}>
                      <TableCell className="font-medium">{q.question}</TableCell>
                      <TableCell><Badge variant="outline">{q.type}</Badge></TableCell>
                      <TableCell>{q.applies_to}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteClosureQuestion(q.question_id)}
                          className="text-destructive"
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {closureQuestions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No closure questions defined
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Add Closure Question Dialog */}
          <Dialog open={isClosureDialogOpen} onOpenChange={setIsClosureDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Closure Question</DialogTitle>
                <DialogDescription>Create a question for lead closure</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Question</Label>
                  <Input
                    value={newClosureQuestion.question}
                    onChange={(e) => setNewClosureQuestion(prev => ({ ...prev, question: e.target.value }))}
                    placeholder="Enter question"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={newClosureQuestion.type} onValueChange={(v) => setNewClosureQuestion(prev => ({ ...prev, type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="select">Select</SelectItem>
                        <SelectItem value="multiselect">Multi-select</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Applies To</Label>
                    <Select value={newClosureQuestion.applies_to} onValueChange={(v) => setNewClosureQuestion(prev => ({ ...prev, applies_to: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Closures</SelectItem>
                        <SelectItem value="won">Won Only</SelectItem>
                        <SelectItem value="lost">Lost Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={createClosureQuestion} className="w-full">Create Question</Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Data Management Tab */}
        <TabsContent value="data" className="space-y-4">
          {/* Current Data Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Current Data Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dataStats ? (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Leads</p>
                    <p className="text-2xl font-bold">{dataStats.total_leads?.toLocaleString() || 0}</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Earliest Date</p>
                    <p className="text-2xl font-bold">{dataStats.date_range?.min || '-'}</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Latest Date</p>
                    <p className="text-2xl font-bold">{dataStats.date_range?.max || '-'}</p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-sm text-red-600">In Trash</p>
                    <p className="text-2xl font-bold text-red-600">{trashStats?.total_in_trash || 0}</p>
                  </div>
                </div>
              ) : (
                <Skeleton className="h-24 w-full" />
              )}
              
              {dataStats?.monthly_distribution?.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium mb-3">Monthly Distribution (Last 12 months)</h4>
                  <div className="flex flex-wrap gap-2">
                    {dataStats.monthly_distribution.map((m, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {m.month}: {m.count.toLocaleString()}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Uploads Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Recent Uploads (Last 7 Days)
              </CardTitle>
              <CardDescription>
                View and manage recently uploaded data files. You can delete entire upload batches if needed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingUploads ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : recentUploads.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Upload className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No uploads in the last 7 days</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentUploads.map((upload) => (
                    <div
                      key={upload.activity_id}
                      className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{upload.filename}</span>
                          <Badge variant={
                            upload.action === 'lost_leads_upload' ? 'destructive' :
                            upload.action === 'historical_data_upload' ? 'secondary' : 'outline'
                          }>
                            {upload.action === 'lost_leads_upload' ? 'Lost Leads' :
                             upload.action === 'historical_data_upload' ? 'Historical' : 'Regular'}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          <span>Uploaded: {new Date(upload.created_at).toLocaleString()}</span>
                          <span className="mx-2">•</span>
                          <span>Created: {upload.created_count}</span>
                          {upload.skipped_count > 0 && (
                            <>
                              <span className="mx-2">•</span>
                              <span>Skipped: {upload.skipped_count}</span>
                            </>
                          )}
                          {upload.updated_count > 0 && (
                            <>
                              <span className="mx-2">•</span>
                              <span>Updated: {upload.updated_count}</span>
                            </>
                          )}
                          <span className="mx-2">•</span>
                          <span className="font-medium">
                            Current: {upload.current_lead_count} leads
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {upload.can_delete ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteUploadBatch(upload.upload_batch_id)}
                            disabled={deletingBatch === upload.upload_batch_id}
                          >
                            {deletingBatch === upload.upload_batch_id ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                            <span className="ml-1">Delete</span>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {upload.upload_batch_id ? 'No leads remaining' : 'Legacy upload (no batch ID)'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadRecentUploads}
                    className="w-full mt-2"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Delete Leads Card */}
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="h-5 w-5" />
                Delete Leads
              </CardTitle>
              <CardDescription>
                Soft delete leads by applying filters. Deleted leads can be recovered within 14 days.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Delete All Option */}
              <div className="flex items-center space-x-2 p-4 bg-red-50 rounded-lg border border-red-200">
                <Checkbox
                  id="deleteAll"
                  checked={deleteFilters.deleteAll}
                  onCheckedChange={(checked) => {
                    setDeleteFilters({ 
                      ...deleteFilters, 
                      deleteAll: checked,
                      startDate: '', endDate: '', state: '', dealer: '',
                      employee: '', stage: '', segment: '', source: ''
                    });
                    setDeletePreview(null);
                  }}
                />
                <Label htmlFor="deleteAll" className="text-red-600 font-medium cursor-pointer">
                  Delete ALL leads (use with extreme caution)
                </Label>
              </div>

              {/* Filter Options */}
              {!deleteFilters.deleteAll && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Date Range</Label>
                    <div className="flex gap-2">
                      <Input
                        type="date"
                        value={deleteFilters.startDate}
                        onChange={(e) => setDeleteFilters({ ...deleteFilters, startDate: e.target.value })}
                        placeholder="Start"
                      />
                      <Input
                        type="date"
                        value={deleteFilters.endDate}
                        onChange={(e) => setDeleteFilters({ ...deleteFilters, endDate: e.target.value })}
                        placeholder="End"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>State</Label>
                    <Select
                      value={deleteFilters.state}
                      onValueChange={(v) => setDeleteFilters({ ...deleteFilters, state: v === 'all' ? '' : v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All States" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All States</SelectItem>
                        {deleteFilterOptions.states.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Dealer</Label>
                    <Select
                      value={deleteFilters.dealer}
                      onValueChange={(v) => setDeleteFilters({ ...deleteFilters, dealer: v === 'all' ? '' : v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All Dealers" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Dealers</SelectItem>
                        {deleteFilterOptions.dealers.map(d => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Employee</Label>
                    <Select
                      value={deleteFilters.employee}
                      onValueChange={(v) => setDeleteFilters({ ...deleteFilters, employee: v === 'all' ? '' : v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All Employees" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Employees</SelectItem>
                        {deleteFilterOptions.employees.map(e => (
                          <SelectItem key={e} value={e}>{e}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Enquiry Stage</Label>
                    <Select
                      value={deleteFilters.stage}
                      onValueChange={(v) => setDeleteFilters({ ...deleteFilters, stage: v === 'all' ? '' : v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All Stages" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Stages</SelectItem>
                        {deleteFilterOptions.stages.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Segment</Label>
                    <Select
                      value={deleteFilters.segment}
                      onValueChange={(v) => setDeleteFilters({ ...deleteFilters, segment: v === 'all' ? '' : v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All Segments" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Segments</SelectItem>
                        {deleteFilterOptions.segments.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Source</Label>
                    <Select
                      value={deleteFilters.source}
                      onValueChange={(v) => setDeleteFilters({ ...deleteFilters, source: v === 'all' ? '' : v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All Sources" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sources</SelectItem>
                        {deleteFilterOptions.sources.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Preview Button */}
              <div className="flex gap-2">
                <Button onClick={previewDelete} disabled={loadingPreview} variant="outline">
                  {loadingPreview ? 'Loading...' : 'Preview Deletion'}
                </Button>
                {deletePreview && (
                  <Button 
                    variant="destructive" 
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={deletePreview.count === 0}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete {deletePreview.count.toLocaleString()} Leads
                  </Button>
                )}
              </div>

              {/* Preview Results */}
              {deletePreview && (
                <div className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-lg">
                        {deletePreview.count.toLocaleString()} leads will be moved to trash
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Can be recovered within 14 days
                      </p>
                    </div>
                    {deletePreview.count > 0 && (
                      <Badge variant="destructive" className="text-lg px-4 py-1">
                        {deletePreview.count.toLocaleString()}
                      </Badge>
                    )}
                  </div>
                  
                  {Object.keys(deletePreview.filters_applied).length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      <span className="text-sm text-muted-foreground">Filters:</span>
                      {Object.entries(deletePreview.filters_applied).map(([key, value]) => (
                        <Badge key={key} variant="outline">{key}: {value}</Badge>
                      ))}
                    </div>
                  )}
                  
                  {deletePreview.sample_leads?.length > 0 && (
                    <div>
                      <h5 className="text-sm font-medium mb-2">Sample leads (showing {deletePreview.sample_leads.length}):</h5>
                      <div className="text-xs bg-muted rounded p-2 max-h-40 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Enquiry No</TableHead>
                              <TableHead className="text-xs">Name</TableHead>
                              <TableHead className="text-xs">Date</TableHead>
                              <TableHead className="text-xs">State</TableHead>
                              <TableHead className="text-xs">Dealer</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {deletePreview.sample_leads.map((lead, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="text-xs">{lead.enquiry_no}</TableCell>
                                <TableCell className="text-xs">{lead.name || '-'}</TableCell>
                                <TableCell className="text-xs">{lead.enquiry_date}</TableCell>
                                <TableCell className="text-xs">{lead.state}</TableCell>
                                <TableCell className="text-xs">{lead.dealer}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Delete Confirmation Dialog */}
          <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-red-600 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Confirm Deletion
                </DialogTitle>
                <DialogDescription>
                  You are about to move <strong>{deletePreview?.count?.toLocaleString() || 0} leads</strong> to trash.
                  They can be recovered within 14 days.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Type DELETE to confirm</AlertTitle>
                  <AlertDescription>
                    This action will move the selected leads to trash.
                  </AlertDescription>
                </Alert>
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
                  placeholder="Type DELETE here"
                  className="text-center font-mono text-lg"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText('');
                }}>
                  Cancel
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={executeDelete}
                  disabled={deleteConfirmText !== 'DELETE' || deleting}
                >
                  {deleting ? 'Deleting...' : 'Confirm Delete'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Warning: Historical Upload</AlertTitle>
            <AlertDescription>
              Uploading historical data will <strong>delete all existing leads</strong> with dates up to the maximum date in your uploaded file, then insert the new data. This action cannot be undone.
            </AlertDescription>
          </Alert>

          {/* Historical Data Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Historical Data
              </CardTitle>
              <CardDescription>
                Replace existing lead data with a new Excel file. Data will be replaced up to the maximum "Enquiry Date" found in your file.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <div className="space-y-2">
                  <Label htmlFor="historical-upload" className="cursor-pointer">
                    <span className="text-primary hover:underline">Click to upload</span> or drag and drop
                  </Label>
                  <p className="text-sm text-muted-foreground">Excel files only (.xlsx, .xls) - Supports up to 50,000 rows</p>
                  <Input
                    id="historical-upload"
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={handleHistoricalUpload}
                    disabled={uploadingHistorical}
                  />
                  <Button 
                    variant="outline" 
                    onClick={() => document.getElementById('historical-upload').click()}
                    disabled={uploadingHistorical}
                    className="mt-2"
                  >
                    {uploadingHistorical ? 'Processing...' : 'Select File'}
                  </Button>
                </div>
              </div>
              
              {/* Progress Bar */}
              {uploadingHistorical && (
                <div className="space-y-2 p-4 bg-muted rounded-lg">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{uploadProgress.message || 'Processing...'}</span>
                    <span className="text-muted-foreground">{uploadProgress.progress}%</span>
                  </div>
                  <Progress value={uploadProgress.progress} className="h-3" />
                  <p className="text-xs text-muted-foreground">
                    {uploadProgress.status === 'uploading' && 'Uploading file to server...'}
                    {uploadProgress.status === 'reading_file' && 'Reading Excel file...'}
                    {uploadProgress.status === 'parsing_dates' && 'Parsing date fields...'}
                    {uploadProgress.status === 'deleting_old' && 'Removing old records...'}
                    {uploadProgress.status === 'processing' && 'Inserting new records in batches...'}
                    {uploadProgress.status === 'complete' && 'Upload complete!'}
                  </p>
                </div>
              )}

              {/* Upload Result */}
              {historicalUploadResult && (
                <Card className={historicalUploadResult.success ? 'border-green-500' : 'border-destructive'}>
                  <CardContent className="pt-4">
                    {historicalUploadResult.success ? (
                      <div className="space-y-2">
                        <p className="font-medium text-green-600">Upload Successful</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Date Range</p>
                            <p className="font-medium">{historicalUploadResult.date_range?.min} to {historicalUploadResult.date_range?.max}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Deleted</p>
                            <p className="font-medium">{historicalUploadResult.deleted?.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Created</p>
                            <p className="font-medium">{historicalUploadResult.created?.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Errors</p>
                            <p className="font-medium">{historicalUploadResult.total_errors || 0}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-destructive">{historicalUploadResult.error || 'Upload failed'}</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Instructions */}
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">How it works:</h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Upload an Excel file with lead data (must include "Enquiry Date" column)</li>
                  <li>System identifies the date range in your file</li>
                  <li>All existing leads with dates up to the max date are deleted</li>
                  <li>New leads from the file are inserted</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          {/* Data Migration Card - For Production Deployment */}
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-700">
                <Database className="h-5 w-5" />
                Data Migration (Production Import)
              </CardTitle>
              <CardDescription>
                Import pre-exported data into this database. Use this after deployment to sync production data.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={loadMigrationStatus} 
                disabled={loadingMigration}
                variant="outline"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loadingMigration ? 'animate-spin' : ''}`} />
                Check Migration Status
              </Button>

              {migrationStatus && (
                <div className="space-y-4">
                  {migrationStatus.export_available ? (
                    <>
                      <Alert className="border-green-200 bg-green-50">
                        <Check className="h-4 w-4 text-green-600" />
                        <AlertTitle className="text-green-700">Export Data Available</AlertTitle>
                        <AlertDescription className="text-green-600">
                          Export Date: {new Date(migrationStatus.export_info?.export_date).toLocaleString()}<br />
                          Total Documents: {migrationStatus.export_info?.total_documents?.toLocaleString()}
                        </AlertDescription>
                      </Alert>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-white rounded-lg border">
                          <p className="text-sm text-muted-foreground">Current Leads</p>
                          <p className="text-2xl font-bold">{migrationStatus.current_db_counts?.leads?.toLocaleString()}</p>
                        </div>
                        <div className="p-4 bg-white rounded-lg border">
                          <p className="text-sm text-muted-foreground">Export Leads</p>
                          <p className="text-2xl font-bold text-blue-600">26,745</p>
                        </div>
                        <div className="p-4 bg-white rounded-lg border">
                          <p className="text-sm text-muted-foreground">Users</p>
                          <p className="text-2xl font-bold">{migrationStatus.current_db_counts?.users}</p>
                        </div>
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        <Button 
                          onClick={() => runDataImport(true)} 
                          disabled={importing}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          {importing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Database className="h-4 w-4 mr-2" />}
                          Import Leads Only
                        </Button>
                        <Button 
                          onClick={() => runDataImport(false)} 
                          disabled={importing}
                          variant="outline"
                        >
                          {importing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Database className="h-4 w-4 mr-2" />}
                          Import All Collections
                        </Button>
                        <Button 
                          onClick={() => runDataImport(false, true)} 
                          disabled={importing}
                          variant="destructive"
                        >
                          {importing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                          FULL RESET (Local Files)
                        </Button>
                      </div>

                      <div className="border-t pt-4 mt-4">
                        <h4 className="font-medium mb-2">Sync from Preview (Recommended for Deployed Version)</h4>
                        <p className="text-sm text-muted-foreground mb-3">
                          This will fetch all 26,745 leads directly from the preview environment and import them here.
                        </p>
                        <Button 
                          onClick={syncFromPreview} 
                          disabled={importing}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {importing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                          Sync from Preview Environment
                        </Button>
                      </div>

                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Warning</AlertTitle>
                        <AlertDescription>
                          All import options will replace existing data. This action cannot be undone.
                          <br /><strong>Sync from Preview</strong> is recommended for deployed environments as it fetches fresh data directly.
                        </AlertDescription>
                      </Alert>

                      {/* Data Cleanup Section */}
                      <div className="border-t pt-4 mt-4">
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <RefreshCw className="h-4 w-4 text-purple-600" />
                          Run Data Cleanup & Merge
                        </h4>
                        <p className="text-sm text-muted-foreground mb-3">
                          Clean messy/concatenated data and re-run intelligent merge logic. This cleans remarks, 
                          de-duplicates text fields, and merges leads by phone number using the new logic.
                        </p>
                        <Button 
                          onClick={runDataCleanup} 
                          disabled={runningCleanup || importing}
                          className="bg-purple-600 hover:bg-purple-700"
                          data-testid="run-cleanup-btn"
                        >
                          {runningCleanup ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Running Cleanup...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Run Data Cleanup
                            </>
                          )}
                        </Button>
                        
                        {cleanupResult && (
                          <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                            <h5 className="font-medium text-purple-700 mb-2">Cleanup Results</h5>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                              <div>
                                <p className="text-muted-foreground">Total Processed</p>
                                <p className="font-semibold">{cleanupResult.total_leads_processed?.toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Leads Cleaned</p>
                                <p className="font-semibold text-blue-600">{cleanupResult.leads_cleaned?.toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Merge Groups</p>
                                <p className="font-semibold text-green-600">{cleanupResult.merge_groups_processed?.toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Marked Duplicate</p>
                                <p className="font-semibold text-orange-600">{cleanupResult.leads_marked_duplicate?.toLocaleString()}</p>
                              </div>
                            </div>
                            <div className="mt-3 pt-3 border-t border-purple-200 grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-muted-foreground">Final Total</p>
                                <p className="font-semibold">{cleanupResult.final_total?.toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Non-Duplicates</p>
                                <p className="font-semibold text-green-600">{cleanupResult.final_non_duplicates?.toLocaleString()}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <Alert className="mb-4">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>No Local Export Files</AlertTitle>
                        <AlertDescription>
                          Local export files not found. Use "Sync from Preview" to import data directly.
                        </AlertDescription>
                      </Alert>
                      
                      <div className="border-t pt-4">
                        <h4 className="font-medium mb-2">Sync from Preview Environment</h4>
                        <p className="text-sm text-muted-foreground mb-3">
                          Fetch all 26,745 leads directly from the preview environment.
                        </p>
                        <Button 
                          onClick={syncFromPreview} 
                          disabled={importing}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {importing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                          Sync from Preview Environment
                        </Button>
                      </div>

                      {/* Data Cleanup Section - Also available when no local export */}
                      <div className="border-t pt-4 mt-4">
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <RefreshCw className="h-4 w-4 text-purple-600" />
                          Run Data Cleanup & Merge
                        </h4>
                        <p className="text-sm text-muted-foreground mb-3">
                          Clean messy/concatenated data and re-run intelligent merge logic on the current database.
                        </p>
                        <Button 
                          onClick={runDataCleanup} 
                          disabled={runningCleanup || importing}
                          className="bg-purple-600 hover:bg-purple-700"
                          data-testid="run-cleanup-btn-alt"
                        >
                          {runningCleanup ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Running Cleanup...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Run Data Cleanup
                            </>
                          )}
                        </Button>
                        
                        {cleanupResult && (
                          <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                            <h5 className="font-medium text-purple-700 mb-2">Cleanup Results</h5>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                              <div>
                                <p className="text-muted-foreground">Total Processed</p>
                                <p className="font-semibold">{cleanupResult.total_leads_processed?.toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Leads Cleaned</p>
                                <p className="font-semibold text-blue-600">{cleanupResult.leads_cleaned?.toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Merge Groups</p>
                                <p className="font-semibold text-green-600">{cleanupResult.merge_groups_processed?.toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Marked Duplicate</p>
                                <p className="font-semibold text-orange-600">{cleanupResult.leads_marked_duplicate?.toLocaleString()}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trash Tab */}
        <TabsContent value="trash" className="space-y-4">
          {/* Trash Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Trash2 className="h-4 w-4 text-red-500" />
                  Total in Trash
                </div>
                <p className="text-2xl font-bold text-red-600">{trashStats?.total_in_trash || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Expiring Soon (3 days)
                </div>
                <p className="text-2xl font-bold text-amber-600">{trashStats?.expiring_soon || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Clock className="h-4 w-4" />
                  Recovery Period
                </div>
                <p className="text-2xl font-bold">{trashStats?.recovery_days || 14} days</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 flex items-center justify-center">
                <Button 
                  variant="outline" 
                  onClick={() => { loadTrashStats(); loadTrashLeads(); }}
                  className="w-full"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Bulk Actions */}
          {trashTotal > 0 && (
            <Card>
              <CardContent className="pt-4 flex flex-wrap gap-2 items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedTrashLeads.length === trashLeads.length && trashLeads.length > 0}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedTrashLeads(trashLeads.map(l => l.lead_id));
                      } else {
                        setSelectedTrashLeads([]);
                      }
                    }}
                  />
                  <span className="text-sm">
                    {selectedTrashLeads.length > 0 
                      ? `${selectedTrashLeads.length} selected` 
                      : 'Select all on this page'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => recoverLeads(selectedTrashLeads)}
                    disabled={selectedTrashLeads.length === 0 || recoveringLeads}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Recover Selected
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => recoverLeads(null, true)}
                    disabled={recoveringLeads}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Recover All ({trashTotal})
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (window.confirm(`Permanently delete ${selectedTrashLeads.length} leads? This cannot be undone.`)) {
                        permanentDeleteLeads(selectedTrashLeads);
                      }
                    }}
                    disabled={selectedTrashLeads.length === 0 || permanentDeleting}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Delete Selected Forever
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (window.confirm(`Permanently delete ALL ${trashTotal} leads in trash? This cannot be undone.`)) {
                        permanentDeleteLeads(null, true);
                      }
                    }}
                    disabled={permanentDeleting}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Empty Trash
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Trash Leads Table */}
          <Card>
            <CardHeader>
              <CardTitle>Deleted Leads</CardTitle>
              <CardDescription>
                {trashTotal > 0 
                  ? `Showing ${trashLeads.length} of ${trashTotal} deleted leads`
                  : 'No leads in trash'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {trashTotal === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Trash2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Trash is empty</p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Enquiry No</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>State</TableHead>
                        <TableHead>Dealer</TableHead>
                        <TableHead>Deleted By</TableHead>
                        <TableHead>Deleted At</TableHead>
                        <TableHead>Auto Purge</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trashLeads.map((lead) => (
                        <TableRow key={lead.lead_id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedTrashLeads.includes(lead.lead_id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedTrashLeads([...selectedTrashLeads, lead.lead_id]);
                                } else {
                                  setSelectedTrashLeads(selectedTrashLeads.filter(id => id !== lead.lead_id));
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-xs">{lead.enquiry_no}</TableCell>
                          <TableCell>{lead.name || '-'}</TableCell>
                          <TableCell>{lead.enquiry_date}</TableCell>
                          <TableCell>{lead.state}</TableCell>
                          <TableCell>{lead.dealer}</TableCell>
                          <TableCell>{lead.deleted_by_name || '-'}</TableCell>
                          <TableCell className="text-xs">
                            {lead.deleted_at ? new Date(lead.deleted_at).toLocaleString() : '-'}
                          </TableCell>
                          <TableCell className="text-xs">
                            {lead.auto_purge_at ? (
                              <Badge variant={new Date(lead.auto_purge_at) < new Date(Date.now() + 3*24*60*60*1000) ? 'destructive' : 'secondary'}>
                                {new Date(lead.auto_purge_at).toLocaleDateString()}
                              </Badge>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => recoverLeads([lead.lead_id])}
                                disabled={recoveringLeads}
                              >
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (window.confirm('Permanently delete this lead? This cannot be undone.')) {
                                    permanentDeleteLeads([lead.lead_id]);
                                  }
                                }}
                                disabled={permanentDeleting}
                              >
                                <X className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {trashTotalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setTrashPage(p => Math.max(1, p - 1))}
                        disabled={trashPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm">
                        Page {trashPage} of {trashTotalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setTrashPage(p => Math.min(trashTotalPages, p + 1))}
                        disabled={trashPage === trashTotalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Recent Deletion History */}
          {trashStats?.recent_deletions?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Deletion History</CardTitle>
                <CardDescription>Last 10 bulk delete operations</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Deleted Count</TableHead>
                      <TableHead>Filters</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trashStats.recent_deletions.map((deletion, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{deletion.user_name}</TableCell>
                        <TableCell>
                          <Badge variant="destructive">{deletion.details?.deleted_count || 0}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {deletion.details?.filters && Object.entries(deletion.details.filters).map(([k, v]) => (
                              <Badge key={k} variant="outline" className="text-xs">{k}: {v}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{new Date(deletion.created_at).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Activity Logs Tab */}
        <TabsContent value="logs">
          <ActivityLogs />
        </TabsContent>
      </Tabs>

      {/* Password Change Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={(open) => {
        setIsPasswordDialogOpen(open);
        if (!open) {
          setPasswordChangeUser(null);
          setNewPassword('');
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Change Password
            </DialogTitle>
            <DialogDescription>
              Change password for {passwordChangeUser?.name || passwordChangeUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 6 characters)"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsPasswordDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleChangePassword} disabled={changingPassword || newPassword.length < 6}>
              {changingPassword ? 'Changing...' : 'Change Password'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
