import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useFilters } from '@/context/FilterContext';
import { useAuth } from '@/context/AuthContext';
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
  DialogFooter,
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
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Upload, Edit, Trash2, ChevronLeft, ChevronRight, ShieldCheck, ShieldX, Search, X, Eye, Clock, AlertTriangle, Download, FileDown, Phone, FileText, MessageSquarePlus, ArrowLeftRight, Filter, Flame, Thermometer, Snowflake, Calendar, RefreshCw } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DataGrid } from '@/components/ui/data-grid';
import { LeadTimeline } from '@/components/leads/LeadTimeline';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { SearchableSelect } from '@/components/ui/searchable-select';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const initialFormData = {
  name: '',
  phone_number: '',
  email_address: '',
  state: '',
  dealer: '',
  employee_name: '',
  enquiry_no: '',
  enquiry_date: new Date().toISOString().split('T')[0], // Default to today
  customer_type: 'New Customer',
  kva: '',
  segment: '',
  enquiry_status: 'Open',
  enquiry_type: 'Warm',
  enquiry_stage: 'Prospecting',
  planned_followup_date: '',
  source: '',
  zone: '',
  area: '',
  location: '',
  remarks: '',
  call_status: 'Not Called',
  quotation_sent: false,
  quotation_date: '',
  added_by: ''
};

