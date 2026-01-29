import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { toast } from 'sonner';
import { 
  FileText, Upload, Plus, Search, Filter, Calendar, Building2, 
  IndianRupee, Clock, CheckCircle, XCircle, AlertCircle, 
  TrendingUp, TrendingDown, Users, Eye, Edit, Trash2, Download,
  ChevronLeft, ChevronRight, BarChart3, PieChart, RefreshCw,
  FileUp, ExternalLink, Award, Target, Loader2
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, BarChart, Bar, PieChart as RechartsPie, Pie, Cell
} from 'recharts';
import { ExportButton } from '@/components/ui/export-button';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  participated: 'bg-blue-100 text-blue-800',
  won: 'bg-green-100 text-green-800',
  lost: 'bg-red-100 text-red-800',
  not_participated: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-gray-100 text-gray-800'
};

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'participated', label: 'Participated' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
  { value: 'not_participated', label: 'Not Participated' },
  { value: 'cancelled', label: 'Cancelled' }
];

const DOCUMENT_TYPES = [
  { value: 'bid_doc', label: 'Bid Document' },
  { value: 'technical_spec', label: 'Technical Specifications' },
  { value: 'boq', label: 'BOQ' },
  { value: 'our_quotation', label: 'Our Quotation' },
  { value: 'result_letter', label: 'Result Letter' },
  { value: 'other', label: 'Other' }
];

