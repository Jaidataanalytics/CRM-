import { useState, useEffect } from 'react';
import axios from 'axios';
import { useFilters } from '@/context/FilterContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { 
  ArrowLeftRight, Search, Undo2, Edit, Eye, Users, Calendar, 
  Building2, CheckCircle2, XCircle, Clock, Link2, RefreshCw,
  TrendingUp, BarChart3, Download
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ExportButton } from '@/components/ui/export-button';

const API = '/api';

const TransferredLeads = () => {
  const { dateRange } = useFilters();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  
  // Lead detail panel
  const [selectedLead, setSelectedLead] = useState(null);
  const [showLeadDetail, setShowLeadDetail] = useState(false);
  const [linkedLead, setLinkedLead] = useState(null);
  
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

  const handleViewLead = async (lead) => {
    setSelectedLead(lead);
    setShowLeadDetail(true);
    
    // If linked, fetch the linked lead details
    if (lead.linked_dealer_lead_id) {
      try {
        const res = await axios.get(`${API}/leads/${lead.linked_dealer_lead_id}`, { withCredentials: true });
        setLinkedLead(res.data);
      } catch (error) {
        console.error('Error fetching linked lead:', error);
        setLinkedLead(null);
      }
    } else {
      setLinkedLead(null);
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

  const getStatusBadge = (lead) => {
    if (!lead.linked_dealer_lead_id) {
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pending</Badge>;
    }
    return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Linked</Badge>;
  };

  const getDealerLeadStatus = (linkedLead) => {
    if (!linkedLead) return null;
    
    const stage = linkedLead.enquiry_stage;
    if (stage === 'Closed-Won' || stage === 'Order Booked') {
      return <Badge className="bg-green-500">Won</Badge>;
    } else if (stage === 'Closed-Lost' || stage === 'Closed-Dropped') {
      return <Badge className="bg-red-500">Lost</Badge>;
    } else if (linkedLead.enquiry_status === 'Open') {
      return <Badge className="bg-blue-500">Open</Badge>;
    }
    return <Badge variant="outline">{stage}</Badge>;
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
            Leads transferred to dealers - track their progress and conversion
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            data={leads}
            filename="transferred_leads"
            sheetName="Transferred Leads"
            columns={[
              { key: 'enquiry_no', header: 'Enquiry No', width: 15 },
              { key: 'name', header: 'Customer Name', width: 20 },
              { key: 'phone_number', header: 'Phone', width: 15 },
              { key: 'transferred_to_dealer_name', header: 'Target Dealer', width: 20 },
              { key: 'transferred_by_employee', header: 'Original Generator', width: 20 },
              { key: 'transferred_at', header: 'Transfer Date', width: 18 },
              { key: 'transfer_notes', header: 'Notes', width: 25 },
              { key: 'kva', header: 'KVA', width: 10 },
              { key: 'segment', header: 'Segment', width: 15 },
              { key: 'state', header: 'State', width: 15 },
              { key: 'district', header: 'District', width: 15 }
            ]}
            size="sm"
          >
            Export to Excel
          </ExportButton>
          <Button variant="outline" size="sm" onClick={() => { loadTransferredLeads(); loadStats(); }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-blue-600 text-sm font-medium">
              <ArrowLeftRight className="h-4 w-4" />
              Total Transferred
            </div>
            <p className="text-3xl font-bold mt-1 text-blue-700">
              {stats?.total_transferred ?? total}
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
              <Link2 className="h-4 w-4" />
              Linked (Re-uploaded)
            </div>
            <p className="text-3xl font-bold mt-1 text-green-700">
              {stats?.total_linked ?? 0}
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-yellow-600 text-sm font-medium">
              <Clock className="h-4 w-4" />
              Pending
            </div>
            <p className="text-3xl font-bold mt-1 text-yellow-700">
              {stats?.total_pending ?? 0}
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4" />
              Won
            </div>
            <p className="text-3xl font-bold mt-1 text-emerald-700">
              {stats?.won_count ?? 0}
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-red-50 to-rose-50 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-600 text-sm font-medium">
              <XCircle className="h-4 w-4" />
              Lost
            </div>
            <p className="text-3xl font-bold mt-1 text-red-700">
              {stats?.lost_count ?? 0}
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-sky-50 to-cyan-50 border-sky-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sky-600 text-sm font-medium">
              <TrendingUp className="h-4 w-4" />
              Open
            </div>
            <p className="text-3xl font-bold mt-1 text-sky-700">
              {stats?.open_count ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all" className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4" />
            All Leads ({stats?.total_transferred ?? total})
          </TabsTrigger>
          <TabsTrigger value="by-employee" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            By Employee
          </TabsTrigger>
          <TabsTrigger value="by-dealer" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            By Dealer
          </TabsTrigger>
        </TabsList>

        {/* All Leads Tab */}
        <TabsContent value="all" className="space-y-4">
          {/* Search */}
          <Card>
            <CardContent className="pt-4">
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, phone, enquiry no, employee..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button type="submit">Search</Button>
              </form>
            </CardContent>
          </Card>

          {/* Leads Table */}
          <Card>
            <CardContent className="pt-4">
              {loading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : leads.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No transferred leads found
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Enquiry No</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Target Dealer</TableHead>
                        <TableHead>Original Generator</TableHead>
                        <TableHead>Transferred Date</TableHead>
                        <TableHead>Link Status</TableHead>
                        <TableHead>Dealer Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leads.map((lead) => (
                        <TableRow 
                          key={lead.lead_id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleViewLead(lead)}
                        >
                          <TableCell className="font-mono text-sm">{lead.enquiry_no || '-'}</TableCell>
                          <TableCell className="font-medium">{lead.name || lead.corporate_name || '-'}</TableCell>
                          <TableCell>{lead.phone_number || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-blue-50">
                              {lead.transferred_to_dealer_name || lead.dealer || '-'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-purple-50">
                              {lead.transferred_by_employee || lead.employee_name || '-'}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(lead.transferred_at)}</TableCell>
                          <TableCell>{getStatusBadge(lead)}</TableCell>
                          <TableCell>
                            {lead.linked_dealer_lead_id ? (
                              <Badge variant="outline">View Details →</Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleViewLead(lead)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {!lead.linked_dealer_lead_id && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setUntransferLead(lead)}
                                  className="text-orange-500 hover:text-orange-600"
                                >
                                  <Undo2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex justify-center gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        Previous
                      </Button>
                      <span className="py-2 px-4 text-sm">
                        Page {page} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* By Employee Tab */}
        <TabsContent value="by-employee" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Transfers by Original Generator
              </CardTitle>
              <CardDescription>
                Shows which employees generated the leads that were transferred
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats?.by_employee && stats.by_employee.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead className="text-center">Total Transferred</TableHead>
                      <TableHead className="text-center text-green-600">Linked</TableHead>
                      <TableHead className="text-center text-yellow-600">Pending</TableHead>
                      <TableHead className="text-center">Conversion Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.by_employee.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{item.employee}</TableCell>
                        <TableCell className="text-center">{item.count}</TableCell>
                        <TableCell className="text-center text-green-600 font-medium">{item.linked_count}</TableCell>
                        <TableCell className="text-center text-yellow-600">{item.pending_count}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">
                            {item.count > 0 ? Math.round((item.linked_count / item.count) * 100) : 0}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No employee data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* By Dealer Tab */}
        <TabsContent value="by-dealer" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Transfers by Target Dealer
              </CardTitle>
              <CardDescription>
                Shows which dealers received transferred leads and their performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats?.by_dealer && stats.by_dealer.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dealer</TableHead>
                      <TableHead className="text-center">Total Received</TableHead>
                      <TableHead className="text-center text-green-600">Re-uploaded</TableHead>
                      <TableHead className="text-center text-yellow-600">Pending</TableHead>
                      <TableHead className="text-center">Response Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.by_dealer.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{item.dealer}</TableCell>
                        <TableCell className="text-center">{item.count}</TableCell>
                        <TableCell className="text-center text-green-600 font-medium">{item.linked_count}</TableCell>
                        <TableCell className="text-center text-yellow-600">{item.pending_count}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={
                            (item.linked_count / item.count) >= 0.7 ? 'bg-green-50 text-green-700' :
                            (item.linked_count / item.count) >= 0.4 ? 'bg-yellow-50 text-yellow-700' :
                            'bg-red-50 text-red-700'
                          }>
                            {item.count > 0 ? Math.round((item.linked_count / item.count) * 100) : 0}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No dealer data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Lead Detail Sheet */}
      <Sheet open={showLeadDetail} onOpenChange={setShowLeadDetail}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Transferred Lead Details</SheetTitle>
            <SheetDescription>
              {selectedLead?.enquiry_no} - {selectedLead?.name || selectedLead?.corporate_name}
            </SheetDescription>
          </SheetHeader>
          
          {selectedLead && (
            <div className="space-y-6 mt-6">
              {/* Transfer Info */}
              <Card className="bg-blue-50 border-blue-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-blue-700">Transfer Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <Label className="text-xs text-muted-foreground">Target Dealer</Label>
                      <p className="font-medium">{selectedLead.transferred_to_dealer_name || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Original Generator</Label>
                      <p className="font-medium">{selectedLead.transferred_by_employee || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Transferred On</Label>
                      <p className="font-medium">{formatDateTime(selectedLead.transferred_at)}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Transferred By User</Label>
                      <p className="font-medium">{selectedLead.transferred_by_user || '-'}</p>
                    </div>
                  </div>
                  {selectedLead.transfer_notes && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Notes</Label>
                      <p className="text-sm bg-white p-2 rounded border mt-1">{selectedLead.transfer_notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Original Lead Info */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Original Lead</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Enquiry No</Label>
                      <p className="font-medium">{selectedLead.enquiry_no || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Name</Label>
                      <p className="font-medium">{selectedLead.name || selectedLead.corporate_name || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Phone</Label>
                      <p className="font-medium">{selectedLead.phone_number || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">KVA</Label>
                      <p className="font-medium">{selectedLead.kva || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Segment</Label>
                      <p className="font-medium">{selectedLead.segment || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">District</Label>
                      <p className="font-medium">{selectedLead.district || '-'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Linked Dealer Lead Info */}
              {selectedLead.linked_dealer_lead_id ? (
                <Card className="bg-green-50 border-green-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-green-700 flex items-center gap-2">
                      <Link2 className="h-4 w-4" />
                      Dealer's Re-uploaded Lead
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {linkedLead ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">Dealer's Enquiry No</Label>
                          <p className="font-medium">{linkedLead.enquiry_no || '-'}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Status</Label>
                          <p className="font-medium">{getDealerLeadStatus(linkedLead)}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Stage</Label>
                          <p className="font-medium">{linkedLead.enquiry_stage || '-'}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Enquiry Date</Label>
                          <p className="font-medium">{formatDate(linkedLead.enquiry_date)}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">KVA</Label>
                          <p className="font-medium">{linkedLead.kva || '-'}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Employee</Label>
                          <p className="font-medium">{linkedLead.employee_name || '-'}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4 mt-2" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-yellow-50 border-yellow-200">
                  <CardContent className="py-6 text-center">
                    <Clock className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                    <p className="text-yellow-700 font-medium">Pending Re-upload</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Dealer hasn't uploaded this lead yet
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Untransfer Dialog */}
      <Dialog open={!!untransferLead} onOpenChange={() => setUntransferLead(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reverse Transfer</DialogTitle>
            <DialogDescription>
              This will bring the lead back from transferred status. The lead will be counted in regular KPIs again.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm">
              <strong>Lead:</strong> {untransferLead?.enquiry_no} - {untransferLead?.name || untransferLead?.corporate_name}
            </p>
            <p className="text-sm mt-2">
              <strong>Target Dealer:</strong> {untransferLead?.transferred_to_dealer_name || '-'}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUntransferLead(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleUntransfer}
              disabled={untransferring}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {untransferring ? 'Reversing...' : 'Reverse Transfer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TransferredLeads;
