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
import { Users, Activity, Settings, Shield, UserX, UserCheck, ChevronLeft, ChevronRight, Plus, Trash2, ShieldCheck, Save, Upload, Database, Calendar, FileSpreadsheet, AlertTriangle, BarChart3, RefreshCw, Check, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Admin = () => {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [closureQuestions, setClosureQuestions] = useState([]);
  const [qualificationQuestions, setQualificationQuestions] = useState([]);
  const [qualificationSettings, setQualificationSettings] = useState({ threshold_score: 0 });
  const [loading, setLoading] = useState(true);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotalPages, setLogsTotalPages] = useState(1);
  
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
  
  // Data Management state
  const [dataStats, setDataStats] = useState(null);
  const [uploadingHistorical, setUploadingHistorical] = useState(false);
  const [historicalUploadResult, setHistoricalUploadResult] = useState(null);
  const [uploadProgress, setUploadProgress] = useState({ progress: 0, message: '', status: '' });
  
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

  // Add User state
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    role: 'Employee'
  });
  const [creatingUser, setCreatingUser] = useState(false);

  useEffect(() => {
    loadData();
    loadDataStats();
    loadMetricSettings();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [logsPage]);

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

  const loadDataStats = async () => {
    try {
      const res = await axios.get(`${API}/admin/data-stats`, { withCredentials: true });
      setDataStats(res.data);
    } catch (error) {
      console.error('Error loading data stats:', error);
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
          <TabsTrigger value="qualification">Qualification Questions</TabsTrigger>
          <TabsTrigger value="closure">Closure Questions</TabsTrigger>
          <TabsTrigger value="data">Data Management</TabsTrigger>
          <TabsTrigger value="logs">Activity Logs</TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Users</CardTitle>
                <CardDescription>Manage user roles and access</CardDescription>
              </div>
              <Button onClick={() => setShowAddUser(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </CardHeader>
            <CardContent>
              {/* Add User Form */}
              {showAddUser && (
                <Card className="mb-6 border-primary">
                  <CardHeader>
                    <CardTitle className="text-lg">Add New User</CardTitle>
                    <CardDescription>Create a new user account</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Full Name *</Label>
                        <Input
                          placeholder="John Doe"
                          value={newUser.name}
                          onChange={(e) => setNewUser(prev => ({ ...prev, name: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email *</Label>
                        <Input
                          type="email"
                          placeholder="john@example.com"
                          value={newUser.email}
                          onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Username</Label>
                        <Input
                          placeholder="johndoe"
                          value={newUser.username}
                          onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Password *</Label>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          value={newUser.password}
                          onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Role</Label>
                        <Select value={newUser.role} onValueChange={(v) => setNewUser(prev => ({ ...prev, role: v }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Admin">Admin</SelectItem>
                            <SelectItem value="Manager">Manager</SelectItem>
                            <SelectItem value="Employee">Employee</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setShowAddUser(false)}>Cancel</Button>
                      <Button onClick={createUser} disabled={creatingUser}>
                        {creatingUser ? 'Creating...' : 'Create User'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.user_id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.picture} />
                            <AvatarFallback>{user.name?.charAt(0) || 'U'}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{user.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Select value={user.role} onValueChange={(v) => updateUserRole(user.user_id, v)}>
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Admin">Admin</SelectItem>
                            <SelectItem value="Manager">Manager</SelectItem>
                            <SelectItem value="Employee">Employee</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.is_active ? 'default' : 'secondary'}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleUserStatus(user.user_id, user.is_active)}
                            title={user.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {user.is_active ? <UserX className="h-4 w-4 text-destructive" /> : <UserCheck className="h-4 w-4 text-green-500" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteUser(user.user_id, user.name)}
                            title="Delete User"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
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
                Create Custom Metric
              </Button>
              <Button variant="outline" size="sm" onClick={resetMetricSettings}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset to Defaults
              </Button>
            </div>
          </div>

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
                    
                    {/* For calculated metrics: show info */}
                    {metric.metric_type === 'calculated' && (
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs text-muted-foreground">
                          This metric is automatically calculated by the system based on lead dates and cannot be customized.
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
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Warning: Destructive Operation</AlertTitle>
            <AlertDescription>
              Uploading historical data will <strong>delete all existing leads</strong> with dates up to the maximum date in your uploaded file, then insert the new data. This action cannot be undone.
            </AlertDescription>
          </Alert>

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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        </TabsContent>

        {/* Activity Logs Tab */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>Activity Logs</CardTitle>
              <CardDescription>Recent user activities</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{log.user_name}</p>
                          <p className="text-xs text-muted-foreground">{log.user_email}</p>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{log.action}</Badge></TableCell>
                      <TableCell>
                        <span className="text-sm">{log.resource_type}</span>
                        {log.resource_id && (
                          <span className="text-xs text-muted-foreground block font-mono">{log.resource_id}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(log.created_at)}</TableCell>
                    </TableRow>
                  ))}
                  {logs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No activity logs found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">Page {logsPage} of {logsTotalPages}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setLogsPage(p => Math.max(1, p - 1))} disabled={logsPage === 1}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setLogsPage(p => Math.min(logsTotalPages, p + 1))} disabled={logsPage === logsTotalPages}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Admin;
