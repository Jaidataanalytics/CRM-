import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useFilters } from '@/context/FilterContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  Truck, Package, Clock, CheckCircle2, Search, 
  RefreshCw, Calendar, MapPin, User, Phone,
  AlertCircle, History, ChevronLeft, ChevronRight, Download
} from 'lucide-react';
import { ExportButton } from '@/components/ui/export-button';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Dispatch = () => {
  const { filters, buildQueryParams } = useFilters();
  const [summary, setSummary] = useState({ total_won: 0, pending_dispatch: 0, dispatched: 0, needs_migration: 0 });
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedLead, setSelectedLead] = useState(null);
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [dispatchHistory, setDispatchHistory] = useState([]);
  
  // Dispatch form state
  const [dispatchForm, setDispatchForm] = useState({
    dispatch_status: '',
    dispatch_date: '',
    delivery_address: '',
    transporter_details: '',
    reason: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchSummary = useCallback(async () => {
    try {
      const queryParams = buildQueryParams();
      const res = await axios.get(`${API}/dispatch/summary?${queryParams}`, { withCredentials: true });
      setSummary(res.data);
    } catch (err) {
      console.error('Failed to fetch dispatch summary');
    }
  }, [buildQueryParams]);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const status = activeTab === 'all' ? '' : activeTab;
      const queryParams = buildQueryParams();
      const res = await axios.get(`${API}/dispatch/list?${queryParams}`, {
        params: { dispatch_status: status, search, page, limit: 20 },
        withCredentials: true
      });
      setLeads(res.data.leads);
      setTotalPages(res.data.pages);
    } catch (err) {
      toast.error('Failed to fetch leads');
    } finally {
      setLoading(false);
    }
  }, [activeTab, search, page, buildQueryParams]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [filters]);

  const handleMigrate = async () => {
    try {
      const res = await axios.post(`${API}/dispatch/migrate`, {}, { withCredentials: true });
      toast.success(`Migration complete: ${res.data.total_migrated} orders updated`);
      fetchSummary();
      fetchLeads();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Migration failed');
    }
  };

  const openDispatchModal = (lead, newStatus) => {
    setSelectedLead(lead);
    setDispatchForm({
      dispatch_status: newStatus,
      dispatch_date: newStatus === 'dispatched' ? new Date().toISOString().split('T')[0] : '',
      delivery_address: lead.delivery_address || '',
      transporter_details: lead.transporter_details || '',
      reason: ''
    });
    setDispatchModalOpen(true);
  };

  const handleDispatchSubmit = async () => {
    if (!selectedLead) return;
    
    if (dispatchForm.dispatch_status === 'dispatched' && !dispatchForm.dispatch_date) {
      toast.error('Dispatch date is required');
      return;
    }
    
    setSubmitting(true);
    try {
      await axios.patch(`${API}/dispatch/${selectedLead.lead_id}`, dispatchForm, { withCredentials: true });
      toast.success(`Status updated to ${dispatchForm.dispatch_status}`);
      setDispatchModalOpen(false);
      fetchSummary();
      fetchLeads();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update status');
    } finally {
      setSubmitting(false);
    }
  };

  const fetchHistory = async (lead) => {
    try {
      const res = await axios.get(`${API}/dispatch/${lead.lead_id}/history`, { withCredentials: true });
      setDispatchHistory(res.data.history || []);
      setSelectedLead(lead);
      setHistoryModalOpen(true);
    } catch (err) {
      toast.error('Failed to fetch history');
    }
  };

  return (
    <div className="space-y-6 p-6" data-testid="dispatch-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Truck className="h-8 w-8 text-primary" />
            Dispatch Management
          </h1>
          <p className="text-muted-foreground">Track and manage order dispatches</p>
        </div>
        <Button onClick={() => { fetchSummary(); fetchLeads(); }} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Total Won Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{summary.total_won}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600" />
              Pending Dispatch
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-amber-600">{summary.pending_dispatch}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-600" />
              Dispatched
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">{summary.dispatched}</p>
          </CardContent>
        </Card>

        {summary.needs_migration > 0 && (
          <Card className="bg-gradient-to-br from-red-50 to-orange-50 border-red-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                Needs Migration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-red-600">{summary.needs_migration}</p>
              <Button onClick={handleMigrate} size="sm" className="mt-2 bg-red-600 hover:bg-red-700">
                Run Migration
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tabs and Search */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Orders</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search orders..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="pl-9 w-64"
                  data-testid="dispatch-search"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setPage(1); }}>
            <TabsList className="mb-4">
              <TabsTrigger value="pending" data-testid="tab-pending">
                <Clock className="h-4 w-4 mr-2" />
                Pending ({summary.pending_dispatch})
              </TabsTrigger>
              <TabsTrigger value="dispatched" data-testid="tab-dispatched">
                <Package className="h-4 w-4 mr-2" />
                Dispatched ({summary.dispatched})
              </TabsTrigger>
              <TabsTrigger value="all" data-testid="tab-all">
                All ({summary.total_won})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : leads.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No orders found</p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Enquiry No</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>KVA</TableHead>
                        <TableHead>Won Date</TableHead>
                        <TableHead>Dispatch Status</TableHead>
                        <TableHead>Dispatch Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leads.map((lead) => (
                        <TableRow key={lead.lead_id}>
                          <TableCell className="font-medium">{lead.enquiry_no || '-'}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{lead.name || 'N/A'}</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Phone className="h-3 w-3" /> {lead.phone_number || '-'}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>{lead.kva || '-'} KVA</TableCell>
                          <TableCell>{lead.eo_po_date || lead.enquiry_closure_date || '-'}</TableCell>
                          <TableCell>
                            <Badge className={
                              lead.dispatch_status === 'dispatched' 
                                ? 'bg-blue-600' 
                                : lead.dispatch_status === 'pending' 
                                  ? 'bg-amber-600' 
                                  : 'bg-gray-400'
                            }>
                              {lead.dispatch_status || 'Not Set'}
                            </Badge>
                          </TableCell>
                          <TableCell>{lead.dispatch_date || '-'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {lead.dispatch_status === 'pending' ? (
                                <Button 
                                  size="sm" 
                                  onClick={() => openDispatchModal(lead, 'dispatched')}
                                  className="bg-blue-600 hover:bg-blue-700"
                                  data-testid={`dispatch-btn-${lead.lead_id}`}
                                >
                                  <Truck className="h-4 w-4 mr-1" /> Dispatch
                                </Button>
                              ) : (
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => openDispatchModal(lead, 'pending')}
                                  data-testid={`pending-btn-${lead.lead_id}`}
                                >
                                  <Clock className="h-4 w-4 mr-1" /> To Pending
                                </Button>
                              )}
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => fetchHistory(lead)}
                                data-testid={`history-btn-${lead.lead_id}`}
                              >
                                <History className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
                      <div className="flex items-center gap-2">
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
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dispatch Modal */}
      <Dialog open={dispatchModalOpen} onOpenChange={setDispatchModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {dispatchForm.dispatch_status === 'dispatched' ? (
                <><Truck className="h-5 w-5 text-blue-600" /> Mark as Dispatched</>
              ) : (
                <><Clock className="h-5 w-5 text-amber-600" /> Mark as Pending</>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedLead?.name} - {selectedLead?.enquiry_no}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {dispatchForm.dispatch_status === 'dispatched' && (
              <>
                <div>
                  <Label>Dispatch Date *</Label>
                  <Input
                    type="date"
                    value={dispatchForm.dispatch_date}
                    onChange={(e) => setDispatchForm(f => ({ ...f, dispatch_date: e.target.value }))}
                    min={selectedLead?.eo_po_date || selectedLead?.enquiry_closure_date}
                    data-testid="dispatch-date-input"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Cannot be before won date ({selectedLead?.eo_po_date || selectedLead?.enquiry_closure_date})
                  </p>
                </div>

                <div>
                  <Label>Delivery Address</Label>
                  <Textarea
                    value={dispatchForm.delivery_address}
                    onChange={(e) => setDispatchForm(f => ({ ...f, delivery_address: e.target.value }))}
                    placeholder="Enter delivery address..."
                    data-testid="delivery-address-input"
                  />
                </div>

                <div>
                  <Label>Transporter Details</Label>
                  <Textarea
                    value={dispatchForm.transporter_details}
                    onChange={(e) => setDispatchForm(f => ({ ...f, transporter_details: e.target.value }))}
                    placeholder="Enter transporter name, vehicle no, etc..."
                    data-testid="transporter-input"
                  />
                </div>
              </>
            )}

            {dispatchForm.dispatch_status === 'pending' && selectedLead?.dispatch_status === 'dispatched' && (
              <div>
                <Label>Reason for changing back to pending</Label>
                <Textarea
                  value={dispatchForm.reason}
                  onChange={(e) => setDispatchForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="Enter reason..."
                  data-testid="reason-input"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Reason may be required based on order history
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDispatchModalOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleDispatchSubmit} 
              disabled={submitting}
              className={dispatchForm.dispatch_status === 'dispatched' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-amber-600 hover:bg-amber-700'}
              data-testid="confirm-dispatch-btn"
            >
              {submitting ? 'Updating...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Modal */}
      <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" /> Dispatch History
            </DialogTitle>
            <DialogDescription>
              {selectedLead?.name} - {selectedLead?.enquiry_no}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {dispatchHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No history available</p>
            ) : (
              dispatchHistory.map((entry, idx) => (
                <div key={idx} className="p-3 border rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between">
                    <Badge className={entry.status === 'dispatched' ? 'bg-blue-600' : 'bg-amber-600'}>
                      {entry.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(entry.changed_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm mt-2">Changed by: {entry.changed_by}</p>
                  {entry.previous_status && (
                    <p className="text-xs text-muted-foreground">From: {entry.previous_status}</p>
                  )}
                  {entry.reason && (
                    <p className="text-sm mt-1 text-amber-600">Reason: {entry.reason}</p>
                  )}
                  {entry.dispatch_date && (
                    <p className="text-xs text-muted-foreground">Dispatch date: {entry.dispatch_date}</p>
                  )}
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dispatch;