const Leads = () => {
  const { buildQueryParams } = useFilters();
  const { user } = useAuth();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalLeads, setTotalLeads] = useState(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [formData, setFormData] = useState(initialFormData);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  
  // Lost leads upload state
  const [uploadingLostLeads, setUploadingLostLeads] = useState(false);
  const lostLeadsFileInputRef = useRef(null);
  
  // Sales Order upload state
  const [uploadingSalesOrder, setUploadingSalesOrder] = useState(false);
  const salesOrderFileInputRef = useRef(null);
  const [soUploadSummaryOpen, setSoUploadSummaryOpen] = useState(false);
  const [soUploadSummaryData, setSoUploadSummaryData] = useState(null);
  
  // Bulk delete state
  const [selectedLeads, setSelectedLeads] = useState(new Set());
  const [selectAllOnPage, setSelectAllOnPage] = useState(false);
  const [bulkDeleteMode, setBulkDeleteMode] = useState(false);
  const [showBulkDeletePreview, setShowBulkDeletePreview] = useState(false);
  const [bulkDeletePreview, setBulkDeletePreview] = useState(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  
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
  
  // Dropdown options for form fields
  const [dropdownOptions, setDropdownOptions] = useState({});
  const [exporting, setExporting] = useState(false);
  
  // Call remarks modal state
  const [isRemarkDialogOpen, setIsRemarkDialogOpen] = useState(false);
  const [remarkLead, setRemarkLead] = useState(null);
  const [newRemark, setNewRemark] = useState('');
  const [callRemarks, setCallRemarks] = useState([]);
  const [loadingRemarks, setLoadingRemarks] = useState(false);
  
  // Transfer state
  const [transferring, setTransferring] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferLead, setTransferLead] = useState(null);
  const [transferData, setTransferData] = useState({
    target_dealer: '',
    transferred_by_employee: '',
    transfer_notes: ''
  });
  
  // Dealers and employees list for transfer modal
  const [dealersList, setDealersList] = useState([]);
  const [employeesList, setEmployeesList] = useState([]);
  
  // New filter states for Lead Type and Follow-up Date
  const [selectedLeadTypes, setSelectedLeadTypes] = useState([]);
  const [followupFilter, setFollowupFilter] = useState('all'); // 'all', 'today', 'tomorrow', 'next7days', 'overdue', 'custom'
  const [customFollowupStart, setCustomFollowupStart] = useState('');
  const [customFollowupEnd, setCustomFollowupEnd] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Users list for Added By dropdown
  const [usersList, setUsersList] = useState([]);
  
  // Follow-up tracking state in Edit dialog
  const [showFollowupForm, setShowFollowupForm] = useState(false);
  const [followupRemark, setFollowupRemark] = useState('');
  const [nextFollowupDate, setNextFollowupDate] = useState('');
  
  // URL search params for edit mode
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Closure questions state
  const [isClosureQuestionsOpen, setIsClosureQuestionsOpen] = useState(false);
  const [closureQuestionsLead, setClosureQuestionsLead] = useState(null);
  const [closureQuestions, setClosureQuestions] = useState([]);
  const [closureAnswers, setClosureAnswers] = useState({});
  const [pendingClosureCount, setPendingClosureCount] = useState(0);

  // Lost leads upload summary modal state
  const [isUploadSummaryOpen, setIsUploadSummaryOpen] = useState(false);
  const [uploadSummaryData, setUploadSummaryData] = useState(null);

  // Handle edit parameter from URL (e.g., /leads?edit=lead_123)
  useEffect(() => {
    const editLeadId = searchParams.get('edit');
    if (editLeadId) {
      // Fetch the lead and open edit dialog
      const fetchAndEditLead = async () => {
        try {
          const res = await axios.get(`${API}/leads/${editLeadId}`, { withCredentials: true });
          if (res.data) {
            setEditingLead(res.data);
            setFormData({
              name: res.data.name || '',
              phone_number: res.data.phone_number || '',
              email_address: res.data.email_address || '',
              address: res.data.address || '',
              state: res.data.state || '',
              district: res.data.district || '',
              tehsil: res.data.tehsil || '',
              pincode: res.data.pincode || '',
              dealer: res.data.dealer || '',
              segment: res.data.segment || '',
              kva: res.data.kva || '',
              qty: res.data.qty || '',
              enquiry_type: res.data.enquiry_type || '',
              enquiry_stage: res.data.enquiry_stage || '',
              remarks: res.data.remarks || '',
              employee_name: res.data.employee_name || '',
              assigned_to: res.data.assigned_to || '',
              call_status: res.data.call_status || '',
            });
            setIsDialogOpen(true);
            // Clear the edit param from URL without triggering re-render
            const newSearchParams = new URLSearchParams(searchParams);
            newSearchParams.delete('edit');
            window.history.replaceState(null, '', `${window.location.pathname}?${newSearchParams.toString()}`);
          }
        } catch (error) {
          console.error('Error fetching lead for edit:', error);
          toast.error('Failed to load lead for editing: ' + (error.response?.data?.detail || error.message));
        }
      };
      fetchAndEditLead();
    }
  }, [searchParams.get('edit')]); // Only re-run when edit param changes

  useEffect(() => {
    loadLeads();
  }, [buildQueryParams, searchQuery, searchField, page, pageSize, selectedLeadTypes, followupFilter, customFollowupStart, customFollowupEnd]);

  // Load dropdown options on mount
  useEffect(() => {
    const loadDropdownOptions = async () => {
      try {
        const res = await axios.get(`${API}/leads/dropdown-options`, { withCredentials: true });
        setDropdownOptions(res.data);
      } catch (error) {
        console.error('Error loading dropdown options:', error);
      }
    };
    
    const loadUsers = async () => {
      try {
        // Use the new endpoint accessible by all users (not admin-only)
        const res = await axios.get(`${API}/leads/users-list`, { withCredentials: true });
        setUsersList(res.data || []);
      } catch (error) {
        console.error('Error loading users:', error);
      }
    };
    
    const loadDealers = async () => {
      try {
        const res = await axios.get(`${API}/leads/dropdown-options`, { withCredentials: true });
        setDealersList(res.data.dealer || []);
        setEmployeesList(res.data.employee_name || []);
      } catch (error) {
        console.error('Error loading dealers:', error);
      }
    };
    
    loadDropdownOptions();
    loadUsers();
    loadDealers();
    loadPendingClosureCount();
  }, []);

  // Load pending closure questions count
  const loadPendingClosureCount = async () => {
    try {
      const res = await axios.get(`${API}/leads/pending-closure-questions/count`, { withCredentials: true });
      setPendingClosureCount(res.data.count || 0);
    } catch (error) {
      console.error('Error loading pending closure count:', error);
    }
  };

  const loadLeads = async () => {
    setLoading(true);
    try {
      const queryParams = buildQueryParams();
      // Use server-side pagination for better performance
      let url = `${API}/leads?${queryParams}&page=${page}&limit=${pageSize}`;
      
      // Add search params
      if (searchQuery.trim()) {
        url += `&search=${encodeURIComponent(searchQuery.trim())}&search_field=${searchField}`;
      }
      
      // Add lead type filter (Hot/Warm/Cold)
      if (selectedLeadTypes.length > 0) {
        url += `&enquiry_type=${encodeURIComponent(selectedLeadTypes.join(','))}`;
      }
      
      // Add follow-up date filter
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      const next7days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
      
      // Flag to only show open leads when filtering by follow-up
      let addOnlyOpenFilter = false;
      
      if (followupFilter === 'today') {
        url += `&followup_start_date=${today}&followup_end_date=${today}`;
        addOnlyOpenFilter = true;
      } else if (followupFilter === 'tomorrow') {
        url += `&followup_start_date=${tomorrow}&followup_end_date=${tomorrow}`;
        addOnlyOpenFilter = true;
      } else if (followupFilter === 'next7days') {
        url += `&followup_start_date=${today}&followup_end_date=${next7days}`;
        addOnlyOpenFilter = true;
      } else if (followupFilter === 'overdue') {
        // For overdue, we need follow-up date < today (use a far past date as start)
        url += `&followup_start_date=2000-01-01&followup_end_date=${new Date(Date.now() - 86400000).toISOString().split('T')[0]}`;
        addOnlyOpenFilter = true;
      } else if (followupFilter === 'custom' && (customFollowupStart || customFollowupEnd)) {
        if (customFollowupStart) url += `&followup_start_date=${customFollowupStart}`;
        if (customFollowupEnd) url += `&followup_end_date=${customFollowupEnd}`;
        addOnlyOpenFilter = true;
      }
      
      // Only show open leads when filtering by follow-up dates (can't follow up on closed leads)
      if (addOnlyOpenFilter) {
        url += `&only_open_followups=true`;
      }
      
      const res = await axios.get(url, { withCredentials: true });
      setLeads(res.data.leads || []);
      setTotalLeads(res.data.total || 0);
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

  // Toggle lead type in multi-select
  const toggleLeadType = (type) => {
    setSelectedLeadTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type) 
        : [...prev, type]
    );
    setPage(1);
  };

  // Clear all advanced filters
  const clearAdvancedFilters = () => {
    setSelectedLeadTypes([]);
    setFollowupFilter('all');
    setCustomFollowupStart('');
    setCustomFollowupEnd('');
    setPage(1);
  };

  // Check if any advanced filter is active
  const hasActiveFilters = selectedLeadTypes.length > 0 || followupFilter !== 'all';

  // Get follow-up filter label
  const getFollowupFilterLabel = () => {
    const labels = {
      'all': 'All Follow-ups',
      'today': 'Today',
      'tomorrow': 'Tomorrow',
      'next7days': 'Next 7 Days',
      'overdue': 'Overdue',
      'custom': 'Custom Range'
    };
    return labels[followupFilter] || 'All Follow-ups';
  };

  // Export leads to Excel
  const handleExport = async () => {
    setExporting(true);
    try {
      const queryParams = buildQueryParams();
      let url = `${API}/leads/export?${queryParams}&format=xlsx`;
      
      // Add lead type filter (Hot/Warm/Cold)
      if (selectedLeadTypes.length > 0) {
        url += `&enquiry_type=${encodeURIComponent(selectedLeadTypes.join(','))}`;
      }
      
      // Add follow-up date filter
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      const next7days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
      
      // Flag to only export open leads when filtering by follow-up
      let addOnlyOpenFilter = false;
      
      if (followupFilter === 'today') {
        url += `&followup_start_date=${today}&followup_end_date=${today}`;
        addOnlyOpenFilter = true;
      } else if (followupFilter === 'tomorrow') {
        url += `&followup_start_date=${tomorrow}&followup_end_date=${tomorrow}`;
        addOnlyOpenFilter = true;
      } else if (followupFilter === 'next7days') {
        url += `&followup_start_date=${today}&followup_end_date=${next7days}`;
        addOnlyOpenFilter = true;
      } else if (followupFilter === 'overdue') {
        url += `&followup_start_date=2000-01-01&followup_end_date=${new Date(Date.now() - 86400000).toISOString().split('T')[0]}`;
        addOnlyOpenFilter = true;
      } else if (followupFilter === 'custom' && (customFollowupStart || customFollowupEnd)) {
        if (customFollowupStart) url += `&followup_start_date=${customFollowupStart}`;
        if (customFollowupEnd) url += `&followup_end_date=${customFollowupEnd}`;
        addOnlyOpenFilter = true;
      }
      
      // Only export open leads when filtering by follow-up dates
      if (addOnlyOpenFilter) {
        url += `&only_open_followups=true`;
      }
      
      const response = await axios.get(url, {
        withCredentials: true,
        responseType: 'blob'
      });
      
      // Create download link
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', `leads_export_${new Date().toISOString().slice(0,10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
      
      toast.success('Export downloaded successfully');
    } catch (error) {
      console.error('Error exporting leads:', error);
      toast.error('Failed to export leads');
    } finally {
      setExporting(false);
    }
  };

  // Download template for bulk upload
  const handleDownloadTemplate = async () => {
    try {
      const response = await axios.get(`${API}/leads/template`, {
        withCredentials: true,
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'lead_upload_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Template downloaded');
    } catch (error) {
      console.error('Error downloading template:', error);
      toast.error('Failed to download template');
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    const requiredFields = {
      name: 'Customer Name',
      phone_number: 'Phone Number',
      state: 'State',
      dealer: 'Dealer',
      segment: 'Segment'
    };
    
    for (const [field, label] of Object.entries(requiredFields)) {
      if (!formData[field] || !formData[field].trim()) {
        toast.error(`${label} is required`);
        return;
      }
    }
    
    try {
      const data = { ...formData };
      if (data.kva) data.kva = parseFloat(data.kva);
      
      // Add follow-up tracking data if the form is shown and has content
      if (editingLead && showFollowupForm && followupRemark.trim()) {
        const followupEntry = {
          remark: followupRemark.trim(),
          followed_up_on: new Date().toISOString().split('T')[0],
          followed_up_by: user?.name || user?.email || 'Unknown',
          next_followup_date: nextFollowupDate || null
        };
        
        // Add to followup_history array
        data.followup_history = [...(editingLead.followup_history || []), followupEntry];
        
        // Update last_followup_date to today
        data.last_followup_date = new Date().toISOString().split('T')[0];
        
        // Update planned_followup_date if next date is provided
        if (nextFollowupDate) {
          data.planned_followup_date = nextFollowupDate;
        }
      }
      
      if (editingLead) {
        // Check if this is a Lost status change - trigger closure questions
        const oldStage = editingLead.enquiry_stage;
        const newStage = data.enquiry_stage;
        
        // Won stages (no closure questions)
        const wonStages = ['Closed-Won', 'Order Booked'];
        // Faulty stage (no closure questions)
        const faultyStages = ['Closed-Faulty'];
        
        // Check if new stage is a "closed" stage but NOT won or faulty = Lost
        const isClosedStage = newStage?.toLowerCase().startsWith('closed') || newStage?.toLowerCase() === 'lost';
        const isWonStage = wonStages.some(s => newStage?.toLowerCase() === s.toLowerCase());
        const isFaultyStage = faultyStages.some(s => newStage?.toLowerCase() === s.toLowerCase());
        const isNowLost = isClosedStage && !isWonStage && !isFaultyStage;
        
        // Check if old stage was already lost
        const wasClosedStage = oldStage?.toLowerCase().startsWith('closed') || oldStage?.toLowerCase() === 'lost';
        const wasWonStage = wonStages.some(s => oldStage?.toLowerCase() === s.toLowerCase());
        const wasFaultyStage = faultyStages.some(s => oldStage?.toLowerCase() === s.toLowerCase());
        const wasLost = wasClosedStage && !wasWonStage && !wasFaultyStage;
        
        if (isNowLost && !wasLost) {
          // Mark as needing closure questions
          data.needs_closure_questions = true;
          data.closure_type = 'lost';
        }
        
        await axios.put(`${API}/leads/${editingLead.lead_id}`, data, {
          withCredentials: true
        });
        toast.success('Lead updated successfully');
        
        // If status changed to Lost, trigger closure questions modal
        if (isNowLost && !wasLost) {
          setIsDialogOpen(false);
          // Give a brief delay then open the closure questions modal
          setTimeout(() => {
            openClosureQuestionsDialog({ ...editingLead, ...data });
          }, 300);
        }
      } else {
        await axios.post(`${API}/leads`, data, {
          withCredentials: true
        });
        toast.success('Lead created successfully');
      }
      
      setIsDialogOpen(false);
      setEditingLead(null);
      setFormData(initialFormData);
      // Reset follow-up form state
      setShowFollowupForm(false);
      setFollowupRemark('');
      setNextFollowupDate('');
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
      zone: lead.zone || '',
      state: lead.state || '',
      area: lead.area || '',
      location: lead.location || '',
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
      planned_followup_date: lead.planned_followup_date || '',
      source: lead.source || '',
      remarks: lead.remarks || '',
      call_status: lead.call_status || 'Not Called',
      quotation_sent: lead.quotation_sent || false,
      quotation_date: lead.quotation_date || '',
      added_by: lead.added_by || ''
    });
    // Reset follow-up form state
    setShowFollowupForm(false);
    setFollowupRemark('');
    setNextFollowupDate('');
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
      
      // Show merge summary modal if there were merged leads
      if (res.data.merged > 0 && res.data.merge_details?.length > 0) {
        setUploadSummaryData({
          ...res.data,
          upload_type: 'enquiry'
        });
        setIsUploadSummaryOpen(true);
      } else {
        toast.success(`Upload complete: ${res.data.created} created, ${res.data.updated} merged/updated`);
      }
      
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

  // Lost leads upload handler
  const handleLostLeadsUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingLostLeads(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      console.log('Starting lost leads upload...');
      const res = await axios.post(`${API}/upload/lost-leads`, formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      console.log('Lost leads upload response:', res.data);
      
      // Show summary modal with detailed results
      setUploadSummaryData({
        ...res.data,
        upload_type: 'lost'
      });
      setIsUploadSummaryOpen(true);
      console.log('Modal should be open now');
      
      loadLeads();
    } catch (error) {
      console.error('Lost leads upload error:', error);
      toast.error(error.response?.data?.detail || 'Failed to upload lost leads file');
    } finally {
      setUploadingLostLeads(false);
      if (lostLeadsFileInputRef.current) lostLeadsFileInputRef.current.value = '';
    }
  };

  // Download lost leads template
  const handleDownloadLostLeadsTemplate = async () => {
    try {
      const response = await axios.get(`${API}/upload/lost-leads/template`, {
        withCredentials: true,
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'lost_leads_upload_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Lost leads template downloaded');
    } catch (error) {
      console.error('Error downloading lost leads template:', error);
      toast.error('Failed to download template');
    }
  };

  // Sales Order upload handler
  const handleSalesOrderUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingSalesOrder(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      console.log('Starting sales order upload...');
      const res = await axios.post(`${API}/upload/sales-order`, formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      console.log('Sales order upload response:', res.data);
      
      // Show summary modal with detailed results
      setSoUploadSummaryData(res.data);
      setSoUploadSummaryOpen(true);
      
      loadLeads();
    } catch (error) {
      console.error('Sales order upload error:', error);
      toast.error(error.response?.data?.detail || 'Failed to upload sales order file');
    } finally {
      setUploadingSalesOrder(false);
      if (salesOrderFileInputRef.current) salesOrderFileInputRef.current.value = '';
    }
  };

  // Bulk delete functions
  const toggleLeadSelection = (leadId) => {
    setSelectedLeads(prev => {
      const newSet = new Set(prev);
      if (newSet.has(leadId)) {
        newSet.delete(leadId);
      } else {
        newSet.add(leadId);
      }
      return newSet;
    });
  };

  const toggleSelectAllOnPage = () => {
    if (selectAllOnPage) {
      // Deselect all on current page
      const currentPageIds = leads.map(l => l.lead_id);
      setSelectedLeads(prev => {
        const newSet = new Set(prev);
        currentPageIds.forEach(id => newSet.delete(id));
        return newSet;
      });
      setSelectAllOnPage(false);
    } else {
      // Select all on current page
      const currentPageIds = leads.map(l => l.lead_id);
      setSelectedLeads(prev => {
        const newSet = new Set(prev);
        currentPageIds.forEach(id => newSet.add(id));
        return newSet;
      });
      setSelectAllOnPage(true);
    }
  };

  const handlePreviewBulkDelete = async () => {
    setBulkDeleting(true);
    try {
      const requestBody = selectAllMatching
        ? {
            select_all_matching: true,
            state: filters.state || null,
            dealer: filters.dealer || null,
            employee_name: filters.employee || null,
            segment: filters.segment || null,
            enquiry_stage: filters.stage || null,
            start_date: filters.startDate || null,
            end_date: filters.endDate || null,
            search: searchQuery || null
          }
        : {
            lead_ids: Array.from(selectedLeads)
          };
      
      const res = await axios.post(`${API}/leads/bulk-delete/preview`, requestBody, { withCredentials: true });
      setBulkDeletePreview(res.data);
      setShowBulkDeletePreview(true);
    } catch (error) {
      console.error('Error previewing bulk delete:', error);
      toast.error(error.response?.data?.detail || 'Failed to preview bulk delete');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleConfirmBulkDelete = async () => {
    setBulkDeleting(true);
    try {
      const requestBody = selectAllMatching
        ? {
            select_all_matching: true,
            state: filters.state || null,
            dealer: filters.dealer || null,
            employee_name: filters.employee || null,
            segment: filters.segment || null,
            enquiry_stage: filters.stage || null,
            start_date: filters.startDate || null,
            end_date: filters.endDate || null,
            search: searchQuery || null
          }
        : {
            lead_ids: Array.from(selectedLeads)
          };
      
      const res = await axios.post(`${API}/leads/bulk-delete`, requestBody, { withCredentials: true });
      toast.success(res.data.message || `Deleted ${res.data.deleted_count} leads`);
      
      // Reset state
      setSelectedLeads(new Set());
      setSelectAllOnPage(false);
      setSelectAllMatching(false);
      setBulkDeleteMode(false);
      setShowBulkDeletePreview(false);
      setBulkDeletePreview(null);
      
      // Reload leads
      loadLeads();
    } catch (error) {
      console.error('Error bulk deleting:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete leads');
    } finally {
      setBulkDeleting(false);
    }
  };

  const cancelBulkDelete = () => {
    setSelectedLeads(new Set());
    setSelectAllOnPage(false);
    setSelectAllMatching(false);
    setBulkDeleteMode(false);
    setShowBulkDeletePreview(false);
    setBulkDeletePreview(null);
  };

  const isAdminOrManager = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'manager';

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

  // Call remarks functions
  const openRemarkDialog = async (lead) => {
    setRemarkLead(lead);
    setNewRemark('');
    setIsRemarkDialogOpen(true);
    setLoadingRemarks(true);
    try {
      const res = await axios.get(`${API}/leads/${lead.lead_id}/call-remarks`, { withCredentials: true });
      setCallRemarks(res.data.remarks || []);
    } catch (error) {
      console.error('Error loading call remarks:', error);
      setCallRemarks([]);
    } finally {
      setLoadingRemarks(false);
    }
  };

  const handleAddRemark = async () => {
    if (!newRemark.trim()) {
      toast.error('Please enter a remark');
      return;
    }
    
    try {
      await axios.post(`${API}/leads/${remarkLead.lead_id}/call-remark`, 
        { remark: newRemark.trim() },
        { withCredentials: true }
      );
      toast.success('Call remark added successfully');
      setNewRemark('');
      // Reload remarks
      const res = await axios.get(`${API}/leads/${remarkLead.lead_id}/call-remarks`, { withCredentials: true });
      setCallRemarks(res.data.remarks || []);
      loadLeads(); // Refresh leads list
    } catch (error) {
      console.error('Error adding call remark:', error);
      toast.error('Failed to add call remark');
    }
  };

  // Closure questions functions
  const openClosureQuestionsDialog = async (lead) => {
    setClosureQuestionsLead(lead);
    setClosureAnswers({});
    try {
      const res = await axios.get(`${API}/admin/closure-questions`, { withCredentials: true });
      // Filter questions that apply to 'lost' or 'all'
      const questions = (res.data.questions || []).filter(q => 
        q.applies_to === 'all' || q.applies_to === 'lost'
      );
      setClosureQuestions(questions);
      setIsClosureQuestionsOpen(true);
    } catch (error) {
      toast.error('Failed to load closure questions');
    }
  };

  const handleClosureAnswersSubmit = async () => {
    // Build answers array
    const answers = closureQuestions.map(q => ({
      question_id: q.question_id,
      question: q.question,
      answer: closureAnswers[q.question_id] || ''
    }));
    
    try {
      await axios.post(`${API}/leads/${closureQuestionsLead.lead_id}/closure-answers`, 
        { answers },
        { withCredentials: true }
      );
      toast.success('Closure answers saved successfully');
      setIsClosureQuestionsOpen(false);
      setClosureQuestionsLead(null);
      setClosureAnswers({});
      loadLeads();
      loadPendingClosureCount();
    } catch (error) {
      console.error('Error saving closure answers:', error);
      toast.error('Failed to save closure answers');
    }
  };

  // Check if a lead needs closure questions and trigger modal
  const checkAndTriggerClosureQuestions = async (leadId, newStage, oldStage) => {
    // Won stages (no closure questions)
    const wonStages = ['Closed-Won', 'Order Booked'];
    // Faulty stage (no closure questions)
    const faultyStages = ['Closed-Faulty'];
    
    // Check if new stage is a "closed" stage but NOT won or faulty = Lost
    const isClosedStage = newStage?.toLowerCase().startsWith('closed') || newStage?.toLowerCase() === 'lost';
    const isWonStage = wonStages.some(s => newStage?.toLowerCase() === s.toLowerCase());
    const isFaultyStage = faultyStages.some(s => newStage?.toLowerCase() === s.toLowerCase());
    const isNowLost = isClosedStage && !isWonStage && !isFaultyStage;
    
    // Check if old stage was already lost
    const wasClosedStage = oldStage?.toLowerCase().startsWith('closed') || oldStage?.toLowerCase() === 'lost';
    const wasWonStage = wonStages.some(s => oldStage?.toLowerCase() === s.toLowerCase());
    const wasFaultyStage = faultyStages.some(s => oldStage?.toLowerCase() === s.toLowerCase());
    const wasLost = wasClosedStage && !wasWonStage && !wasFaultyStage;
    
    if (isNowLost && !wasLost) {
      // Mark lead as needing closure questions
      try {
        await axios.put(`${API}/leads/${leadId}`, 
          { 
            enquiry_stage: newStage,
            needs_closure_questions: true,
            closure_type: 'lost'
          },
          { withCredentials: true }
        );
        // Fetch the updated lead and open questions modal
        const leadRes = await axios.get(`${API}/leads`, { withCredentials: true });
        const updatedLead = leadRes.data.leads?.find(l => l.lead_id === leadId);
        if (updatedLead) {
          openClosureQuestionsDialog(updatedLead);
        }
        return true; // Indicates we handled the update
      } catch (error) {
        console.error('Error triggering closure questions:', error);
      }
    }
    return false; // Let normal update continue
  };

  // Transfer lead to dealer - open modal
  const openTransferModal = (lead) => {
    setTransferLead(lead);
    setTransferData({
      target_dealer: lead.dealer || '',
      transferred_by_employee: lead.employee_name || '',
      transfer_notes: ''
    });
    setShowTransferModal(true);
  };
  
  // Execute transfer
  const handleTransferLead = async () => {
    if (!transferLead || !transferData.target_dealer || !transferData.transferred_by_employee) {
      toast.error('Please select target dealer and original generator');
      return;
    }
    
    setTransferring(true);
    try {
      await axios.post(`${API}/leads/${transferLead.lead_id}/transfer`, transferData, { withCredentials: true });
      toast.success('Lead transferred to dealer successfully');
      setShowTransferModal(false);
      setTransferLead(null);
      setShowLeadDetail(false);
      setSelectedLead(null);
      setEditDialogOpen(false);
      setEditingLead(null);
      loadLeads();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to transfer lead');
    } finally {
      setTransferring(false);
    }
  };

  // Check if lead can be transferred (all leads can now be transferred)
  const canTransferLead = (lead) => {
    // All leads can be transferred - removed BDM restriction
    // But not if already transferred
    return lead && lead.lead_id && !lead.is_transferred;
  };

  const getCallStatusBadge = (status) => {
    if (!status || status === 'Not Called') return <Badge variant="outline" className="gap-1"><Phone className="h-3 w-3" /> Not Called</Badge>;
    
    const variants = {
      'Called - No Response': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'Called - Interested': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'Called - Not Interested': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      'Called - Follow Up Required': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'Called - Converted': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    };
    return <Badge className={`gap-1 ${variants[status] || 'bg-gray-100 text-gray-800'}`}><Phone className="h-3 w-3" /> {status}</Badge>;
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

  // Closed stages that should NOT show follow-up warnings
  const CLOSED_STAGES = ['Closed-Won', 'Closed-Lost', 'Closed-Dropped', 'Order Booked', 'Won', 'Lost'];

  // Check if follow-up is overdue (only for OPEN leads - enquiry_status = "Open")
  const isFollowupOverdue = (date, lead) => {
    if (!date) return false;
    // Only show overdue for leads with enquiry_status = "Open"
    if (lead?.enquiry_status !== 'Open') return false;
    // Also skip if closed stage (belt and suspenders)
    if (lead?.enquiry_stage && CLOSED_STAGES.includes(lead.enquiry_stage)) return false;
    const today = new Date().toISOString().split('T')[0];
    return date < today;
  };

  const isFollowupToday = (date, lead) => {
    if (!date) return false;
    // Only show today indicator for leads with enquiry_status = "Open"
    if (lead?.enquiry_status !== 'Open') return false;
    // Also skip if closed stage
    if (lead?.enquiry_stage && CLOSED_STAGES.includes(lead.enquiry_stage)) return false;
    const today = new Date().toISOString().split('T')[0];
    return date === today;
  };

  // DataGrid columns configuration
  const gridColumns = [
    // Checkbox column for bulk delete (only when in bulk delete mode)
    ...(bulkDeleteMode ? [{
      key: 'select',
      label: '',
      sortable: false,
      filterable: false,
      width: '50px',
      render: (_, row) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selectedLeads.has(row.lead_id)}
            onCheckedChange={() => toggleLeadSelection(row.lead_id)}
            disabled={selectAllMatching}
          />
        </div>
      )
    }] : []),
    { key: 'enquiry_no', label: 'Enquiry No', sortable: true },
    { key: 'name', label: 'Name', sortable: true, render: (val, row) => (
      <div className="flex items-center gap-1">
        {row.is_transferred_lead && (
          <span title={`Originally generated by: ${row.original_generated_by || 'Unknown'}`} className="text-blue-500">
            <ArrowLeftRight className="h-3 w-3" />
          </span>
        )}
        <span>{val || row.corporate_name || '-'}</span>
      </div>
    )},
    { key: 'state', label: 'State', sortable: true },
    { key: 'district', label: 'District', sortable: true, render: (val, row) => val || row.location || row.area || '-' },
    { key: 'dealer', label: 'Dealer', sortable: true },
    { key: 'segment', label: 'Segment', sortable: true },
    { key: 'added_by', label: 'Added By', sortable: true, render: (val) => val || '-' },
    { 
      key: 'planned_followup_date', 
      label: 'Follow-up', 
      sortable: true,
      render: (val, row) => {
        if (!val) return '-';
        const overdue = isFollowupOverdue(val, row);
        const today = isFollowupToday(val, row);
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
          <input
            type="file"
            ref={lostLeadsFileInputRef}
            className="hidden"
            accept=".xlsx,.xls"
            onChange={handleLostLeadsUpload}
          />
          <Button
            variant="outline"
            onClick={handleDownloadTemplate}
            className="gap-2"
            title="Download template for bulk upload"
          >
            <FileDown className="h-4 w-4" />
            Template
          </Button>
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="gap-2 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                title="Upload lost leads from Excel"
              >
                <FileDown className="h-4 w-4" />
                Lost Leads
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-4" align="end">
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-sm mb-1">Lost Leads Upload</h4>
                  <p className="text-xs text-muted-foreground">
                    Upload lost leads. Existing leads will be updated to Lost status. Already-lost leads will be skipped.
                  </p>
                </div>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2"
                    onClick={handleDownloadLostLeadsTemplate}
                  >
                    <FileDown className="h-4 w-4" />
                    Download Template
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full justify-start gap-2 bg-red-600 hover:bg-red-700"
                    onClick={() => lostLeadsFileInputRef.current?.click()}
                    disabled={uploadingLostLeads}
                  >
                    <Upload className="h-4 w-4" />
                    {uploadingLostLeads ? 'Uploading...' : 'Upload Lost Leads'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  <strong>Column mapping:</strong><br/>
                  Win Reason → Competitor<br/>
                  Win Remarks → Lost Reason<br/>
                  Lost Remarks → Lost Remarks
                </p>
              </div>
            </PopoverContent>
          </Popover>
          
          {/* Sales Order Upload */}
          <input
            type="file"
            ref={salesOrderFileInputRef}
            className="hidden"
            accept=".xlsx,.xls"
            onChange={handleSalesOrderUpload}
          />
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="gap-2 border-green-300 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950"
                title="Upload sales orders from Excel"
              >
                <FileDown className="h-4 w-4" />
                Sales Orders
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-4" align="end">
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-sm mb-1">Sales Order Upload</h4>
                  <p className="text-xs text-muted-foreground">
                    Upload sales orders to mark leads as Won and track quantity (gensets sold).
                  </p>
                </div>
                <div className="space-y-2">
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full justify-start gap-2 bg-green-600 hover:bg-green-700"
                    onClick={() => salesOrderFileInputRef.current?.click()}
                    disabled={uploadingSalesOrder}
                  >
                    <Upload className="h-4 w-4" />
                    {uploadingSalesOrder ? 'Uploading...' : 'Upload Sales Orders'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  <strong>Key columns:</strong><br/>
                  Sales Order Number, Phone, Qty<br/>
                  Invoice No, Dispatch Date<br/>
                  <br/>
                  <strong>Note:</strong> "Unallotted" rows will be skipped.
                </p>
              </div>
            </PopoverContent>
          </Popover>
          
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={exporting || totalLeads === 0}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            {exporting ? 'Exporting...' : 'Export'}
          </Button>
          {isAdminOrManager && (
            <Button
              variant={bulkDeleteMode ? "destructive" : "outline"}
              onClick={() => {
                if (bulkDeleteMode) {
                  cancelBulkDelete();
                } else {
                  setBulkDeleteMode(true);
                }
              }}
              className="gap-2"
              title="Bulk delete leads"
            >
              <Trash2 className="h-4 w-4" />
              {bulkDeleteMode ? 'Cancel' : 'Bulk Delete'}
            </Button>
          )}
          {pendingClosureCount > 0 && (
            <Button
              variant="outline"
              onClick={async () => {
                // Load leads with pending closure questions
                try {
                  const res = await axios.get(`${API}/leads/pending-closure-questions?limit=1`, { withCredentials: true });
                  if (res.data.leads?.length > 0) {
                    openClosureQuestionsDialog(res.data.leads[0]);
                  }
                } catch (error) {
                  toast.error('Failed to load pending leads');
                }
              }}
              className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-50"
              title="Answer pending closure questions"
            >
              <AlertTriangle className="h-4 w-4" />
              {pendingClosureCount} Pending
            </Button>
          )}
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
                    <Label htmlFor="name">Customer Name <span className="text-red-500">*</span></Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      placeholder="Enter customer name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number <span className="text-red-500">*</span></Label>
                    <Input
                      id="phone"
                      value={formData.phone_number}
                      onChange={(e) => handleInputChange('phone_number', e.target.value)}
                      placeholder="Enter phone number"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email_address}
                      onChange={(e) => handleInputChange('email_address', e.target.value)}
                      placeholder="Enter email address"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="enquiry_no">Enquiry No</Label>
                    <Input
                      id="enquiry_no"
                      value={formData.enquiry_no}
                      onChange={(e) => handleInputChange('enquiry_no', e.target.value)}
                      placeholder="Auto-generated if empty"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="enquiry_date">Enquiry Date <span className="text-red-500">*</span></Label>
                    <Input
                      id="enquiry_date"
                      type="date"
                      value={formData.enquiry_date}
                      onChange={(e) => handleInputChange('enquiry_date', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Zone</Label>
                    <Select value={formData.zone || ''} onValueChange={(v) => handleInputChange('zone', v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select zone" />
                      </SelectTrigger>
                      <SelectContent>
                        {(dropdownOptions.zone || ['East', 'West', 'North', 'South']).map(opt => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>State <span className="text-red-500">*</span></Label>
                    <Select value={formData.state || ''} onValueChange={(v) => handleInputChange('state', v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {(dropdownOptions.state || []).map(opt => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Area</Label>
                    <Select value={formData.area || ''} onValueChange={(v) => handleInputChange('area', v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select area" />
                      </SelectTrigger>
                      <SelectContent>
                        {(dropdownOptions.area || []).slice(0, 50).map(opt => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>District</Label>
                    <Input
                      value={formData.district || formData.location || ''}
                      onChange={(e) => handleInputChange('district', e.target.value)}
                      placeholder="Enter district"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Dealer <span className="text-red-500">*</span></Label>
                    <Select value={formData.dealer || ''} onValueChange={(v) => handleInputChange('dealer', v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select dealer" />
                      </SelectTrigger>
                      <SelectContent>
                        {(dropdownOptions.dealer || []).slice(0, 100).map(opt => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Employee</Label>
                    <Select value={formData.employee_name || ''} onValueChange={(v) => handleInputChange('employee_name', v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {(dropdownOptions.employee_name || []).slice(0, 100).map(opt => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="kva">KVA</Label>
                    <Input
                      id="kva"
                      type="number"
                      value={formData.kva}
                      onChange={(e) => handleInputChange('kva', e.target.value)}
                      placeholder="Enter KVA"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Segment <span className="text-red-500">*</span></Label>
                    <Select value={formData.segment || ''} onValueChange={(v) => handleInputChange('segment', v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select segment" />
                      </SelectTrigger>
                      <SelectContent>
                        {(dropdownOptions.segment || ['Corporate', 'Retail', 'MSME', 'Government']).map(opt => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={formData.enquiry_status} onValueChange={(v) => handleInputChange('enquiry_status', v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(dropdownOptions.enquiry_status || ['Open', 'Closed']).map(opt => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
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
                        {(dropdownOptions.enquiry_stage || ['Prospecting', 'Qualified', 'Proposal', 'Negotiation', 'Closed-Won', 'Closed-Lost', 'Closed-Dropped', 'Order Booked']).map(opt => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
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
                        {(dropdownOptions.enquiry_type || ['Hot', 'Warm', 'Cold']).map(opt => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Source</Label>
                    <Select value={formData.source || ''} onValueChange={(v) => handleInputChange('source', v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select source" />
                      </SelectTrigger>
                      <SelectContent>
                        {(dropdownOptions.source || ['India Mart', 'Cold Call', 'Referral', 'Website', 'Exhibition', 'Other']).map(opt => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Customer Type</Label>
                    <Select value={formData.customer_type || ''} onValueChange={(v) => handleInputChange('customer_type', v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select customer type" />
                      </SelectTrigger>
                      <SelectContent>
                        {(dropdownOptions.customer_type || ['New Customer', 'Existing Customer']).map(opt => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="followup_date">Planned Follow-up Date</Label>
                    <Input
                      id="followup_date"
                      type="date"
                      value={formData.planned_followup_date || ''}
                      onChange={(e) => handleInputChange('planned_followup_date', e.target.value)}
                    />
                  </div>
                </div>
                
                {/* Call & Quotation Tracking Section */}
                <Separator className="my-4" />
                <h4 className="font-medium text-sm text-muted-foreground mb-3">Call & Quotation Tracking</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Call Status</Label>
                    <Select value={formData.call_status || 'Not Called'} onValueChange={(v) => handleInputChange('call_status', v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select call status" />
                      </SelectTrigger>
                      <SelectContent>
                        {(dropdownOptions.call_status || [
                          'Not Called',
                          'Called - No Response',
                          'Called - Interested',
                          'Called - Not Interested',
                          'Called - Follow Up Required',
                          'Called - Converted'
                        ]).map(opt => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quotation_date">Quotation Date</Label>
                    <Input
                      id="quotation_date"
                      type="date"
                      value={formData.quotation_date || ''}
                      onChange={(e) => handleInputChange('quotation_date', e.target.value)}
                      disabled={!formData.quotation_sent}
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="quotation_sent">Quotation Sent</Label>
                      <Switch
                        id="quotation_sent"
                        checked={formData.quotation_sent || false}
                        onCheckedChange={(checked) => {
                          handleInputChange('quotation_sent', checked);
                          if (checked && !formData.quotation_date) {
                            handleInputChange('quotation_date', new Date().toISOString().split('T')[0]);
                          }
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Toggle on if quotation has been sent to the customer</p>
                  </div>
                </div>
                
                {/* Follow-up Tracking Section - Only show when editing an existing lead */}
                {editingLead && (
                  <>
                    <Separator className="my-4" />
                    <h4 className="font-medium text-sm text-muted-foreground mb-3">Follow-up Tracking</h4>
                    
                    {/* Show follow-up history if exists */}
                    {editingLead.followup_history && editingLead.followup_history.length > 0 && (
                      <div className="mb-4 max-h-40 overflow-y-auto">
                        <Label className="text-xs text-muted-foreground mb-2 block">Previous Follow-ups</Label>
                        <div className="space-y-2">
                          {editingLead.followup_history.slice().reverse().map((entry, idx) => (
                            <div key={idx} className="p-2 bg-muted/50 rounded-md text-sm">
                              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                <span>{entry.followed_up_on}</span>
                                <span>by {entry.followed_up_by || 'Unknown'}</span>
                              </div>
                              <p className="text-foreground">{entry.remark}</p>
                              {entry.next_followup_date && (
                                <p className="text-xs text-muted-foreground mt-1">Next follow-up set: {entry.next_followup_date}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Log a Follow-up
                        </Label>
                        <Switch
                          checked={showFollowupForm}
                          onCheckedChange={(checked) => {
                            setShowFollowupForm(checked);
                            if (!checked) {
                              setFollowupRemark('');
                              setNextFollowupDate('');
                            }
                          }}
                        />
                      </div>
                      
                      {showFollowupForm && (
                        <div className="space-y-3 p-3 bg-muted/30 rounded-lg border">
                          <div className="space-y-2">
                            <Label htmlFor="followup_remark">Follow-up Remark *</Label>
                            <Textarea
                              id="followup_remark"
                              value={followupRemark}
                              onChange={(e) => setFollowupRemark(e.target.value)}
                              placeholder="Describe what was discussed or the outcome of the follow-up..."
                              rows={3}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="next_followup_date">Next Follow-up Date</Label>
                            <Input
                              id="next_followup_date"
                              type="date"
                              value={nextFollowupDate}
                              onChange={(e) => setNextFollowupDate(e.target.value)}
                              min={new Date().toISOString().split('T')[0]}
                            />
                            <p className="text-xs text-muted-foreground">This will update the planned follow-up date</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
                
                {/* Added By Section */}
                <Separator className="my-4" />
                <h4 className="font-medium text-sm text-muted-foreground mb-3">Lead Ownership</h4>
                <div className="space-y-2">
                  <Label htmlFor="added_by">Added By (Responsible User)</Label>
                  <Select value={formData.added_by || ''} onValueChange={(v) => handleInputChange('added_by', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select user" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="System Import">System Import</SelectItem>
                      {usersList.map(user => (
                        <SelectItem key={user.user_id} value={user.name || user.email}>
                          {user.name || user.email} {user.role ? `(${user.role})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Follow-up notifications will be shown to this user</p>
                </div>
                
                <Separator className="my-4" />
                <div className="space-y-2">
                  <Label htmlFor="remarks">Remarks</Label>
                  <Textarea
                    id="remarks"
                    value={formData.remarks}
                    onChange={(e) => handleInputChange('remarks', e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="flex justify-between gap-2">
                  <div>
                    {editingLead && canTransferLead(editingLead) && (
                      <Button 
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          openTransferModal(editingLead);
                        }}
                        disabled={transferring}
                        className="bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-900 dark:hover:bg-blue-800 dark:text-blue-200"
                      >
                        <ArrowLeftRight className="h-4 w-4 mr-2" />
                        Transfer to Dealer
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingLead ? 'Update' : 'Create'} Lead
                    </Button>
                  </div>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Bulk Delete Action Bar */}
      {bulkDeleteMode && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Checkbox
                checked={selectAllOnPage}
                onCheckedChange={toggleSelectAllOnPage}
                id="select-all-page"
              />
              <Label htmlFor="select-all-page" className="cursor-pointer">
                Select all on page
              </Label>
              
              <div className="h-4 w-px bg-red-300" />
              
              <Checkbox
                checked={selectAllMatching}
                onCheckedChange={(checked) => {
                  setSelectAllMatching(checked);
                  if (checked) {
                    setSelectedLeads(new Set());
                    setSelectAllOnPage(false);
                  }
                }}
                id="select-all-matching"
              />
              <Label htmlFor="select-all-matching" className="cursor-pointer">
                Select all {totalLeads.toLocaleString()} matching leads
              </Label>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-red-700 dark:text-red-400">
                {selectAllMatching 
                  ? `All ${totalLeads.toLocaleString()} matching leads` 
                  : `${selectedLeads.size} selected`}
              </span>
              <Button
                variant="destructive"
                size="sm"
                onClick={handlePreviewBulkDelete}
                disabled={bulkDeleting || (selectedLeads.size === 0 && !selectAllMatching)}
                className="gap-2"
              >
                {bulkDeleting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Preview Delete
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={cancelBulkDelete}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {/* Advanced Filters Bar */}
          <div className="p-4 border-b bg-muted/30">
            <div className="flex flex-wrap items-center gap-3">
              {/* Lead Type Multi-Select */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={`gap-2 ${selectedLeadTypes.length > 0 ? 'border-primary bg-primary/5' : ''}`}>
                    <Flame className="h-4 w-4" />
                    Lead Type
                    {selectedLeadTypes.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5">{selectedLeadTypes.length}</Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-3" align="start">
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Filter by Lead Type</h4>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-muted p-1.5 rounded">
                        <Checkbox 
                          checked={selectedLeadTypes.includes('Hot')} 
                          onCheckedChange={() => toggleLeadType('Hot')}
                        />
                        <Flame className="h-4 w-4 text-red-500" />
                        <span className="text-sm">Hot</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-muted p-1.5 rounded">
                        <Checkbox 
                          checked={selectedLeadTypes.includes('Warm')} 
                          onCheckedChange={() => toggleLeadType('Warm')}
                        />
                        <Thermometer className="h-4 w-4 text-orange-500" />
                        <span className="text-sm">Warm</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-muted p-1.5 rounded">
                        <Checkbox 
                          checked={selectedLeadTypes.includes('Cold')} 
                          onCheckedChange={() => toggleLeadType('Cold')}
                        />
                        <Snowflake className="h-4 w-4 text-blue-500" />
                        <span className="text-sm">Cold</span>
                      </label>
                    </div>
                    {selectedLeadTypes.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={() => setSelectedLeadTypes([])} className="w-full text-xs">
                        Clear Selection
                      </Button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Follow-up Date Filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={`gap-2 ${followupFilter !== 'all' ? 'border-primary bg-primary/5' : ''}`}>
                    <Calendar className="h-4 w-4" />
                    {getFollowupFilterLabel()}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-3" align="start">
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Filter by Follow-up Date</h4>
                    <div className="space-y-1">
                      {[
                        { value: 'all', label: 'All Follow-ups', icon: null },
                        { value: 'today', label: 'Today', icon: <Clock className="h-4 w-4 text-green-500" /> },
                        { value: 'tomorrow', label: 'Tomorrow', icon: <Clock className="h-4 w-4 text-blue-500" /> },
                        { value: 'next7days', label: 'Next 7 Days', icon: <Calendar className="h-4 w-4 text-purple-500" /> },
                        { value: 'overdue', label: 'Overdue', icon: <AlertTriangle className="h-4 w-4 text-red-500" /> },
                      ].map(option => (
                        <button 
                          key={option.value}
                          onClick={() => { setFollowupFilter(option.value); setPage(1); }}
                          className={`w-full flex items-center gap-2 p-2 rounded text-sm text-left hover:bg-muted ${followupFilter === option.value ? 'bg-primary/10 text-primary font-medium' : ''}`}
                        >
                          {option.icon}
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <button 
                        onClick={() => setFollowupFilter('custom')}
                        className={`w-full flex items-center gap-2 p-2 rounded text-sm text-left hover:bg-muted ${followupFilter === 'custom' ? 'bg-primary/10 text-primary font-medium' : ''}`}
                      >
                        <Filter className="h-4 w-4" />
                        Custom Date Range
                      </button>
                      {followupFilter === 'custom' && (
                        <div className="space-y-2 pt-2">
                          <div>
                            <Label className="text-xs">From</Label>
                            <Input 
                              type="date" 
                              value={customFollowupStart}
                              onChange={(e) => { setCustomFollowupStart(e.target.value); setPage(1); }}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">To</Label>
                            <Input 
                              type="date" 
                              value={customFollowupEnd}
                              onChange={(e) => { setCustomFollowupEnd(e.target.value); setPage(1); }}
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Clear Filters Button */}
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearAdvancedFilters} className="gap-1 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                  Clear Filters
                </Button>
              )}

              {/* Active Filter Summary */}
              {hasActiveFilters && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground ml-auto">
                  <Filter className="h-4 w-4" />
                  <span>
                    {selectedLeadTypes.length > 0 && `${selectedLeadTypes.join(', ')} leads`}
                    {selectedLeadTypes.length > 0 && followupFilter !== 'all' && ' • '}
                    {followupFilter !== 'all' && `Follow-up: ${getFollowupFilterLabel()}`}
                  </span>
                </div>
              )}
            </div>
          </div>
          
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
                initialPageSize={pageSize}
                showPageSizeSelector={false}
                serverPagination={true}
                totalRecords={totalLeads}
                emptyMessage="No leads found. Try adjusting your filters or add a new lead."
              />
              
              {/* Server-side Pagination Controls */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Showing {leads.length} of {totalLeads.toLocaleString()} leads</span>
                  <span>•</span>
                  <span>Page {page} of {totalPages}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Rows per page:</span>
                    <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(parseInt(v)); setPage(1); }}>
                      <SelectTrigger className="w-20 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                        <SelectItem value="200">200</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setPage(1)}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <ChevronLeft className="h-4 w-4 -ml-2" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="px-2 text-sm font-medium">{page}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setPage(totalPages)}
                      disabled={page >= totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                      <ChevronRight className="h-4 w-4 -ml-2" />
                    </Button>
                  </div>
                </div>
              </div>
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
            <div className="mt-4 space-y-4">
              {/* Follow-up Alerts - Only show for OPEN leads */}
              {selectedLead.planned_followup_date && isFollowupOverdue(selectedLead.planned_followup_date, selectedLead) && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg dark:bg-red-950/20 dark:border-red-800">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-semibold text-sm">⚠️ FOLLOW-UP OVERDUE - {selectedLead.planned_followup_date}</span>
                  </div>
                </div>
              )}
              
              {selectedLead.planned_followup_date && isFollowupToday(selectedLead.planned_followup_date, selectedLead) && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg dark:bg-amber-950/20 dark:border-amber-800">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <Clock className="h-4 w-4" />
                    <span className="font-semibold text-sm">📅 FOLLOW-UP TODAY</span>
                  </div>
                </div>
              )}

              {/* Call & Quotation Status Banner */}
              <div className="p-3 bg-muted/50 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Call Status</Label>
                      <div className="mt-1">{getCallStatusBadge(selectedLead.call_status)}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Quotation</Label>
                      <div className="mt-1">
                        {selectedLead.quotation_sent ? (
                          <Badge className="bg-green-100 text-green-800 gap-1">
                            <FileText className="h-3 w-3" /> Sent {selectedLead.quotation_date ? `on ${selectedLead.quotation_date}` : ''}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1"><FileText className="h-3 w-3" /> Not Sent</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => { openRemarkDialog(selectedLead); setShowLeadDetail(false); }}
                    className="gap-1"
                  >
                    <MessageSquarePlus className="h-4 w-4" />
                    Add Call Remark
                  </Button>
                </div>
              </div>

              {/* Key Info Banner */}
              <div className="p-4 bg-primary/5 border rounded-lg">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Name</Label>
                    <p className="font-semibold text-lg">{selectedLead.name || selectedLead.corporate_name || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Stage</Label>
                    <p>{getStatusBadge(selectedLead.enquiry_stage)}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Dealer</Label>
                    <p className="font-medium">{selectedLead.dealer || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Employee</Label>
                    <p className="font-medium">{selectedLead.employee_name || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Segment</Label>
                    <p>{selectedLead.segment || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Enquiry Date</Label>
                    <p>{selectedLead.enquiry_date || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Follow-up Date</Label>
                    <p className={isFollowupOverdue(selectedLead.planned_followup_date, selectedLead) ? 'text-red-600 font-semibold' : ''}>
                      {selectedLead.planned_followup_date || '-'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Enquiry Status</Label>
                    <p>{selectedLead.enquiry_status || selectedLead.enquiry_type || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Tabbed Content for All Details */}
              <Tabs defaultValue="contact" className="w-full">
                <TabsList className="grid w-full grid-cols-6 h-auto">
                  <TabsTrigger value="contact" className="text-xs py-2">Contact</TabsTrigger>
                  <TabsTrigger value="location" className="text-xs py-2">Location</TabsTrigger>
                  <TabsTrigger value="product" className="text-xs py-2">Product</TabsTrigger>
                  <TabsTrigger value="dates" className="text-xs py-2">Dates</TabsTrigger>
                  <TabsTrigger value="lost" className="text-xs py-2">Lost Info</TabsTrigger>
                  <TabsTrigger value="other" className="text-xs py-2">Other</TabsTrigger>
                </TabsList>

                {/* Contact Info Tab */}
                <TabsContent value="contact" className="mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs text-muted-foreground">Phone</Label><p className="text-sm">{selectedLead.phone_number || '-'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Email</Label><p className="text-sm break-all">{selectedLead.email_address || '-'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Customer Type</Label><p className="text-sm">{selectedLead.customer_type || '-'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Corporate Name</Label><p className="text-sm">{selectedLead.corporate_name || '-'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Referred By</Label><p className="text-sm">{selectedLead.referred_by || '-'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Source</Label><p className="text-sm">{selectedLead.source || selectedLead.source_from || '-'}</p></div>
                  </div>
                </TabsContent>

                {/* Location Tab */}
                <TabsContent value="location" className="mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs text-muted-foreground">Zone</Label><p className="text-sm">{selectedLead.zone || '-'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">State</Label><p className="text-sm">{selectedLead.state || '-'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Area Office</Label><p className="text-sm">{selectedLead.area || selectedLead.office || '-'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Branch</Label><p className="text-sm">{selectedLead.branch || '-'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">District</Label><p className="text-sm">{selectedLead.district || '-'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Tehsil</Label><p className="text-sm">{selectedLead.tehsil || '-'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">City</Label><p className="text-sm">{selectedLead.city || '-'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Pin Code</Label><p className="text-sm">{selectedLead.pincode || '-'}</p></div>
                    <div className="col-span-2"><Label className="text-xs text-muted-foreground">Address</Label><p className="text-sm">{selectedLead.address || selectedLead.location || '-'}</p></div>
                  </div>
                </TabsContent>

                {/* Product Tab */}
                <TabsContent value="product" className="mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs text-muted-foreground">Product</Label><p className="text-sm">{selectedLead.product || '-'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">KVA</Label><p className="text-sm">{selectedLead.kva || '-'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Phase</Label><p className="text-sm">{selectedLead.phase || '-'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Quantity</Label><p className="text-sm">{selectedLead.qty || '-'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Sub Segment</Label><p className="text-sm">{selectedLead.sub_segment || '-'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">DG Ownership</Label><p className="text-sm">{selectedLead.dg_ownership || '-'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Expected Value</Label><p className="text-sm">{selectedLead.expected_value ? `₹${selectedLead.expected_value.toLocaleString()}` : '-'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Priority</Label><p className="text-sm">{selectedLead.priority || '-'}</p></div>
                  </div>
                </TabsContent>

                {/* Dates Tab */}
                <TabsContent value="dates" className="mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs text-muted-foreground">Enquiry No</Label><p className="text-sm font-mono">{selectedLead.enquiry_no || '-'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Enquiry Date</Label><p className="text-sm">{selectedLead.enquiry_date || '-'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">EO/PO Date</Label><p className="text-sm">{selectedLead.eo_po_date || '-'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Planned Follow-up</Label><p className="text-sm">{selectedLead.planned_followup_date || '-'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Last Follow-up</Label><p className="text-sm">{selectedLead.last_followup_date || '-'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">No. of Follow-ups</Label><p className="text-sm">{selectedLead.no_of_followups || '-'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Closure Date</Label><p className="text-sm">{selectedLead.enquiry_closure_date || '-'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Created At</Label><p className="text-sm">{selectedLead.created_at ? new Date(selectedLead.created_at).toLocaleDateString() : '-'}</p></div>
                  </div>
                </TabsContent>

                {/* Lost Info Tab */}
                <TabsContent value="lost" className="mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs text-muted-foreground">Lost Date</Label><p className="text-sm">{selectedLead.lost_date || '-'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Competitor</Label><p className="text-sm font-medium text-red-600">{selectedLead.competitor || '-'}</p></div>
                    <div className="col-span-2">
                      <Label className="text-xs text-muted-foreground">Lost Reason</Label>
                      <p className="text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded mt-1 border border-red-200 dark:border-red-800">
                        {selectedLead.lost_reason || '-'}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs text-muted-foreground">Lost Remarks</Label>
                      <p className="text-sm p-2 bg-muted rounded mt-1">
                        {selectedLead.lost_remarks || '-'}
                      </p>
                    </div>
                    <div><Label className="text-xs text-muted-foreground">Closure Type</Label><p className="text-sm">{selectedLead.closure_type || '-'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Needs Closure Questions</Label><p className="text-sm">{selectedLead.needs_closure_questions === true ? 'Yes' : selectedLead.needs_closure_questions === false ? 'No' : '-'}</p></div>
                  </div>
                </TabsContent>

                {/* Other Tab */}
                <TabsContent value="other" className="mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs text-muted-foreground">Added By</Label><p className="text-sm font-medium text-primary">{selectedLead.added_by || '-'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Employee Code</Label><p className="text-sm">{selectedLead.employee_code || '-'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Employee Status</Label><p className="text-sm">{selectedLead.employee_status || '-'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Enquiry Type</Label><p className="text-sm">{selectedLead.enquiry_type || '-'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Enquiry Status</Label><p className="text-sm">{selectedLead.enquiry_status || '-'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Events</Label><p className="text-sm">{selectedLead.events || '-'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Created By</Label><p className="text-sm">{selectedLead.created_by || '-'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">PAN No</Label><p className="text-sm">{selectedLead.pan_no || '-'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Finance Required</Label><p className="text-sm">{selectedLead.finance_required || '-'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Finance Company</Label><p className="text-sm">{selectedLead.finance_company || '-'}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Qualified</Label><p className="text-sm">{selectedLead.is_qualified === true ? 'Yes' : selectedLead.is_qualified === false ? 'No' : '-'}</p></div>
                    <div className="col-span-2"><Label className="text-xs text-muted-foreground">Remarks</Label><p className="text-sm p-2 bg-muted rounded mt-1">{selectedLead.remarks || '-'}</p></div>
                  </div>
                </TabsContent>
              </Tabs>

              <Separator />

              {/* Action Buttons */}
              <div className="flex gap-2 flex-wrap">
                <Button onClick={() => { handleEdit(selectedLead); setShowLeadDetail(false); }} className="flex-1">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Lead
                </Button>
                <Button variant="outline" onClick={() => { openQualifyDialog(selectedLead); setShowLeadDetail(false); }}>
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Qualify
                </Button>
                {canTransferLead(selectedLead) && (
                  <Button 
                    variant="secondary" 
                    onClick={() => openTransferModal(selectedLead)}
                    disabled={transferring}
                    className="bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-900 dark:hover:bg-blue-800 dark:text-blue-200"
                  >
                    <ArrowLeftRight className="h-4 w-4 mr-2" />
                    Transfer to Dealer
                  </Button>
                )}
              </div>

              {/* Activity Timeline */}
              <LeadTimeline leadId={selectedLead.lead_id} />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Call Remarks Dialog */}
      <Dialog open={isRemarkDialogOpen} onOpenChange={(open) => {
        setIsRemarkDialogOpen(open);
        if (!open) {
          setRemarkLead(null);
          setNewRemark('');
          setCallRemarks([]);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              Call Remarks
            </DialogTitle>
            <DialogDescription>
              {remarkLead?.name || remarkLead?.enquiry_no} - Add and view call remarks history
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Add New Remark */}
            <div className="space-y-2">
              <Label htmlFor="new-remark">Add New Remark</Label>
              <Textarea
                id="new-remark"
                placeholder="Enter call notes, conversation summary, next steps..."
                value={newRemark}
                onChange={(e) => setNewRemark(e.target.value)}
                rows={3}
              />
              <Button onClick={handleAddRemark} className="w-full gap-2">
                <MessageSquarePlus className="h-4 w-4" />
                Add Remark
              </Button>
            </div>

            <Separator />

            {/* Remarks History */}
            <div className="space-y-2">
              <Label>Remarks History</Label>
              {loadingRemarks ? (
                <Skeleton className="h-24 w-full" />
              ) : callRemarks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No call remarks recorded yet</p>
              ) : (
                <ScrollArea className="h-[250px]">
                  <div className="space-y-3 pr-4">
                    {callRemarks.slice().reverse().map((remark, idx) => (
                      <div key={idx} className="p-3 border rounded-lg bg-muted/30">
                        <p className="text-sm">{remark.remark}</p>
                        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                          <span>By: {remark.added_by || 'Unknown'}</span>
                          <span>{remark.added_at ? new Date(remark.added_at).toLocaleString() : '-'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRemarkDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Closure Questions Dialog */}
      <Dialog open={isClosureQuestionsOpen} onOpenChange={(open) => {
        setIsClosureQuestionsOpen(open);
        if (!open) {
          setClosureQuestionsLead(null);
          setClosureAnswers({});
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Lost Lead Questions
              {pendingClosureCount > 0 && (
                <Badge variant="destructive" className="ml-2">{pendingClosureCount} Pending</Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {closureQuestionsLead?.name || closureQuestionsLead?.enquiry_no} - Please answer these questions (optional, shows as pending until filled)
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {closureQuestions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No closure questions configured. You can add them in Admin Settings.
              </p>
            ) : (
              closureQuestions.map((q) => (
                <div key={q.question_id} className="space-y-2">
                  <Label className="flex items-center gap-2">
                    {q.question}
                    {q.required && <span className="text-red-500">*</span>}
                  </Label>
                  {q.type === 'select' && q.options?.length > 0 ? (
                    <Select 
                      value={closureAnswers[q.question_id] || ''} 
                      onValueChange={(v) => setClosureAnswers(prev => ({ ...prev, [q.question_id]: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select an option" />
                      </SelectTrigger>
                      <SelectContent>
                        {q.options.map((opt, idx) => (
                          <SelectItem key={idx} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Textarea
                      placeholder="Enter your answer..."
                      value={closureAnswers[q.question_id] || ''}
                      onChange={(e) => setClosureAnswers(prev => ({ ...prev, [q.question_id]: e.target.value }))}
                      rows={2}
                    />
                  )}
                </div>
              ))
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsClosureQuestionsOpen(false);
                toast.info('Lead marked as Lost. Closure questions remain pending.');
                loadLeads();
                loadPendingClosureCount();
              }}
            >
              Skip for Now
            </Button>
            <Button 
              onClick={handleClosureAnswersSubmit}
              disabled={closureQuestions.length === 0}
            >
              Save Answers
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Preview Dialog */}
      <Dialog open={showBulkDeletePreview} onOpenChange={setShowBulkDeletePreview}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Confirm Bulk Delete
            </DialogTitle>
            <DialogDescription>
              Review the leads that will be deleted. This action moves leads to trash (recoverable for 14 days).
            </DialogDescription>
          </DialogHeader>
          
          {bulkDeletePreview && (
            <div className="space-y-4">
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {bulkDeletePreview.total_count.toLocaleString()} leads
                </div>
                <p className="text-sm text-muted-foreground">will be moved to trash</p>
              </div>
              
              {bulkDeletePreview.exceeds_limit && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 text-yellow-800 dark:text-yellow-200 text-sm">
                  <strong>Limit exceeded:</strong> You can delete up to {bulkDeletePreview.delete_limit.toLocaleString()} leads at once. 
                  Please narrow your selection.
                </div>
              )}
              
              {bulkDeletePreview.sample_leads?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Sample of leads to delete:</p>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {bulkDeletePreview.sample_leads.map((lead, idx) => (
                      <div key={lead.lead_id || idx} className="p-2 bg-muted rounded text-sm flex justify-between">
                        <span>{lead.name || lead.enquiry_no || 'Unknown'}</span>
                        <span className="text-muted-foreground">{lead.phone_number || '-'}</span>
                      </div>
                    ))}
                    {bulkDeletePreview.total_count > 10 && (
                      <p className="text-xs text-muted-foreground text-center">
                        ... and {bulkDeletePreview.total_count - 10} more
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowBulkDeletePreview(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmBulkDelete}
              disabled={bulkDeleting || !bulkDeletePreview?.can_delete}
            >
              {bulkDeleting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete {bulkDeletePreview?.total_count?.toLocaleString()} Leads
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Summary Modal - Handles both Enquiry and Lost Leads uploads */}
      <Dialog open={isUploadSummaryOpen} onOpenChange={setIsUploadSummaryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {uploadSummaryData?.upload_type === 'enquiry' ? 'Enquiry Upload Summary' : 'Lost Leads Upload Summary'}
            </DialogTitle>
            <DialogDescription>
              {uploadSummaryData?.total_rows} rows processed
            </DialogDescription>
          </DialogHeader>
          
          {uploadSummaryData && (
            <div className="flex-1 overflow-auto space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-green-50 p-3 rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-600">{uploadSummaryData.created}</div>
                  <div className="text-xs text-green-700">New Created</div>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg text-center">
                  <div className="text-2xl font-bold text-blue-600">{uploadSummaryData.updated || uploadSummaryData.merged || 0}</div>
                  <div className="text-xs text-blue-700">
                    {uploadSummaryData.upload_type === 'enquiry' ? 'Merged/Updated' : 'Updated to Lost'}
                  </div>
                </div>
                {uploadSummaryData.upload_type === 'lost' && (
                  <>
                    <div className="bg-gray-50 p-3 rounded-lg text-center">
                      <div className="text-2xl font-bold text-gray-600">{uploadSummaryData.skipped_lost || 0}</div>
                      <div className="text-xs text-gray-700">Already Lost</div>
                    </div>
                    <div className="bg-amber-50 p-3 rounded-lg text-center">
                      <div className="text-2xl font-bold text-amber-600">{uploadSummaryData.skipped_won || 0}</div>
                      <div className="text-xs text-amber-700">Won (Preserved)</div>
                    </div>
                  </>
                )}
              </div>
              
              {uploadSummaryData.total_errors > 0 && (
                <div className="bg-red-50 p-3 rounded-lg">
                  <div className="text-sm font-medium text-red-700">
                    {uploadSummaryData.total_errors} rows had errors
                  </div>
                </div>
              )}

              {/* Merge Details for Enquiry Upload */}
              {uploadSummaryData.upload_type === 'enquiry' && uploadSummaryData.merge_details?.length > 0 && (
                <div className="border rounded-lg">
                  <div className="bg-blue-50 px-3 py-2 border-b">
                    <h4 className="font-medium text-sm text-blue-800">
                      Merged Leads ({uploadSummaryData.merge_details.length})
                    </h4>
                    <p className="text-xs text-blue-600 mt-1">
                      Data from uploaded file was merged into existing leads
                    </p>
                  </div>
                  <ScrollArea className="h-[200px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Row</TableHead>
                          <TableHead className="text-xs">Name</TableHead>
                          <TableHead className="text-xs">Phone</TableHead>
                          <TableHead className="text-xs">Match By</TableHead>
                          <TableHead className="text-xs">Fields Merged</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {uploadSummaryData.merge_details.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-xs">{item.row}</TableCell>
                            <TableCell className="text-xs font-medium">{item.name}</TableCell>
                            <TableCell className="text-xs">{item.phone}</TableCell>
                            <TableCell className="text-xs">
                              <Badge variant="outline" className={item.matched_by === 'phone' ? 'bg-green-50' : 'bg-blue-50'}>
                                {item.matched_by}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              <div className="flex flex-wrap gap-1">
                                {item.merged_fields?.slice(0, 5).map((field, fidx) => (
                                  <Badge key={fidx} variant="secondary" className="text-[10px] px-1">
                                    {field}
                                  </Badge>
                                ))}
                                {item.field_count > 5 && (
                                  <Badge variant="secondary" className="text-[10px] px-1">
                                    +{item.field_count - 5} more
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}

              {/* Updated Leads Details for Lost Upload */}
              {uploadSummaryData.upload_type === 'lost' && uploadSummaryData.updated_details?.length > 0 && (
                <div className="border rounded-lg">
                  <div className="bg-blue-50 px-3 py-2 border-b">
                    <h4 className="font-medium text-sm text-blue-800">Updated to Lost ({uploadSummaryData.updated})</h4>
                  </div>
                  <ScrollArea className="h-[150px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Row</TableHead>
                          <TableHead className="text-xs">Name</TableHead>
                          <TableHead className="text-xs">Phone</TableHead>
                          <TableHead className="text-xs">Previous Stage</TableHead>
                          <TableHead className="text-xs">Lost Info</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {uploadSummaryData.updated_details.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-xs">{item.row}</TableCell>
                            <TableCell className="text-xs">{item.name}</TableCell>
                            <TableCell className="text-xs">{item.phone}</TableCell>
                            <TableCell className="text-xs">{item.previous_stage}</TableCell>
                            <TableCell className="text-xs">
                              {item.has_lost_info ? (
                                <Badge variant="outline" className="bg-green-50 text-green-700">Has Info</Badge>
                              ) : (
                                <Badge variant="outline" className="bg-yellow-50 text-yellow-700">Needs Questions</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}

              {/* Skipped Leads Details */}
              {uploadSummaryData.skipped_details?.length > 0 && (
                <div className="border rounded-lg">
                  <div className="bg-gray-50 px-3 py-2 border-b">
                    <h4 className="font-medium text-sm text-gray-800">Skipped ({uploadSummaryData.skipped_total})</h4>
                  </div>
                  <ScrollArea className="h-[150px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Row</TableHead>
                          <TableHead className="text-xs">Name</TableHead>
                          <TableHead className="text-xs">Phone</TableHead>
                          <TableHead className="text-xs">Reason</TableHead>
                          <TableHead className="text-xs">Current Stage</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {uploadSummaryData.skipped_details.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-xs">{item.row}</TableCell>
                            <TableCell className="text-xs">{item.name}</TableCell>
                            <TableCell className="text-xs">{item.phone}</TableCell>
                            <TableCell className="text-xs">
                              <Badge variant={item.reason === 'Won - Preserved' ? 'default' : 'secondary'} className="text-xs">
                                {item.reason}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{item.current_stage}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => setIsUploadSummaryOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sales Order Upload Summary Modal */}
      <Dialog open={soUploadSummaryOpen} onOpenChange={setSoUploadSummaryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Sales Order Upload Summary</DialogTitle>
            <DialogDescription>
              {soUploadSummaryData?.processed_details?.length || 0} sales orders processed
            </DialogDescription>
          </DialogHeader>
          
          {soUploadSummaryData && (
            <div className="flex-1 overflow-auto space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-green-50 p-3 rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-600">{soUploadSummaryData.created}</div>
                  <div className="text-xs text-green-700">New Won Leads</div>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg text-center">
                  <div className="text-2xl font-bold text-blue-600">{soUploadSummaryData.updated}</div>
                  <div className="text-xs text-blue-700">Updated to Won</div>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg text-center">
                  <div className="text-2xl font-bold text-purple-600">{soUploadSummaryData.total_qty}</div>
                  <div className="text-xs text-purple-700">Total Qty (Gensets)</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg text-center">
                  <div className="text-2xl font-bold text-gray-600">{soUploadSummaryData.total_errors}</div>
                  <div className="text-xs text-gray-700">Errors</div>
                </div>
              </div>

              {/* Processed Details */}
              {soUploadSummaryData.processed_details?.length > 0 && (
                <div className="border rounded-lg">
                  <div className="bg-green-50 px-3 py-2 border-b">
                    <h4 className="font-medium text-sm text-green-800">Processed Sales Orders</h4>
                  </div>
                  <ScrollArea className="h-[200px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">SO Number</TableHead>
                          <TableHead className="text-xs">Name</TableHead>
                          <TableHead className="text-xs">Phone</TableHead>
                          <TableHead className="text-xs">Qty</TableHead>
                          <TableHead className="text-xs">Action</TableHead>
                          <TableHead className="text-xs">Dispatch</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {soUploadSummaryData.processed_details.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-xs font-mono">{item.so_no}</TableCell>
                            <TableCell className="text-xs">{item.name}</TableCell>
                            <TableCell className="text-xs">{item.phone}</TableCell>
                            <TableCell className="text-xs font-bold">{item.qty}</TableCell>
                            <TableCell className="text-xs">
                              <Badge variant={item.action === 'created' ? 'default' : 'secondary'} className="text-xs">
                                {item.action}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              <Badge 
                                variant="outline" 
                                className={item.dispatch_status === 'dispatched' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}
                              >
                                {item.dispatch_status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}

              {/* Errors */}
              {soUploadSummaryData.errors?.length > 0 && (
                <div className="border rounded-lg border-red-200">
                  <div className="bg-red-50 px-3 py-2 border-b border-red-200">
                    <h4 className="font-medium text-sm text-red-800">Errors ({soUploadSummaryData.total_errors})</h4>
                  </div>
                  <div className="p-3 max-h-[100px] overflow-auto">
                    {soUploadSummaryData.errors.map((err, idx) => (
                      <p key={idx} className="text-xs text-red-600">SO {err.so_no}: {err.error}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => setSoUploadSummaryOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer to Dealer Modal */}
      <Dialog open={showTransferModal} onOpenChange={setShowTransferModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5" />
              Transfer Lead to Dealer
            </DialogTitle>
            <DialogDescription>
              Transfer this lead to a dealer. Once transferred, it will be excluded from KPIs until the dealer re-uploads it.
            </DialogDescription>
          </DialogHeader>
          
          {transferLead && (
            <div className="space-y-4 py-4">
              {/* Lead Info */}
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-sm font-medium">{transferLead.name || transferLead.corporate_name}</p>
                <p className="text-xs text-muted-foreground">{transferLead.enquiry_no} | {transferLead.phone_number}</p>
              </div>
              
              {/* Target Dealer */}
              <div className="space-y-2">
                <Label htmlFor="target_dealer">Target Dealer <span className="text-red-500">*</span></Label>
                <select
                  id="target_dealer"
                  value={transferData.target_dealer}
                  onChange={(e) => setTransferData({...transferData, target_dealer: e.target.value})}
                  className="w-full h-10 px-3 py-2 text-sm rounded-md border border-input bg-background"
                >
                  <option value="">Select dealer...</option>
                  {dealersList.map((dealer, idx) => (
                    <option key={idx} value={dealer}>{dealer}</option>
                  ))}
                </select>
              </div>
              
              {/* Original Generator (Transferred By Employee) */}
              <div className="space-y-2">
                <Label htmlFor="transferred_by_employee">Original Generator (Employee who generated this lead) <span className="text-red-500">*</span></Label>
                <select
                  id="transferred_by_employee"
                  value={transferData.transferred_by_employee}
                  onChange={(e) => setTransferData({...transferData, transferred_by_employee: e.target.value})}
                  className="w-full h-10 px-3 py-2 text-sm rounded-md border border-input bg-background"
                >
                  <option value="">Select employee...</option>
                  {usersList.map((user, idx) => (
                    <option key={idx} value={user.name || user.email}>{user.name || user.email}</option>
                  ))}
                </select>
              </div>
              
              {/* Transfer Notes */}
              <div className="space-y-2">
                <Label htmlFor="transfer_notes">Transfer Notes (Optional)</Label>
                <textarea
                  id="transfer_notes"
                  value={transferData.transfer_notes}
                  onChange={(e) => setTransferData({...transferData, transfer_notes: e.target.value})}
                  placeholder="Add any notes about this transfer..."
                  className="w-full min-h-[80px] px-3 py-2 text-sm rounded-md border border-input bg-background resize-none"
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransferModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleTransferLead}
              disabled={transferring || !transferData.target_dealer || !transferData.transferred_by_employee}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {transferring ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Transferring...
                </>
              ) : (
                <>
                  <ArrowLeftRight className="h-4 w-4 mr-2" />
                  Transfer Lead
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Leads;
