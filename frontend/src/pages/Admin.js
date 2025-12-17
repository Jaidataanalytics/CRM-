import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Users, Activity, Settings, Shield, UserX, UserCheck, ChevronLeft, ChevronRight, Plus, Trash2, ShieldCheck, Save, Upload, Database, Calendar, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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

  useEffect(() => {
    loadData();
    loadDataStats();
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
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await axios.post(`${API}/admin/upload-historical-data`, formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setHistoricalUploadResult(res.data);
      toast.success(res.data.message || 'Historical data uploaded successfully');
      loadDataStats();
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload historical data');
      setHistoricalUploadResult({ success: false, error: error.response?.data?.detail });
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
        <TabsList>
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="qualification">Qualification Questions</TabsTrigger>
          <TabsTrigger value="closure">Closure Questions</TabsTrigger>
          <TabsTrigger value="data">Data Management</TabsTrigger>
          <TabsTrigger value="logs">Activity Logs</TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>Users</CardTitle>
              <CardDescription>Manage user roles and access</CardDescription>
            </CardHeader>
            <CardContent>
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
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleUserStatus(user.user_id, user.is_active)}
                        >
                          {user.is_active ? <UserX className="h-4 w-4 text-destructive" /> : <UserCheck className="h-4 w-4 text-green-500" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