const CHART_COLORS = ['#22c55e', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4'];

// Tender types
const TENDER_TYPES = [
  { value: 'mlt', label: 'MLT Tenders' },
  { value: 'dg', label: 'DG Tenders' }
];

const Tenders = () => {
  // Tender type toggle
  const [tenderType, setTenderType] = useState('mlt');
  
  const [activeTab, setActiveTab] = useState('list');
  const [tenders, setTenders] = useState([]);
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [competitors, setCompetitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Modal states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [selectedTender, setSelectedTender] = useState(null);
  const [editMode, setEditMode] = useState(false);
  
  // Upload flow states - Step 1: Extract, Step 2: Confirm
  const [uploadStep, setUploadStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfFile, setPdfFile] = useState(null);
  
  // Competitor master list
  const [competitorMaster, setCompetitorMaster] = useState([]);
  const [showCompetitorModal, setShowCompetitorModal] = useState(false);
  const [editingCompetitor, setEditingCompetitor] = useState(null);
  const [competitorForm, setCompetitorForm] = useState({
    name: '', contact_person: '', phone: '', email: '', address: '', notes: ''
  });
  
  // Document management
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [documentForm, setDocumentForm] = useState({ name: '', type: 'other', url: '' });
  
  // Form state for new/edit tender (MLT fields)
  const [formData, setFormData] = useState({
    tender_type: 'mlt',
    bid_number: '',
    dated: '',
    bid_end_date: '',
    bid_opening_date: '',
    department_name: '',
    total_quantity: 0,
    estimated_value: 0,
    beneficiary: '',
    consignees: [],
    emd_amount: 0,
    item_specifications: '',
    product_category: '',
    delivery_period: 0,
    warranty_period: '',
    payment_terms: '',
    status: 'pending',
    our_bid_amount: 0,
    assigned_employee: '',
    notes: '',
    winner_name: '',
    winner_amount: 0,
    result_date: '',
    loss_reason: '',
    competitors: [],
    consignees: [],
    // DG-specific fields
    address: '',
    state_name: '',
    output_capacity_rating: '',
    control_panel: '',
    installation: '',  // 'yes' or 'no'
    is_eligible: true,
    eligibility_reason: '',
    l1_price: 0,
    mm_price: 0,
    winning_brand: '',
    participation_by_mm: '',
    win_by: '',
    remark: ''
  });

  // Reset form based on tender type
  const resetForm = (type = tenderType) => {
    setFormData({
      tender_type: type,
      bid_number: '',
      dated: '',
      bid_end_date: '',
      bid_opening_date: '',
      department_name: '',
      total_quantity: 0,
      estimated_value: 0,
      beneficiary: '',
      consignees: [],
      emd_amount: 0,
      item_specifications: '',
      product_category: '',
      delivery_period: 0,
      warranty_period: '',
      payment_terms: '',
      status: 'pending',
      our_bid_amount: 0,
      assigned_employee: '',
      notes: '',
      winner_name: '',
      winner_amount: 0,
      result_date: '',
      loss_reason: '',
      competitors: [],
      // DG-specific fields
      address: '',
      state_name: '',
      output_capacity_rating: '',
      control_panel: '',
      installation: '',
      is_eligible: true,
      eligibility_reason: '',
      l1_price: 0,
      mm_price: 0,
      winning_brand: '',
      participation_by_mm: '',
      win_by: '',
      remark: ''
    });
    setExtractedData(null);
    setUploadStep(1);
    setPdfUrl('');
    setPdfFile(null);
  };

  const loadTenders = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', 20);
      params.append('tender_type', tenderType);
      if (search) params.append('search', search);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      
      const res = await axios.get(`${API}/tenders?${params}`, { withCredentials: true });
      setTenders(res.data.tenders || []);
      setTotalPages(res.data.pages || 1);
    } catch (error) {
      console.error('Error loading tenders:', error);
      toast.error('Failed to load tenders');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, tenderType]);

  const loadStats = async () => {
    try {
      const res = await axios.get(`${API}/tenders/stats?tender_type=${tenderType}`, { withCredentials: true });
      setStats(res.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadAnalytics = async () => {
    try {
      const res = await axios.get(`${API}/tenders/analytics`, { withCredentials: true });
      setAnalytics(res.data);
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  };

  const loadCompetitors = async () => {
    try {
      const res = await axios.get(`${API}/tenders/competitors`, { withCredentials: true });
      setCompetitors(res.data.competitors || []);
    } catch (error) {
      console.error('Error loading competitors:', error);
    }
  };

  useEffect(() => {
    loadTenders();
    loadStats();
  }, [loadTenders]);

  // Reload when tender type changes
  useEffect(() => {
    setPage(1);
    setSearch('');
    setStatusFilter('all');
    loadTenders();
    loadStats();
  }, [tenderType]);

  useEffect(() => {
    if (activeTab === 'analytics') {
      loadAnalytics();
    } else if (activeTab === 'competitors') {
      loadCompetitors();
    } else if (activeTab === 'competitor-master') {
      loadCompetitorMaster();
    }
  }, [activeTab]);

  // Load competitor master list
  const loadCompetitorMaster = async () => {
    try {
      const res = await axios.get(`${API}/tenders/competitor-master`, { withCredentials: true });
      setCompetitorMaster(res.data.competitors || []);
    } catch (error) {
      console.error('Error loading competitor master:', error);
    }
  };

  // Handle PDF file upload
  // Handle PDF file upload - extract and move to step 2
  const handleUploadPdf = async () => {
    if (!pdfFile) {
      toast.error('Please select a PDF file');
      return;
    }
    
    setUploading(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', pdfFile);
      formDataUpload.append('tender_type', tenderType);
      
      const res = await axios.post(`${API}/tenders/upload-pdf`, formDataUpload, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (res.data.success) {
        setExtractedData(res.data.data);
        setFormData(prev => ({ ...prev, tender_type: tenderType, ...res.data.data }));
        toast.success(`Data extracted from ${res.data.filename} - Please review and confirm`);
        setUploadStep(2);  // Move to confirmation step
        setPdfFile(null);
      } else {
        toast.error(res.data.error || 'Failed to extract data');
      }
    } catch (error) {
      console.error('Error uploading PDF:', error);
      toast.error('Failed to upload and extract PDF');
    } finally {
      setUploading(false);
    }
  };

  // Handle PDF URL extraction - extract and move to step 2
  const handleExtractPdf = async () => {
    if (!pdfUrl) {
      toast.error('Please enter a PDF URL');
      return;
    }
    
    setUploading(true);
    try {
      const res = await axios.post(`${API}/tenders/extract-pdf`, 
        { pdf_url: pdfUrl, tender_type: tenderType },
        { withCredentials: true }
      );
      
      if (res.data.success) {
        setExtractedData(res.data.data);
        setFormData(prev => ({ ...prev, tender_type: tenderType, ...res.data.data }));
        toast.success('Data extracted - Please review and confirm');
        setUploadStep(2);  // Move to confirmation step
      } else {
        toast.error(res.data.error || 'Failed to extract data');
      }
    } catch (error) {
      console.error('Error extracting PDF:', error);
      toast.error('Failed to extract PDF data');
    } finally {
      setUploading(false);
    }
  };

  const handleCreateTender = async () => {
    try {
      const res = await axios.post(`${API}/tenders`, { ...formData, tender_type: tenderType }, { withCredentials: true });
      toast.success('Tender created successfully');
      setShowUploadModal(false);
      setExtractedData(null);
      setPdfUrl('');
      setUploadStep(1);
      resetForm();
      loadTenders();
      loadStats();
    } catch (error) {
      console.error('Error creating tender:', error);
      toast.error('Failed to create tender');
    }
  };

  const handleUpdateTender = async () => {
    if (!selectedTender) return;
    
    try {
      await axios.put(`${API}/tenders/${selectedTender._id}`, formData, { withCredentials: true });
      toast.success('Tender updated successfully');
      setEditMode(false);
      loadTenders();
      loadStats();
      // Refresh selected tender
      const res = await axios.get(`${API}/tenders/${selectedTender._id}`, { withCredentials: true });
      setSelectedTender(res.data);
    } catch (error) {
      console.error('Error updating tender:', error);
      toast.error('Failed to update tender');
    }
  };

  const handleDeleteTender = async (tenderId) => {
    if (!window.confirm('Are you sure you want to delete this tender?')) return;
    
    try {
      await axios.delete(`${API}/tenders/${tenderId}`, { withCredentials: true });
      toast.success('Tender deleted successfully');
      setShowDetailSheet(false);
      loadTenders();
      loadStats();
    } catch (error) {
      console.error('Error deleting tender:', error);
      toast.error('Failed to delete tender');
    }
  };

  const openTenderDetail = async (tender) => {
    try {
      const res = await axios.get(`${API}/tenders/${tender._id}`, { withCredentials: true });
      setSelectedTender(res.data);
      setFormData(res.data);
      setShowDetailSheet(true);
      setEditMode(false);
    } catch (error) {
      console.error('Error loading tender:', error);
      toast.error('Failed to load tender details');
    }
  };

  const formatCurrency = (value) => {
    if (!value) return '₹0';
    return `₹${Number(value).toLocaleString('en-IN')}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN');
    } catch {
      return dateStr;
    }
  };

  // Add competitor to form
  const addCompetitor = () => {
    setFormData(prev => ({
      ...prev,
      competitors: [...prev.competitors, { name: '', bid_amount: 0, rank: prev.competitors.length + 1 }]
    }));
  };

  const updateCompetitor = (index, field, value) => {
    setFormData(prev => {
      const updated = [...prev.competitors];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, competitors: updated };
    });
  };

  const removeCompetitor = (index) => {
    setFormData(prev => ({
      ...prev,
      competitors: prev.competitors.filter((_, i) => i !== index)
    }));
  };

  // Competitor Master CRUD
  const handleSaveCompetitorMaster = async () => {
    if (!competitorForm.name) {
      toast.error('Company name is required');
      return;
    }
    
    try {
      if (editingCompetitor) {
        await axios.put(`${API}/tenders/competitor-master/${editingCompetitor._id}`, competitorForm, { withCredentials: true });
        toast.success('Competitor updated');
      } else {
        await axios.post(`${API}/tenders/competitor-master`, competitorForm, { withCredentials: true });
        toast.success('Competitor added');
      }
      setShowCompetitorModal(false);
      loadCompetitorMaster();
    } catch (error) {
      console.error('Error saving competitor:', error);
      toast.error(error.response?.data?.detail || 'Failed to save competitor');
    }
  };

  const handleDeleteCompetitorMaster = async (id) => {
    if (!window.confirm('Are you sure you want to deactivate this competitor?')) return;
    
    try {
      await axios.delete(`${API}/tenders/competitor-master/${id}`, { withCredentials: true });
      toast.success('Competitor deactivated');
      loadCompetitorMaster();
    } catch (error) {
      console.error('Error deleting competitor:', error);
      toast.error('Failed to deactivate competitor');
    }
  };

  // Document management handlers
  const handleAddDocument = async () => {
    if (!documentForm.url) {
      toast.error('Document URL is required');
      return;
    }
    if (!selectedTender?._id) {
      toast.error('No tender selected');
      return;
    }
    
    try {
      const res = await axios.post(`${API}/tenders/${selectedTender._id}/documents`, documentForm, { withCredentials: true });
      toast.success('Document added');
      setShowDocumentModal(false);
      setDocumentForm({ name: '', type: 'other', url: '' });
      // Refresh the tender
      const updatedTender = await axios.get(`${API}/tenders/${selectedTender._id}`, { withCredentials: true });
      setSelectedTender(updatedTender.data);
      loadTenders();
    } catch (error) {
      console.error('Error adding document:', error);
      toast.error('Failed to add document');
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (!window.confirm('Are you sure you want to remove this document?')) return;
    
    try {
      await axios.delete(`${API}/tenders/${selectedTender._id}/documents/${docId}`, { withCredentials: true });
      toast.success('Document removed');
      // Refresh the tender
      const updatedTender = await axios.get(`${API}/tenders/${selectedTender._id}`, { withCredentials: true });
      setSelectedTender(updatedTender.data);
    } catch (error) {
      console.error('Error removing document:', error);
      toast.error('Failed to remove document');
    }
  };

  // Add consignee
  const addConsignee = () => {
    setFormData(prev => ({
      ...prev,
      consignees: [...(prev.consignees || []), { name: '', address: '', quantity: 0, delivery_days: 0 }]
    }));
  };

  const updateConsignee = (index, field, value) => {
    setFormData(prev => {
      const updated = [...(prev.consignees || [])];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, consignees: updated };
    });
  };

  const removeConsignee = (index) => {
    setFormData(prev => ({
      ...prev,
      consignees: (prev.consignees || []).filter((_, i) => i !== index)
    }));
  };

  if (loading && tenders.length === 0) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Tender Type Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-8 w-8 text-primary" />
            Tender Tracking
          </h1>
          <p className="text-muted-foreground mt-1">Track and manage government tenders</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Tender Type Toggle */}
          <div className="flex items-center bg-muted rounded-lg p-1">
            {TENDER_TYPES.map((type) => (
              <Button
                key={type.value}
                variant={tenderType === type.value ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setTenderType(type.value)}
                className={tenderType === type.value ? '' : 'text-muted-foreground'}
              >
                {type.label}
              </Button>
            ))}
          </div>
          <ExportButton
            data={tenders}
            filename={`${tenderType}-tenders`}
            sheetName={tenderType === 'dg' ? 'DG Tenders' : 'MLT Tenders'}
            columns={tenderType === 'dg' ? [
              { key: 'bid_number', header: 'Bid Number', width: 20 },
              { key: 'dated', header: 'Dated', width: 12 },
              { key: 'bid_end_date', header: 'End Date', width: 12 },
              { key: 'department_name', header: 'Department', width: 30 },
              { key: 'state_name', header: 'State', width: 15 },
              { key: 'output_capacity_rating', header: 'KVA', width: 10 },
              { key: 'total_quantity', header: 'Qty', width: 8 },
              { key: 'is_eligible', header: 'Eligible', width: 10 },
              { key: 'l1_price', header: 'L1 Price', width: 12 },
              { key: 'mm_price', header: 'MM Price', width: 12 },
              { key: 'winning_brand', header: 'Winner', width: 15 },
              { key: 'status', header: 'Status', width: 12 }
            ] : [
              { key: 'bid_number', header: 'Bid Number', width: 20 },
              { key: 'dated', header: 'Dated', width: 12 },
              { key: 'bid_end_date', header: 'End Date', width: 12 },
              { key: 'department_name', header: 'Department', width: 30 },
              { key: 'estimated_value', header: 'Est. Value', width: 15 },
              { key: 'status', header: 'Status', width: 12 },
              { key: 'our_bid_amount', header: 'Our Bid', width: 15 },
              { key: 'winner_name', header: 'Winner', width: 20 }
            ]}
            size="sm"
          >
            Export
          </ExportButton>
          <Button onClick={() => { resetForm(tenderType); setShowUploadModal(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add {tenderType === 'dg' ? 'DG' : 'MLT'} Tender
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total {tenderType.toUpperCase()} Tenders</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <FileText className="h-8 w-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Won</p>
                  <p className="text-2xl font-bold text-green-600">{stats.won}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Lost</p>
                  <p className="text-2xl font-bold text-red-600">{stats.lost}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Win Rate</p>
                  <p className="text-2xl font-bold text-primary">{stats.win_rate}%</p>
                </div>
                <Target className="h-8 w-8 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Won Value</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(stats.won_value)}</p>
                </div>
                <IndianRupee className="h-8 w-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="list">
            <FileText className="h-4 w-4 mr-2" />
            All Tenders
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="competitors">
            <Users className="h-4 w-4 mr-2" />
            Tender Competitors
          </TabsTrigger>
          <TabsTrigger value="competitor-master">
            <Award className="h-4 w-4 mr-2" />
            Competitor Master
          </TabsTrigger>
        </TabsList>

        {/* All Tenders Tab */}
        <TabsContent value="list">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Tender List</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search tenders..."
                      value={search}
                      onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                      className="pl-9 w-64"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      {STATUS_OPTIONS.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bid Number</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead className="text-right">Est. Value</TableHead>
                    <TableHead className="text-right">Our Bid</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Winner</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No tenders found. Click "Add Tender" to create one.
                      </TableCell>
                    </TableRow>
                  ) : (
                    tenders.map(tender => (
                      <TableRow key={tender._id} className="cursor-pointer hover:bg-muted/50" onClick={() => openTenderDetail(tender)}>
                        <TableCell className="font-medium">{tender.bid_number || '-'}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{tender.department_name || '-'}</TableCell>
                        <TableCell>{formatDate(tender.bid_end_date)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(tender.estimated_value)}</TableCell>
                        <TableCell className="text-right">{tender.our_bid_amount ? formatCurrency(tender.our_bid_amount) : '-'}</TableCell>
                        <TableCell>
                          <Badge className={STATUS_COLORS[tender.status] || 'bg-gray-100'}>
                            {tender.status || 'pending'}
                          </Badge>
                        </TableCell>
                        <TableCell>{tender.winner_name || '-'}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openTenderDetail(tender); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage(p => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage(p => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          {analytics ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Monthly Trend */}
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={analytics.monthly_trend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="_id" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="total" stroke="#3b82f6" name="Total" />
                      <Line type="monotone" dataKey="won" stroke="#22c55e" name="Won" />
                      <Line type="monotone" dataKey="lost" stroke="#ef4444" name="Lost" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Win Rate by Value Range */}
              <Card>
                <CardHeader>
                  <CardTitle>Win Rate by Value Range</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analytics.by_value_range}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="range" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="total" fill="#3b82f6" name="Total" />
                      <Bar dataKey="won" fill="#22c55e" name="Won" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* By Department */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Performance by Department</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Department</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Won</TableHead>
                        <TableHead className="text-right">Win Rate</TableHead>
                        <TableHead className="text-right">Total Value</TableHead>
                        <TableHead className="text-right">Won Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analytics.by_department?.map((dept, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="max-w-[300px] truncate">{dept._id || 'Unknown'}</TableCell>
                          <TableCell className="text-right">{dept.total}</TableCell>
                          <TableCell className="text-right text-green-600">{dept.won}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={dept.win_rate >= 50 ? 'default' : 'outline'}>
                              {dept.win_rate?.toFixed(1)}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(dept.total_value)}</TableCell>
                          <TableCell className="text-right text-green-600">{formatCurrency(dept.won_value)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
        </TabsContent>

        {/* Competitors Tab */}
        <TabsContent value="competitors">
          <Card>
            <CardHeader>
              <CardTitle>Competitor Analysis</CardTitle>
              <CardDescription>Historical performance of competitors across all tenders</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Competitor Name</TableHead>
                    <TableHead className="text-right">Participations</TableHead>
                    <TableHead className="text-right">Wins</TableHead>
                    <TableHead className="text-right">Win Rate</TableHead>
                    <TableHead className="text-right">Avg. Bid</TableHead>
                    <TableHead className="text-right">Total Bid Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {competitors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No competitor data available yet. Add competitor information to tenders to see analysis.
                      </TableCell>
                    </TableRow>
                  ) : (
                    competitors.map((comp, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{comp._id}</TableCell>
                        <TableCell className="text-right">{comp.participations}</TableCell>
                        <TableCell className="text-right text-green-600">{comp.wins}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={comp.win_rate >= 50 ? 'default' : 'outline'}>
                            {comp.win_rate}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(comp.avg_bid)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(comp.total_bid_value)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Competitor Master Tab */}
        <TabsContent value="competitor-master">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Competitor Master List</CardTitle>
                  <CardDescription>Manage your list of known competitors</CardDescription>
                </div>
                <Button onClick={() => { setEditingCompetitor(null); setCompetitorForm({ name: '', contact_person: '', phone: '', email: '', address: '', notes: '' }); setShowCompetitorModal(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Competitor
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact Person</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {competitorMaster.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No competitors added yet. Click "Add Competitor" to create your master list.
                      </TableCell>
                    </TableRow>
                  ) : (
                    competitorMaster.map((comp) => (
                      <TableRow key={comp._id}>
                        <TableCell className="font-medium">{comp.name}</TableCell>
                        <TableCell>{comp.contact_person || '-'}</TableCell>
                        <TableCell>{comp.phone || '-'}</TableCell>
                        <TableCell>{comp.email || '-'}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{comp.notes || '-'}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => { setEditingCompetitor(comp); setCompetitorForm(comp); setShowCompetitorModal(true); }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDeleteCompetitorMaster(comp._id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Competitor Master Modal */}
      <Dialog open={showCompetitorModal} onOpenChange={setShowCompetitorModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCompetitor ? 'Edit Competitor' : 'Add Competitor'}</DialogTitle>
            <DialogDescription>Add competitor details to your master list</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Company Name *</Label>
              <Input value={competitorForm.name} onChange={(e) => setCompetitorForm(prev => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Contact Person</Label>
                <Input value={competitorForm.contact_person} onChange={(e) => setCompetitorForm(prev => ({ ...prev, contact_person: e.target.value }))} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={competitorForm.phone} onChange={(e) => setCompetitorForm(prev => ({ ...prev, phone: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={competitorForm.email} onChange={(e) => setCompetitorForm(prev => ({ ...prev, email: e.target.value }))} />
            </div>
            <div>
              <Label>Address</Label>
              <Input value={competitorForm.address} onChange={(e) => setCompetitorForm(prev => ({ ...prev, address: e.target.value }))} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={competitorForm.notes} onChange={(e) => setCompetitorForm(prev => ({ ...prev, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompetitorModal(false)}>Cancel</Button>
            <Button onClick={handleSaveCompetitorMaster}>{editingCompetitor ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload/Create Modal - Two Step Flow */}
      <Dialog open={showUploadModal} onOpenChange={(open) => { setShowUploadModal(open); if (!open) { setUploadStep(1); setExtractedData(null); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New {tenderType === 'dg' ? 'DG' : 'MLT'} Tender</DialogTitle>
            <DialogDescription>
              {uploadStep === 1 
                ? 'Step 1: Upload a tender PDF to auto-extract data' 
                : 'Step 2: Review and confirm extracted data'}
            </DialogDescription>
          </DialogHeader>

          {/* Step 1: PDF Upload Only */}
          {uploadStep === 1 && (
            <div className="space-y-6 py-4">
              <div className="text-center py-8 border-2 border-dashed rounded-lg">
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-medium mb-2">Upload Tender PDF</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Upload a PDF or provide a URL to auto-extract tender information
                </p>
                
                <div className="flex flex-col gap-4 max-w-md mx-auto">
                  <div className="flex gap-2">
                    <Input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => setPdfFile(e.target.files[0])}
                      className="flex-1"
                    />
                    <Button onClick={handleUploadPdf} disabled={uploading || !pdfFile}>
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                      Extract
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-px bg-border"></div>
                    <span className="text-xs text-muted-foreground">OR</span>
                    <div className="flex-1 h-px bg-border"></div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter PDF URL..."
                      value={pdfUrl}
                      onChange={(e) => setPdfUrl(e.target.value)}
                      className="flex-1"
                    />
                    <Button onClick={handleExtractPdf} disabled={uploading || !pdfUrl}>
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileUp className="h-4 w-4 mr-2" />}
                      Extract
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="text-center">
                <Button variant="link" onClick={() => setUploadStep(2)}>
                  Skip - Enter data manually →
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Review/Edit Form */}
          {uploadStep === 2 && (
            <>
              {extractedData && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm text-green-800">Data extracted successfully. Please review and edit if needed.</span>
                </div>
              )}

              {/* DG Tender Form */}
              {tenderType === 'dg' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Bid Number *</Label>
                    <Input value={formData.bid_number} onChange={(e) => setFormData(prev => ({ ...prev, bid_number: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Department Name</Label>
                    <Input value={formData.department_name} onChange={(e) => setFormData(prev => ({ ...prev, department_name: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Dated</Label>
                    <Input type="date" value={formData.dated} onChange={(e) => setFormData(prev => ({ ...prev, dated: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Bid End Date/Time</Label>
                    <Input type="datetime-local" value={formData.bid_end_date?.replace(' ', 'T')} onChange={(e) => setFormData(prev => ({ ...prev, bid_end_date: e.target.value.replace('T', ' ') }))} />
                  </div>
                  <div>
                    <Label>Bid Opening Date/Time</Label>
                    <Input type="datetime-local" value={formData.bid_opening_date?.replace(' ', 'T')} onChange={(e) => setFormData(prev => ({ ...prev, bid_opening_date: e.target.value.replace('T', ' ') }))} />
                  </div>
                  <div>
                    <Label>Address</Label>
                    <Input value={formData.address} onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))} />
                  </div>
                  <div>
                    <Label>State Name</Label>
                    <Input value={formData.state_name} onChange={(e) => setFormData(prev => ({ ...prev, state_name: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Output Capacity Rating / Phase</Label>
                    <Input value={formData.output_capacity_rating} onChange={(e) => setFormData(prev => ({ ...prev, output_capacity_rating: e.target.value }))} placeholder="e.g., 5 KVA / Single Phase" />
                  </div>
                  <div>
                    <Label>Control Panel</Label>
                    <Input value={formData.control_panel} onChange={(e) => setFormData(prev => ({ ...prev, control_panel: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Installation</Label>
                    <Select value={formData.installation} onValueChange={(v) => setFormData(prev => ({ ...prev, installation: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes (With Installation)</SelectItem>
                        <SelectItem value="no">No (Without Installation)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Total Quantity</Label>
                    <Input type="number" value={formData.total_quantity} onChange={(e) => setFormData(prev => ({ ...prev, total_quantity: Number(e.target.value) }))} />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={formData.status} onValueChange={(v) => setFormData(prev => ({ ...prev, status: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TENDER_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Eligibility Section */}
                  <div className="col-span-2 border-t pt-4 mt-2">
                    <div className="flex items-center gap-4 mb-2">
                      <Label className="font-semibold">Eligibility</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="is_eligible"
                          checked={formData.is_eligible}
                          onChange={(e) => setFormData(prev => ({ ...prev, is_eligible: e.target.checked }))}
                          className="h-4 w-4"
                        />
                        <label htmlFor="is_eligible" className="text-sm">We are eligible for this tender</label>
                      </div>
                    </div>
                    {!formData.is_eligible && (
                      <div>
                        <Label>Reason for Ineligibility</Label>
                        <Input value={formData.eligibility_reason} onChange={(e) => setFormData(prev => ({ ...prev, eligibility_reason: e.target.value }))} placeholder="Why are we not eligible?" />
                      </div>
                    )}
                  </div>
                  
                  {/* DG Manual Fields */}
                  <div className="col-span-2 border-t pt-4 mt-2">
                    <Label className="font-semibold mb-2 block">Result Information (Fill after tender closes)</Label>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>L1 Price (₹)</Label>
                        <Input type="number" value={formData.l1_price} onChange={(e) => setFormData(prev => ({ ...prev, l1_price: Number(e.target.value) }))} />
                      </div>
                      <div>
                        <Label>MM Price (₹)</Label>
                        <Input type="number" value={formData.mm_price} onChange={(e) => setFormData(prev => ({ ...prev, mm_price: Number(e.target.value) }))} />
                      </div>
                      <div>
                        <Label>Winning Brand</Label>
                        <Input value={formData.winning_brand} onChange={(e) => setFormData(prev => ({ ...prev, winning_brand: e.target.value }))} />
                      </div>
                      <div>
                        <Label>Participation by M&M</Label>
                        <Select value={formData.participation_by_mm} onValueChange={(v) => setFormData(prev => ({ ...prev, participation_by_mm: v }))}>
                          <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="yes">Yes</SelectItem>
                            <SelectItem value="no">No</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Win By</Label>
                        <Input value={formData.win_by} onChange={(e) => setFormData(prev => ({ ...prev, win_by: e.target.value }))} />
                      </div>
                      <div>
                        <Label>Remark</Label>
                        <Input value={formData.remark} onChange={(e) => setFormData(prev => ({ ...prev, remark: e.target.value }))} />
                      </div>
                    </div>
                </div>
                </div>
              ) : (
                /* MLT Tender Form - Original fields */
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Bid Number *</Label>
                    <Input
                      value={formData.bid_number}
                      onChange={(e) => setFormData(prev => ({ ...prev, bid_number: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Department Name</Label>
                    <Input
                      value={formData.department_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, department_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Dated</Label>
                    <Input
                      type="date"
                      value={formData.dated}
                      onChange={(e) => setFormData(prev => ({ ...prev, dated: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Bid End Date</Label>
                    <Input
                      type="datetime-local"
                      value={formData.bid_end_date?.replace(' ', 'T')}
                      onChange={(e) => setFormData(prev => ({ ...prev, bid_end_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Bid Opening Date</Label>
                    <Input
                      type="datetime-local"
                      value={formData.bid_opening_date?.replace(' ', 'T')}
                      onChange={(e) => setFormData(prev => ({ ...prev, bid_opening_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Estimated Value (₹)</Label>
                    <Input
                      type="number"
                      value={formData.estimated_value}
                      onChange={(e) => setFormData(prev => ({ ...prev, estimated_value: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <Label>Total Quantity</Label>
                    <Input
                      type="number"
                      value={formData.total_quantity}
                      onChange={(e) => setFormData(prev => ({ ...prev, total_quantity: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <Label>EMD Amount (₹)</Label>
                    <Input
                      type="number"
                      value={formData.emd_amount}
                      onChange={(e) => setFormData(prev => ({ ...prev, emd_amount: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Beneficiary</Label>
                    <Input
                      value={formData.beneficiary}
                      onChange={(e) => setFormData(prev => ({ ...prev, beneficiary: e.target.value }))}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Item Specifications</Label>
                    <Textarea
                      value={formData.item_specifications}
                      onChange={(e) => setFormData(prev => ({ ...prev, item_specifications: e.target.value }))}
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label>Delivery Period (Days)</Label>
                    <Input
                      type="number"
                      value={formData.delivery_period}
                      onChange={(e) => setFormData(prev => ({ ...prev, delivery_period: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={formData.status} onValueChange={(v) => setFormData(prev => ({ ...prev, status: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(s => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Our Bid Amount (₹)</Label>
                    <Input
                      type="number"
                      value={formData.our_bid_amount}
                      onChange={(e) => setFormData(prev => ({ ...prev, our_bid_amount: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <Label>Assigned Employee</Label>
                    <Input
                      value={formData.assigned_employee}
                      onChange={(e) => setFormData(prev => ({ ...prev, assigned_employee: e.target.value }))}
              />
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
              />
            </div>
            
            {/* Consignees Section */}
            <div className="col-span-2 border-t pt-4 mt-2">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-base font-semibold">Consignees / Reporting Officers</Label>
                <Button variant="outline" size="sm" onClick={addConsignee} type="button">
                  <Plus className="h-4 w-4 mr-1" /> Add Consignee
                </Button>
              </div>
              {(formData.consignees || []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No consignees added. Click "Add Consignee" to add delivery locations.</p>
              ) : (
                <div className="space-y-3">
                  {formData.consignees.map((consignee, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-end p-3 bg-muted/50 rounded-lg">
                      <div className="col-span-4">
                        <Label className="text-xs">Name</Label>
                        <Input value={consignee.name} onChange={(e) => updateConsignee(idx, 'name', e.target.value)} placeholder="Officer/Location name" />
                      </div>
                      <div className="col-span-4">
                        <Label className="text-xs">Address</Label>
                        <Input value={consignee.address} onChange={(e) => updateConsignee(idx, 'address', e.target.value)} placeholder="Full address" />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Quantity</Label>
                        <Input type="number" value={consignee.quantity} onChange={(e) => updateConsignee(idx, 'quantity', Number(e.target.value))} />
                      </div>
                      <div className="col-span-1">
                        <Label className="text-xs">Days</Label>
                        <Input type="number" value={consignee.delivery_days} onChange={(e) => updateConsignee(idx, 'delivery_days', Number(e.target.value))} />
                      </div>
                      <div className="col-span-1">
                        <Button variant="ghost" size="sm" onClick={() => removeConsignee(idx)} className="text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowUploadModal(false)}>Cancel</Button>
            <Button onClick={handleCreateTender}>Create Tender</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tender Detail Sheet */}
      <Sheet open={showDetailSheet} onOpenChange={setShowDetailSheet}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center justify-between">
              <span>{selectedTender?.bid_number || 'Tender Details'}</span>
              <Badge className={STATUS_COLORS[selectedTender?.status]}>
                {selectedTender?.status}
              </Badge>
            </SheetTitle>
            <SheetDescription>{selectedTender?.department_name}</SheetDescription>
          </SheetHeader>

          {selectedTender && (
            <div className="mt-6 space-y-6">
              {/* Quick Actions */}
              <div className="flex gap-2">
                <Button variant={editMode ? 'default' : 'outline'} size="sm" onClick={() => setEditMode(!editMode)}>
                  <Edit className="h-4 w-4 mr-2" />
                  {editMode ? 'Editing' : 'Edit'}
                </Button>
                <Button variant="outline" size="sm" className="text-red-600" onClick={() => handleDeleteTender(selectedTender._id)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>

              <Tabs defaultValue="details">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="result">Result</TabsTrigger>
                  <TabsTrigger value="documents">Documents</TabsTrigger>
                  <TabsTrigger value="competitors">Competitors</TabsTrigger>
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Bid Number</Label>
                      {editMode ? (
                        <Input value={formData.bid_number} onChange={(e) => setFormData(prev => ({ ...prev, bid_number: e.target.value }))} />
                      ) : (
                        <p className="font-medium">{selectedTender.bid_number}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Dated</Label>
                      {editMode ? (
                        <Input type="date" value={formData.dated} onChange={(e) => setFormData(prev => ({ ...prev, dated: e.target.value }))} />
                      ) : (
                        <p className="font-medium">{formatDate(selectedTender.dated)}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Bid End Date</Label>
                      <p className="font-medium">{formatDate(selectedTender.bid_end_date)}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Opening Date</Label>
                      <p className="font-medium">{formatDate(selectedTender.bid_opening_date)}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Estimated Value</Label>
                      <p className="font-medium text-lg">{formatCurrency(selectedTender.estimated_value)}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Our Bid</Label>
                      {editMode ? (
                        <Input type="number" value={formData.our_bid_amount} onChange={(e) => setFormData(prev => ({ ...prev, our_bid_amount: Number(e.target.value) }))} />
                      ) : (
                        <p className="font-medium text-lg">{selectedTender.our_bid_amount ? formatCurrency(selectedTender.our_bid_amount) : '-'}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Quantity</Label>
                      <p className="font-medium">{selectedTender.total_quantity}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">EMD Amount</Label>
                      <p className="font-medium">{formatCurrency(selectedTender.emd_amount)}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Status</Label>
                      {editMode ? (
                        <Select value={formData.status} onValueChange={(v) => setFormData(prev => ({ ...prev, status: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge className={STATUS_COLORS[selectedTender.status]}>{selectedTender.status}</Badge>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Assigned To</Label>
                      {editMode ? (
                        <Input value={formData.assigned_employee} onChange={(e) => setFormData(prev => ({ ...prev, assigned_employee: e.target.value }))} />
                      ) : (
                        <p className="font-medium">{selectedTender.assigned_employee || '-'}</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Department</Label>
                    <p className="font-medium">{selectedTender.department_name}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Beneficiary</Label>
                    <p className="font-medium">{selectedTender.beneficiary || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Item Specifications</Label>
                    <p className="text-sm">{selectedTender.item_specifications || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Notes</Label>
                    {editMode ? (
                      <Textarea value={formData.notes} onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))} rows={3} />
                    ) : (
                      <p className="text-sm">{selectedTender.notes || '-'}</p>
                    )}
                  </div>
                  
                  {/* Consignees Section in Detail View */}
                  <div className="border-t pt-4 mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-semibold">Consignees / Delivery Locations</Label>
                      {editMode && (
                        <Button variant="outline" size="sm" onClick={addConsignee} type="button">
                          <Plus className="h-3 w-3 mr-1" /> Add
                        </Button>
                      )}
                    </div>
                    {(editMode ? formData.consignees : selectedTender.consignees)?.length > 0 ? (
                      <div className="space-y-2">
                        {(editMode ? formData.consignees : selectedTender.consignees).map((consignee, idx) => (
                          <div key={idx} className="p-2 bg-muted/50 rounded text-sm grid grid-cols-12 gap-2 items-center">
                            {editMode ? (
                              <>
                                <Input className="col-span-4 h-8 text-xs" value={consignee.name} onChange={(e) => updateConsignee(idx, 'name', e.target.value)} placeholder="Name" />
                                <Input className="col-span-4 h-8 text-xs" value={consignee.address} onChange={(e) => updateConsignee(idx, 'address', e.target.value)} placeholder="Address" />
                                <Input className="col-span-2 h-8 text-xs" type="number" value={consignee.quantity} onChange={(e) => updateConsignee(idx, 'quantity', Number(e.target.value))} />
                                <Input className="col-span-1 h-8 text-xs" type="number" value={consignee.delivery_days} onChange={(e) => updateConsignee(idx, 'delivery_days', Number(e.target.value))} />
                                <Button variant="ghost" size="sm" onClick={() => removeConsignee(idx)} className="col-span-1 h-8 text-red-600 p-0">
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <div className="col-span-5">
                                  <span className="font-medium">{consignee.name}</span>
                                  {consignee.address && <span className="text-muted-foreground ml-1">- {consignee.address}</span>}
                                </div>
                                <div className="col-span-3 text-right">Qty: {consignee.quantity}</div>
                                <div className="col-span-4 text-right text-muted-foreground">{consignee.delivery_days} days delivery</div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground py-2">No consignees specified</p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="result" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Winner Name</Label>
                      {editMode ? (
                        <Input value={formData.winner_name} onChange={(e) => setFormData(prev => ({ ...prev, winner_name: e.target.value }))} />
                      ) : (
                        <p className="font-medium">{selectedTender.winner_name || '-'}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Winning Amount</Label>
                      {editMode ? (
                        <Input type="number" value={formData.winner_amount} onChange={(e) => setFormData(prev => ({ ...prev, winner_amount: Number(e.target.value) }))} />
                      ) : (
                        <p className="font-medium">{selectedTender.winner_amount ? formatCurrency(selectedTender.winner_amount) : '-'}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Result Date</Label>
                      {editMode ? (
                        <Input type="date" value={formData.result_date} onChange={(e) => setFormData(prev => ({ ...prev, result_date: e.target.value }))} />
                      ) : (
                        <p className="font-medium">{formatDate(selectedTender.result_date)}</p>
                      )}
                    </div>
                  </div>
                  {selectedTender.status === 'lost' && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Reason for Loss</Label>
                      {editMode ? (
                        <Textarea value={formData.loss_reason} onChange={(e) => setFormData(prev => ({ ...prev, loss_reason: e.target.value }))} rows={2} />
                      ) : (
                        <p className="text-sm">{selectedTender.loss_reason || '-'}</p>
                      )}
                    </div>
                  )}
                </TabsContent>

                {/* Documents Tab */}
                <TabsContent value="documents" className="space-y-4 mt-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Tender Documents</Label>
                    <Button variant="outline" size="sm" onClick={() => { setDocumentForm({ name: '', type: 'other', url: '' }); setShowDocumentModal(true); }}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Document
                    </Button>
                  </div>
                  
                  {selectedTender.documents?.length > 0 ? (
                    <div className="space-y-2">
                      {selectedTender.documents.map((doc) => (
                        <div key={doc._id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded">
                              <FileText className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <a href={doc.url} target="_blank" rel="noopener noreferrer" className="font-medium text-sm hover:underline text-blue-600">
                                {doc.name || 'Untitled Document'}
                              </a>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Badge variant="outline" className="text-xs">{DOCUMENT_TYPES.find(t => t.value === doc.type)?.label || doc.type}</Badge>
                                <span>•</span>
                                <span>{formatDate(doc.uploaded_at)}</span>
                                {doc.uploaded_by && <><span>•</span><span>{doc.uploaded_by}</span></>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" asChild>
                              <a href={doc.url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDeleteDocument(doc._id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No documents attached</p>
                      <p className="text-sm">Click "Add Document" to attach tender-related files</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="competitors" className="space-y-4 mt-4">
                  {editMode && (
                    <Button variant="outline" size="sm" onClick={addCompetitor}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Competitor
                    </Button>
                  )}
                  {(editMode ? formData.competitors : selectedTender.competitors)?.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Rank</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead className="text-right">Bid Amount</TableHead>
                          {editMode && <TableHead></TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(editMode ? formData.competitors : selectedTender.competitors).map((comp, idx) => (
                          <TableRow key={idx}>
                            <TableCell>
                              {editMode ? (
                                <Input type="number" value={comp.rank} onChange={(e) => updateCompetitor(idx, 'rank', Number(e.target.value))} className="w-16" />
                              ) : (
                                comp.rank
                              )}
                            </TableCell>
                            <TableCell>
                              {editMode ? (
                                <Input value={comp.name} onChange={(e) => updateCompetitor(idx, 'name', e.target.value)} />
                              ) : (
                                comp.name
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {editMode ? (
                                <Input type="number" value={comp.bid_amount} onChange={(e) => updateCompetitor(idx, 'bid_amount', Number(e.target.value))} />
                              ) : (
                                formatCurrency(comp.bid_amount)
                              )}
                            </TableCell>
                            {editMode && (
                              <TableCell>
                                <Button variant="ghost" size="sm" onClick={() => removeCompetitor(idx)}>
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No competitor data added yet</p>
                  )}
                </TabsContent>

                <TabsContent value="timeline" className="mt-4">
                  <ScrollArea className="h-64">
                    {selectedTender.timeline?.length > 0 ? (
                      <div className="space-y-4">
                        {selectedTender.timeline.map((event, idx) => (
                          <div key={idx} className="flex gap-3 items-start">
                            <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                            <div>
                              <p className="font-medium text-sm">{event.action}</p>
                              <p className="text-xs text-muted-foreground">{event.details}</p>
                              <p className="text-xs text-muted-foreground">{formatDate(event.date)} by {event.user}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-8">No timeline events</p>
                    )}
                  </ScrollArea>
                </TabsContent>
              </Tabs>

              {editMode && (
                <div className="flex gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => { setEditMode(false); setFormData(selectedTender); }}>Cancel</Button>
                  <Button onClick={handleUpdateTender}>Save Changes</Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Add Document Modal */}
      <Dialog open={showDocumentModal} onOpenChange={setShowDocumentModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Document</DialogTitle>
            <DialogDescription>Add a URL link to a tender-related document</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Document Name *</Label>
              <Input 
                value={documentForm.name} 
                onChange={(e) => setDocumentForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Technical Specifications PDF"
              />
            </div>
            <div>
              <Label>Document Type</Label>
              <Select value={documentForm.type} onValueChange={(v) => setDocumentForm(prev => ({ ...prev, type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Document URL *</Label>
              <Input 
                value={documentForm.url} 
                onChange={(e) => setDocumentForm(prev => ({ ...prev, url: e.target.value }))}
                placeholder="https://..."
              />
              <p className="text-xs text-muted-foreground mt-1">Paste the link to the document (Google Drive, Dropbox, etc.)</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDocumentModal(false)}>Cancel</Button>
            <Button onClick={handleAddDocument}>Add Document</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Tenders;
