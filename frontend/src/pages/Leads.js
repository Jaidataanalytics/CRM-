import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useFilters } from '@/context/FilterContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Plus, Upload, Edit, Trash2, ChevronLeft, ChevronRight, ShieldCheck, ShieldX, Search, X, Eye, Clock, AlertTriangle } from 'lucide-react';
import { DataGrid } from '@/components/ui/data-grid';
import { LeadTimeline } from '@/components/leads/LeadTimeline';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const initialFormData = {
  name: '',
  phone_number: '',
  email_address: '',
  state: '',
  dealer: '',
  employee_name: '',
  enquiry_no: '',
  enquiry_date: '',
  customer_type: 'New Customer',
  kva: '',
  segment: '',
  enquiry_status: 'Open',
  enquiry_type: 'Warm',
  enquiry_stage: 'Prospecting',
  remarks: ''
};

const Leads = () => {
  const { buildQueryParams } = useFilters();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [formData, setFormData] = useState(initialFormData);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  
  // Qualification state
  const [isQualifyDialogOpen, setIsQualifyDialogOpen] = useState(false);
  const [qualifyingLead, setQualifyingLead] = useState(null);
  const [qualificationQuestions, setQualificationQuestions] = useState([]);
  const [qualificationAnswers, setQualificationAnswers] = useState({});
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchField, setSearchField] = useState('name');
  
  // Lead detail panel
  const [selectedLead, setSelectedLead] = useState(null);
  const [showLeadDetail, setShowLeadDetail] = useState(false);
  
  // View mode - 'table' or 'grid'
  const [viewMode, setViewMode] = useState('grid');

  useEffect(() => {
    loadLeads();
  }, [page, buildQueryParams, searchQuery, searchField]);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const queryParams = buildQueryParams();
      let url = `${API}/leads?${queryParams}&page=${page}&limit=20`;
      
      // Add search params
      if (searchQuery.trim()) {
        url += `&search=${encodeURIComponent(searchQuery.trim())}&search_field=${searchField}`;
      }
      
      const res = await axios.get(url, { withCredentials: true });
      setLeads(res.data.leads || []);
      setTotalPages(res.data.pages || 1);
    } catch (error) {
      console.error('Error loading leads:', error);
      toast.error('Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadLeads();
  };

  const clearSearch = () => {
    setSearchQuery('');
    setPage(1);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = { ...formData };
      if (data.kva) data.kva = parseFloat(data.kva);
      
      if (editingLead) {
        await axios.put(`${API}/leads/${editingLead.lead_id}`, data, {
          withCredentials: true
        });
        toast.success('Lead updated successfully');
      } else {
        await axios.post(`${API}/leads`, data, {
          withCredentials: true
        });
        toast.success('Lead created successfully');
      }
      
      setIsDialogOpen(false);
      setEditingLead(null);
      setFormData(initialFormData);
      loadLeads();
    } catch (error) {
      console.error('Error saving lead:', error);
      toast.error('Failed to save lead');
    }
  };

  const handleEdit = (lead) => {
    setEditingLead(lead);
    setFormData({
      name: lead.name || '',
      phone_number: lead.phone_number || '',
      email_address: lead.email_address || '',
      state: lead.state || '',
      dealer: lead.dealer || '',
      employee_name: lead.employee_name || '',
      enquiry_no: lead.enquiry_no || '',
      enquiry_date: lead.enquiry_date || '',
      customer_type: lead.customer_type || 'New Customer',
      kva: lead.kva?.toString() || '',
      segment: lead.segment || '',
      enquiry_status: lead.enquiry_status || 'Open',
      enquiry_type: lead.enquiry_type || 'Warm',
      enquiry_stage: lead.enquiry_stage || 'Prospecting',
      remarks: lead.remarks || ''
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (leadId) => {
    if (!window.confirm('Are you sure you want to delete this lead?')) return;
    
    try {
      await axios.delete(`${API}/leads/${leadId}`, {
        withCredentials: true
      });
      toast.success('Lead deleted successfully');
      loadLeads();
    } catch (error) {
      console.error('Error deleting lead:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete lead');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await axios.post(`${API}/upload/leads`, formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success(`Upload complete: ${res.data.created} created, ${res.data.updated} updated`);
      if (res.data.total_errors > 0) {
        toast.warning(`${res.data.total_errors} rows had errors`);
      }
      loadLeads();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload file');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Qualification functions
  const openQualifyDialog = async (lead) => {
    setQualifyingLead(lead);
    try {
      const res = await axios.get(`${API}/qualification/questions`, { withCredentials: true });
      setQualificationQuestions(res.data.questions || []);
      
      // Pre-fill existing answers
      const existingAnswers = {};
      (lead.qualification_answers || []).forEach(a => {
        existingAnswers[a.question_id] = a.option_id;
      });
      setQualificationAnswers(existingAnswers);
      setIsQualifyDialogOpen(true);
    } catch (error) {
      toast.error('Failed to load qualification questions');
    }
  };

  const handleQualificationSubmit = async () => {
    const answers = Object.entries(qualificationAnswers).map(([question_id, option_id]) => ({
      question_id,
      option_id
    }));
    
    try {
      const res = await axios.post(`${API}/qualification/leads/${qualifyingLead.lead_id}/qualify`, 
        { answers },
        { withCredentials: true }
      );
      
      toast.success(`Lead ${res.data.is_qualified ? 'Qualified' : 'marked as Faulty'} (Score: ${res.data.total_score}/${res.data.threshold})`);
      setIsQualifyDialogOpen(false);
      setQualifyingLead(null);
      setQualificationAnswers({});
      loadLeads();
    } catch (error) {
      toast.error('Failed to submit qualification');
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      'Closed-Won': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'Closed-Lost': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      'Prospecting': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'Open': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    };
    return <Badge className={variants[status] || 'bg-gray-100 text-gray-800'}>{status || 'N/A'}</Badge>;
  };

  const handleViewLead = (lead) => {
    setSelectedLead(lead);
    setShowLeadDetail(true);
  };

  // Check if follow-up is overdue
  const isFollowupOverdue = (date) => {
    if (!date) return false;
    const today = new Date().toISOString().split('T')[0];
    return date < today;
  };

  const isFollowupToday = (date) => {
    if (!date) return false;
    const today = new Date().toISOString().split('T')[0];
    return date === today;
  };

  // DataGrid columns configuration
  const gridColumns = [
    { key: 'enquiry_no', label: 'Enquiry No', sortable: true },
    { key: 'name', label: 'Name', sortable: true, render: (val, row) => val || row.corporate_name || '-' },
    { key: 'state', label: 'State', sortable: true },
    { key: 'dealer', label: 'Dealer', sortable: true },
    { key: 'segment', label: 'Segment', sortable: true },
    { 
      key: 'planned_followup_date', 
      label: 'Follow-up', 
      sortable: true,
      render: (val, row) => {
        if (!val) return '-';
        const overdue = isFollowupOverdue(val);
        const today = isFollowupToday(val);
        return (
          <div className="flex items-center gap-1">
            {overdue && <AlertTriangle className="h-4 w-4 text-red-500" />}
            {today && <Clock className="h-4 w-4 text-amber-500" />}
            <span className={overdue ? 'text-red-600 font-medium' : today ? 'text-amber-600' : ''}>
              {val}
            </span>
          </div>
        );
      }
    },
    { 
      key: 'is_qualified', 
      label: 'Qualified', 
      sortable: true,
      render: (val) => {
        if (val === true) return <Badge className="bg-green-100 text-green-800 gap-1"><ShieldCheck className="h-3 w-3" /> Yes</Badge>;
        if (val === false) return <Badge className="bg-red-100 text-red-800 gap-1"><ShieldX className="h-3 w-3" /> No</Badge>;
        return <Badge variant="outline">-</Badge>;
      }
    },
    { 
      key: 'enquiry_stage', 
      label: 'Stage', 
      sortable: true,
      render: (val) => getStatusBadge(val)
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      filterable: false,
      render: (_, row) => (
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" onClick={() => handleViewLead(row)} title="View Details">
            <Eye className="h-4 w-4 text-blue-600" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => openQualifyDialog(row)} title="Qualify Lead">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleEdit(row)} title="Edit Lead">
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleDelete(row.lead_id)} title="Delete Lead">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Manage Leads</h1>
          <p className="text-muted-foreground mt-1">Create, update, and manage your leads</p>
        </div>
        <div className="flex gap-2">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <Select value={searchField} onValueChange={setSearchField}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="phone_number">Phone</SelectItem>
                <SelectItem value="email_address">Email</SelectItem>
                <SelectItem value="enquiry_no">Enquiry No</SelectItem>
                <SelectItem value="dealer">Dealer</SelectItem>
                <SelectItem value="state">State</SelectItem>
                <SelectItem value="employee_name">Employee</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Search by ${searchField}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-48"
              />
              {searchQuery && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                  onClick={clearSearch}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <Button type="submit" variant="secondary" size="sm">
              Search
            </Button>
          </form>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            {uploading ? 'Uploading...' : 'Upload Excel'}
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditingLead(null);
              setFormData(initialFormData);
            }
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Lead
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingLead ? 'Edit Lead' : 'Add New Lead'}</DialogTitle>
                <DialogDescription>
                  {editingLead ? 'Update lead information' : 'Enter the details for the new lead'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Customer Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      value={formData.phone_number}
                      onChange={(e) => handleInputChange('phone_number', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email_address}
                      onChange={(e) => handleInputChange('email_address', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={formData.state}
                      onChange={(e) => handleInputChange('state', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dealer">Dealer</Label>
                    <Input
                      id="dealer"
                      value={formData.dealer}
                      onChange={(e) => handleInputChange('dealer', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employee">Employee Name</Label>
                    <Input
                      id="employee"
                      value={formData.employee_name}
                      onChange={(e) => handleInputChange('employee_name', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="kva">KVA</Label>
                    <Input
                      id="kva"
                      type="number"
                      value={formData.kva}
                      onChange={(e) => handleInputChange('kva', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="segment">Segment</Label>
                    <Input
                      id="segment"
                      value={formData.segment}
                      onChange={(e) => handleInputChange('segment', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={formData.enquiry_status} onValueChange={(v) => handleInputChange('enquiry_status', v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Open">Open</SelectItem>
                        <SelectItem value="Closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Stage</Label>
                    <Select value={formData.enquiry_stage} onValueChange={(v) => handleInputChange('enquiry_stage', v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Prospecting">Prospecting</SelectItem>
                        <SelectItem value="Qualified">Qualified</SelectItem>
                        <SelectItem value="Proposal">Proposal</SelectItem>
                        <SelectItem value="Negotiation">Negotiation</SelectItem>
                        <SelectItem value="Closed-Won">Closed-Won</SelectItem>
                        <SelectItem value="Closed-Lost">Closed-Lost</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={formData.enquiry_type} onValueChange={(v) => handleInputChange('enquiry_type', v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Hot">Hot</SelectItem>
                        <SelectItem value="Warm">Warm</SelectItem>
                        <SelectItem value="Cold">Cold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="remarks">Remarks</Label>
                  <Textarea
                    id="remarks"
                    value={formData.remarks}
                    onChange={(e) => handleInputChange('remarks', e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingLead ? 'Update' : 'Create'} Lead
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6">
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <>
              <DataGrid
                data={leads}
                columns={gridColumns}
                onRowClick={handleViewLead}
                selectable={false}
                pageSize={20}
                emptyMessage="No leads found. Try adjusting your filters or add a new lead."
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Qualification Dialog */}
      <Dialog open={isQualifyDialogOpen} onOpenChange={(open) => {
        setIsQualifyDialogOpen(open);
        if (!open) {
          setQualifyingLead(null);
          setQualificationAnswers({});
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              Qualify Lead
            </DialogTitle>
            <DialogDescription>
              Answer the qualification questions for: <strong>{qualifyingLead?.name || qualifyingLead?.enquiry_no}</strong>
            </DialogDescription>
          </DialogHeader>
          
          {qualificationQuestions.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <p>No qualification questions defined.</p>
              <p className="text-sm mt-2">Please add questions in Admin Panel → Qualification Questions</p>
            </div>
          ) : (
            <div className="space-y-4 pt-4">
              {qualificationQuestions.map((q, idx) => (
                <div key={q.question_id} className="space-y-2">
                  <Label className="flex items-center justify-between">
                    <span>{idx + 1}. {q.question}</span>
                    {q.is_required && <Badge variant="outline" className="text-xs">Required</Badge>}
                  </Label>
                  {q.description && <p className="text-xs text-muted-foreground">{q.description}</p>}
                  <Select 
                    value={qualificationAnswers[q.question_id] || ''} 
                    onValueChange={(v) => setQualificationAnswers(prev => ({ ...prev, [q.question_id]: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an answer" />
                    </SelectTrigger>
                    <SelectContent>
                      {q.options?.map(opt => (
                        <SelectItem key={opt.option_id} value={opt.option_id}>
                          {opt.text} (+{opt.score} pts)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsQualifyDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleQualificationSubmit} className="gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Submit Qualification
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Lead Detail Sheet */}
      <Sheet open={showLeadDetail} onOpenChange={setShowLeadDetail}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Lead Details
            </SheetTitle>
            <SheetDescription>
              {selectedLead?.name || selectedLead?.enquiry_no}
            </SheetDescription>
          </SheetHeader>
          
          {selectedLead && (
            <div className="mt-6 space-y-6">
              {/* Follow-up Alert */}
              {selectedLead.planned_followup_date && isFollowupOverdue(selectedLead.planned_followup_date) && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-950/20 dark:border-red-800">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="font-semibold">⚠️ FOLLOW-UP OVERDUE</span>
                  </div>
                  <p className="text-sm text-red-600 mt-1 dark:text-red-300">
                    Follow-up was scheduled for {selectedLead.planned_followup_date}
                  </p>
                </div>
              )}
              
              {selectedLead.planned_followup_date && isFollowupToday(selectedLead.planned_followup_date) && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg dark:bg-amber-950/20 dark:border-amber-800">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <Clock className="h-5 w-5" />
                    <span className="font-semibold">📅 FOLLOW-UP TODAY</span>
                  </div>
                  <p className="text-sm text-amber-600 mt-1 dark:text-amber-300">
                    Don't forget to follow up with this lead today!
                  </p>
                </div>
              )}

              {/* Lead Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Name</Label>
                  <p className="font-medium">{selectedLead.name || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Enquiry No</Label>
                  <p className="font-mono">{selectedLead.enquiry_no || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Phone</Label>
                  <p>{selectedLead.phone_number || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <p>{selectedLead.email_address || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">State</Label>
                  <p>{selectedLead.state || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Dealer</Label>
                  <p>{selectedLead.dealer || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Segment</Label>
                  <p>{selectedLead.segment || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Employee</Label>
                  <p>{selectedLead.employee_name || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Stage</Label>
                  <p>{getStatusBadge(selectedLead.enquiry_stage)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">KVA</Label>
                  <p>{selectedLead.kva || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Enquiry Date</Label>
                  <p>{selectedLead.enquiry_date || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Follow-up Date</Label>
                  <p className={isFollowupOverdue(selectedLead.planned_followup_date) ? 'text-red-600 font-medium' : ''}>
                    {selectedLead.planned_followup_date || '-'}
                  </p>
                </div>
              </div>

              {selectedLead.remarks && (
                <div>
                  <Label className="text-xs text-muted-foreground">Remarks</Label>
                  <p className="text-sm mt-1 p-3 bg-muted rounded-lg">{selectedLead.remarks}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button onClick={() => { handleEdit(selectedLead); setShowLeadDetail(false); }} className="flex-1">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Lead
                </Button>
                <Button variant="outline" onClick={() => { openQualifyDialog(selectedLead); setShowLeadDetail(false); }}>
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Qualify
                </Button>
              </div>

              {/* Activity Timeline */}
              <LeadTimeline leadId={selectedLead.lead_id} />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Leads;
