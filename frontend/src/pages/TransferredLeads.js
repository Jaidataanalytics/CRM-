import { useState, useEffect } from 'react';
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
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ArrowLeftRight, Search, Undo2, Edit, Eye, Users, Calendar } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TransferredLeads = () => {
  const { dateRange } = useFilters();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState(null);
  
  // Lead detail panel
  const [selectedLead, setSelectedLead] = useState(null);
  const [showLeadDetail, setShowLeadDetail] = useState(false);
  
  // Untransfer dialog
  const [untransferLead, setUntransferLead] = useState(null);
  const [untransferring, setUntransferring] = useState(false);

  const loadTransferredLeads = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50'
      });
      
      if (dateRange?.startDate && dateRange?.endDate) {
        params.append('start_date', dateRange.startDate);
        params.append('end_date', dateRange.endDate);
      }
      
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }
      
      const res = await axios.get(`${API}/leads/transferred/list?${params}`, { withCredentials: true });
      setLeads(res.data.leads || []);
      setTotal(res.data.total || 0);
      setTotalPages(res.data.pages || 1);
    } catch (error) {
      console.error('Error loading transferred leads:', error);
      toast.error('Failed to load transferred leads');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const params = new URLSearchParams();
      if (dateRange?.startDate && dateRange?.endDate) {
        params.append('start_date', dateRange.startDate);
        params.append('end_date', dateRange.endDate);
      }
      
      const res = await axios.get(`${API}/leads/transferred/stats?${params}`, { withCredentials: true });
      setStats(res.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  useEffect(() => {
    loadTransferredLeads();
    loadStats();
  }, [page, dateRange]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadTransferredLeads();
  };

  const handleUntransfer = async () => {
    if (!untransferLead) return;
    
    setUntransferring(true);
    try {
      await axios.post(`${API}/leads/${untransferLead.lead_id}/untransfer`, {}, { withCredentials: true });
      toast.success('Lead transfer reversed successfully');
      setUntransferLead(null);
      loadTransferredLeads();
      loadStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reverse transfer');
    } finally {
      setUntransferring(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ArrowLeftRight className="h-6 w-6 text-primary" />
            Transferred Leads
          </h1>
          <p className="text-muted-foreground">
            BDM leads that have been transferred to dealers
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <ArrowLeftRight className="h-4 w-4 text-blue-500" />
              Total Transferred
            </div>
            <p className="text-3xl font-bold mt-1 text-blue-600">
              {stats?.total_transferred ?? total}
            </p>
          </CardContent>
        </Card>
        
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              By Employee (Top 5)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {stats?.by_employee?.slice(0, 5).map((emp, idx) => (
                <Badge key={idx} variant="outline" className="py-1 px-3">
                  <Users className="h-3 w-3 mr-1" />
                  {emp.employee}: {emp.count}
                </Badge>
              ))}
              {(!stats?.by_employee || stats.by_employee.length === 0) && (
                <span className="text-sm text-muted-foreground">No data</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone, enquiry no..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="submit">Search</Button>
      </form>

      {/* Leads Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : leads.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <ArrowLeftRight className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No transferred leads found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Enquiry No</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Transferred At</TableHead>
                  <TableHead>Transferred By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.lead_id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium">{lead.enquiry_no || '-'}</TableCell>
                    <TableCell>{lead.name || lead.corporate_name || '-'}</TableCell>
                    <TableCell>{lead.phone_number || '-'}</TableCell>
                    <TableCell>{lead.employee_name || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3" />
                        {formatDateTime(lead.transferred_at)}
                      </div>
                    </TableCell>
                    <TableCell>{lead.transferred_by || '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedLead(lead);
                            setShowLeadDetail(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setUntransferLead(lead)}
                        >
                          <Undo2 className="h-4 w-4 mr-1" />
                          Reverse
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing page {page} of {totalPages} ({total} total)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Untransfer Confirmation Dialog */}
      <Dialog open={!!untransferLead} onOpenChange={(open) => !open && setUntransferLead(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reverse Transfer</DialogTitle>
            <DialogDescription>
              Are you sure you want to reverse the transfer for this lead? The lead will be moved back to the regular leads list.
            </DialogDescription>
          </DialogHeader>
          {untransferLead && (
            <div className="py-4 space-y-2">
              <p><strong>Name:</strong> {untransferLead.name || untransferLead.enquiry_no}</p>
              <p><strong>Phone:</strong> {untransferLead.phone_number || '-'}</p>
              <p><strong>Transferred At:</strong> {formatDateTime(untransferLead.transferred_at)}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setUntransferLead(null)}>
              Cancel
            </Button>
            <Button onClick={handleUntransfer} disabled={untransferring}>
              {untransferring ? 'Reversing...' : 'Reverse Transfer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lead Detail Sheet */}
      <Sheet open={showLeadDetail} onOpenChange={setShowLeadDetail}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Badge className="bg-blue-500">Transferred</Badge>
              {selectedLead?.name || selectedLead?.enquiry_no}
            </SheetTitle>
            <SheetDescription>
              Transferred to dealer on {formatDateTime(selectedLead?.transferred_at)}
            </SheetDescription>
          </SheetHeader>
          
          {selectedLead && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Name</Label>
                  <p className="font-medium">{selectedLead.name || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Phone</Label>
                  <p className="font-medium">{selectedLead.phone_number || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <p className="font-medium">{selectedLead.email_address || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Enquiry No</Label>
                  <p className="font-medium">{selectedLead.enquiry_no || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Enquiry Date</Label>
                  <p className="font-medium">{formatDate(selectedLead.enquiry_date)}</p>
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
                  <Label className="text-xs text-muted-foreground">State</Label>
                  <p className="font-medium">{selectedLead.state || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Segment</Label>
                  <p className="font-medium">{selectedLead.segment || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">KVA</Label>
                  <p className="font-medium">{selectedLead.kva || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Stage</Label>
                  <p className="font-medium">{selectedLead.enquiry_stage || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <p className="font-medium">{selectedLead.enquiry_status || '-'}</p>
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <Label className="text-xs text-muted-foreground">Transfer Info</Label>
                <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                  <p className="text-sm"><strong>Transferred By:</strong> {selectedLead.transferred_by || '-'}</p>
                  <p className="text-sm"><strong>Transferred At:</strong> {formatDateTime(selectedLead.transferred_at)}</p>
                </div>
              </div>
              
              {selectedLead.remarks && (
                <div>
                  <Label className="text-xs text-muted-foreground">Remarks</Label>
                  <p className="mt-1 text-sm p-2 bg-muted rounded">{selectedLead.remarks}</p>
                </div>
              )}
              
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => {
                  setUntransferLead(selectedLead);
                  setShowLeadDetail(false);
                }}
              >
                <Undo2 className="h-4 w-4 mr-2" />
                Reverse Transfer
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default TransferredLeads;
