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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Plus, Upload, Edit, Trash2, ChevronLeft, ChevronRight, ShieldCheck, ShieldX } from 'lucide-react';

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

  useEffect(() => {
    loadLeads();
  }, [page, buildQueryParams]);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const queryParams = buildQueryParams();
      const res = await axios.get(`${API}/leads?${queryParams}&page=${page}&limit=20`, {
        withCredentials: true
      });
      setLeads(res.data.leads || []);
      setTotalPages(res.data.pages || 1);
    } catch (error) {
      console.error('Error loading leads:', error);
      toast.error('Failed to load leads');
    } finally {
      setLoading(false);
    }
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Manage Leads</h1>
          <p className="text-muted-foreground mt-1">Create, update, and manage your leads</p>
        </div>
        <div className="flex gap-2">
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Enquiry No</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Dealer</TableHead>
                    <TableHead>Segment</TableHead>
                    <TableHead>KVA</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No leads found
                      </TableCell>
                    </TableRow>
                  ) : (
                    leads.map((lead) => (
                      <TableRow key={lead.lead_id}>
                        <TableCell className="font-mono text-sm">{lead.enquiry_no || '-'}</TableCell>
                        <TableCell>{lead.name || lead.corporate_name || '-'}</TableCell>
                        <TableCell>{lead.state || '-'}</TableCell>
                        <TableCell>{lead.dealer || '-'}</TableCell>
                        <TableCell>{lead.segment || '-'}</TableCell>
                        <TableCell>{lead.kva || '-'}</TableCell>
                        <TableCell>{getStatusBadge(lead.enquiry_stage)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(lead)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(lead.lead_id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              
              {/* Pagination */}
              <div className="flex items-center justify-between p-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Leads;
