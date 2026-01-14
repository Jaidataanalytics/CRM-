import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, 
  X, 
  Copy, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle,
  Eye,
  Trash2,
  GitMerge,
  Database,
  Zap,
  Timer
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DuplicateLeads = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('duplicates');
  
  // Duplicates state
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDuplicates, setTotalDuplicates] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [runningDetection, setRunningDetection] = useState(false);
  
  // Merge History state
  const [mergedLeads, setMergedLeads] = useState([]);
  const [mergeLoading, setMergeLoading] = useState(false);
  const [mergePage, setMergePage] = useState(1);
  const [mergeTotalPages, setMergeTotalPages] = useState(1);
  const [totalMerged, setTotalMerged] = useState(0);
  const [mergeSearchQuery, setMergeSearchQuery] = useState('');
  const [mergeSummary, setMergeSummary] = useState(null);
  
  // Order Time Punch state
  const [timePunchLeads, setTimePunchLeads] = useState([]);
  const [timePunchLoading, setTimePunchLoading] = useState(false);
  const [timePunchPage, setTimePunchPage] = useState(1);
  const [timePunchTotalPages, setTimePunchTotalPages] = useState(1);
  const [totalTimePunch, setTotalTimePunch] = useState(0);
  const [timePunchSearchQuery, setTimePunchSearchQuery] = useState('');
  const [timePunchSummary, setTimePunchSummary] = useState(null);
  
  // Load all counts on mount
  useEffect(() => {
    loadAllCounts();
  }, []);
  
  const loadAllCounts = async () => {
    try {
      // Load duplicate count
      const dupRes = await axios.get(`${API}/leads/duplicates?limit=1`, { withCredentials: true });
      setTotalDuplicates(dupRes.data.total || 0);
      
      // Load merge count
      const mergeRes = await axios.get(`${API}/leads/merge-history?limit=1`, { withCredentials: true });
      setTotalMerged(mergeRes.data.total || 0);
      
      // Load time punch count
      const tpRes = await axios.get(`${API}/leads/order-time-punch?limit=1`, { withCredentials: true });
      setTotalTimePunch(tpRes.data.total || 0);
    } catch (error) {
      console.error('Error loading counts:', error);
    }
  };
  
  // Lead detail panel
  const [selectedLead, setSelectedLead] = useState(null);
  const [showLeadDetail, setShowLeadDetail] = useState(false);
  const [originalLead, setOriginalLead] = useState(null);
  
  // Unflag confirmation
  const [unflagLead, setUnflagLead] = useState(null);
  const [unflagging, setUnflagging] = useState(false);

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';

  useEffect(() => {
    if (activeTab === 'duplicates') {
      loadDuplicates();
    } else if (activeTab === 'merge-history') {
      loadMergeHistory();
      loadMergeSummary();
    } else if (activeTab === 'time-punch') {
      loadTimePunchLeads();
      loadTimePunchSummary();
    }
  }, [activeTab, page, searchQuery, mergePage, mergeSearchQuery, timePunchPage, timePunchSearchQuery]);

  const loadDuplicates = async () => {
    setLoading(true);
    try {
      let url = `${API}/leads/duplicates?page=${page}&limit=50`;
      if (searchQuery.trim()) {
        url += `&search=${encodeURIComponent(searchQuery.trim())}`;
      }
      
      const res = await axios.get(url, { withCredentials: true });
      setLeads(res.data.leads || []);
      setTotalDuplicates(res.data.total || 0);
      setTotalPages(res.data.pages || 1);
    } catch (error) {
      console.error('Error loading duplicates:', error);
      toast.error('Failed to load duplicate leads');
    } finally {
      setLoading(false);
    }
  };

  const loadMergeHistory = async () => {
    setMergeLoading(true);
    try {
      let url = `${API}/leads/merge-history?page=${mergePage}&limit=50`;
      if (mergeSearchQuery.trim()) {
        url += `&search=${encodeURIComponent(mergeSearchQuery.trim())}`;
      }
      
      const res = await axios.get(url, { withCredentials: true });
      setMergedLeads(res.data.leads || []);
      setTotalMerged(res.data.total || 0);
      setMergeTotalPages(res.data.pages || 1);
    } catch (error) {
      console.error('Error loading merge history:', error);
      toast.error('Failed to load merge history');
    } finally {
      setMergeLoading(false);
    }
  };

  const loadMergeSummary = async () => {
    try {
      const res = await axios.get(`${API}/leads/merge-history/summary`, { withCredentials: true });
      setMergeSummary(res.data);
    } catch (error) {
      console.error('Error loading merge summary:', error);
    }
  };

  const loadTimePunchLeads = async () => {
    setTimePunchLoading(true);
    try {
      let url = `${API}/leads/order-time-punch?page=${timePunchPage}&limit=50`;
      if (timePunchSearchQuery.trim()) {
        url += `&search=${encodeURIComponent(timePunchSearchQuery.trim())}`;
      }
      
      const res = await axios.get(url, { withCredentials: true });
      setTimePunchLeads(res.data.leads || []);
      setTotalTimePunch(res.data.total || 0);
      setTimePunchTotalPages(res.data.pages || 1);
    } catch (error) {
      console.error('Error loading order time punch leads:', error);
      toast.error('Failed to load order time punch leads');
    } finally {
      setTimePunchLoading(false);
    }
  };

  const loadTimePunchSummary = async () => {
    try {
      const res = await axios.get(`${API}/leads/order-time-punch/summary`, { withCredentials: true });
      setTimePunchSummary(res.data);
    } catch (error) {
      console.error('Error loading time punch summary:', error);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadDuplicates();
  };

  const clearSearch = () => {
    setSearchQuery('');
    setPage(1);
  };

  const handleRunDetection = async () => {
    if (!isAdmin) {
      toast.error('Only admin can run duplicate detection');
      return;
    }
    
    setRunningDetection(true);
    try {
      const res = await axios.post(`${API}/leads/duplicates/run-detection`, {}, { withCredentials: true });
      toast.success(`Detection complete: ${res.data.duplicates_flagged} duplicates found`);
      loadDuplicates();
    } catch (error) {
      console.error('Error running detection:', error);
      toast.error(error.response?.data?.detail || 'Failed to run duplicate detection');
    } finally {
      setRunningDetection(false);
    }
  };

  const handleUnflag = async () => {
    if (!unflagLead) return;
    
    setUnflagging(true);
    try {
      await axios.post(`${API}/leads/duplicates/${unflagLead.lead_id}/unflag`, {}, { withCredentials: true });
      toast.success('Lead unflagged successfully');
      setUnflagLead(null);
      loadDuplicates();
    } catch (error) {
      console.error('Error unflagging lead:', error);
      toast.error(error.response?.data?.detail || 'Failed to unflag lead');
    } finally {
      setUnflagging(false);
    }
  };

  const handleViewLead = async (lead) => {
    setSelectedLead(lead);
    setShowLeadDetail(true);
    
    // Load original lead if available
    if (lead.original_lead_id) {
      try {
        const res = await axios.get(`${API}/leads/${lead.original_lead_id}`, { withCredentials: true });
        setOriginalLead(res.data);
      } catch (error) {
        console.error('Error loading original lead:', error);
        setOriginalLead(null);
      }
    } else {
      setOriginalLead(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  if (loading && leads.length === 0 && activeTab === 'duplicates') {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight flex items-center gap-2">
            <Database className="h-8 w-8 text-orange-500" />
            Data Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage duplicate leads and view data consolidation history
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="duplicates" className="flex items-center gap-2">
            <Copy className="h-4 w-4" />
            Duplicate Leads ({totalDuplicates})
          </TabsTrigger>
          <TabsTrigger value="merge-history" className="flex items-center gap-2">
            <GitMerge className="h-4 w-4" />
            Merge History ({totalMerged})
          </TabsTrigger>
          <TabsTrigger value="time-punch" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Order Time Punch ({totalTimePunch})
          </TabsTrigger>
        </TabsList>

        {/* Duplicates Tab */}
        <TabsContent value="duplicates" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Leads identified as potential duplicates based on Phone + Employee Name + Corporate Name
            </p>
            <div className="flex gap-2">
              {/* Search */}
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search duplicates..."
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
          
              {isAdmin && (
                <Button
                  onClick={handleRunDetection}
                  disabled={runningDetection}
                  variant="outline"
                  className="gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${runningDetection ? 'animate-spin' : ''}`} />
                  {runningDetection ? 'Running...' : 'Run Detection'}
                </Button>
              )}
            </div>
          </div>

      {/* Summary Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-full">
                <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Duplicate Leads</p>
                <p className="text-3xl font-bold">{totalDuplicates.toLocaleString()}</p>
              </div>
            </div>
            <div className="text-sm text-muted-foreground max-w-md">
              <p>
                <strong>Note:</strong> These leads have been automatically flagged as duplicates. 
                The newest lead with matching criteria is kept as the "original" and older matches are flagged here.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Duplicates Table */}
      <Card>
        <CardHeader>
          <CardTitle>Flagged Duplicates</CardTitle>
          <CardDescription>
            Leads excluded from all KPIs, dashboards, and follow-ups
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : leads.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
              <h3 className="font-medium text-lg mb-2">No Duplicates Found</h3>
              <p className="text-sm">
                {searchQuery 
                  ? 'No duplicates match your search criteria.' 
                  : 'Great! No duplicate leads have been detected in your database.'}
              </p>
              {isAdmin && (
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={handleRunDetection}
                  disabled={runningDetection}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${runningDetection ? 'animate-spin' : ''}`} />
                  Run Detection Again
                </Button>
              )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Enquiry No</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Corporate Name</TableHead>
                    <TableHead>Detected At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => (
                    <TableRow key={lead.lead_id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-sm">{lead.enquiry_no || '-'}</TableCell>
                      <TableCell className="font-medium">{lead.name || lead.corporate_name || '-'}</TableCell>
                      <TableCell>{lead.phone_number || '-'}</TableCell>
                      <TableCell>{lead.employee_name || '-'}</TableCell>
                      <TableCell>{lead.corporate_name || '-'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(lead.duplicate_detected_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleViewLead(lead)}
                            title="View Details"
                          >
                            <Eye className="h-4 w-4 text-blue-600" />
                          </Button>
                          {(isAdmin || isManager) && (
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => setUnflagLead(lead)}
                              title="Unflag (Remove from duplicates)"
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {((page - 1) * 50) + 1} - {Math.min(page * 50, totalDuplicates)} of {totalDuplicates}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        {/* Merge History Tab */}
        <TabsContent value="merge-history" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Leads that have been consolidated from multiple data sources (uploads with same phone number)
            </p>
            <div className="flex gap-2">
              {/* Merge Search */}
              <form onSubmit={(e) => { e.preventDefault(); setMergePage(1); loadMergeHistory(); }} className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search merged leads..."
                    value={mergeSearchQuery}
                    onChange={(e) => setMergeSearchQuery(e.target.value)}
                    className="pl-9 w-48"
                  />
                  {mergeSearchQuery && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                      onClick={() => { setMergeSearchQuery(''); setMergePage(1); }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <Button type="submit" variant="secondary" size="sm">
                  Search
                </Button>
              </form>
              <Button
                onClick={() => { loadMergeHistory(); loadMergeSummary(); }}
                disabled={mergeLoading}
                variant="outline"
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${mergeLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Merge Summary Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
                    <GitMerge className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Consolidated Leads</p>
                    <p className="text-3xl font-bold">{mergeSummary?.total_merged_leads?.toLocaleString() || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
                    <Database className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Alt. Enquiry Numbers</p>
                    <p className="text-3xl font-bold">{mergeSummary?.total_alternative_enquiry_nos?.toLocaleString() || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-full">
                    <CheckCircle className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Sources per Lead</p>
                    <p className="text-3xl font-bold">{(mergeSummary?.consolidation_ratio + 1)?.toFixed(1) || '-'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Merged Leads Table */}
          <Card>
            <CardHeader>
              <CardTitle>Consolidated Lead Records</CardTitle>
              <CardDescription>
                These leads have been merged from multiple uploads (matched by phone number)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {mergeLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12" />)}
                </div>
              ) : mergedLeads.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <GitMerge className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <h3 className="font-medium text-lg mb-2">No Merged Leads</h3>
                  <p className="text-sm">
                    {mergeSearchQuery 
                      ? 'No merged leads match your search criteria.' 
                      : 'No leads have been consolidated from multiple uploads yet.'}
                  </p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Enquiry No</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead>Alternative Enquiry Nos</TableHead>
                        <TableHead className="text-right">Sources</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mergedLeads.map((lead) => (
                        <TableRow key={lead.lead_id} className="hover:bg-muted/50">
                          <TableCell className="font-mono text-sm">{lead.enquiry_no || '-'}</TableCell>
                          <TableCell className="font-medium">{lead.name || lead.corporate_name || '-'}</TableCell>
                          <TableCell>{lead.phone_number || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{lead.enquiry_stage || '-'}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {(lead.alternative_enquiry_nos || []).slice(0, 3).map((enq, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {enq}
                                </Badge>
                              ))}
                              {(lead.alternative_enquiry_nos || []).length > 3 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{lead.alternative_enquiry_nos.length - 3} more
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                              {(lead.merge_count || 0) + 1}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Merge Pagination */}
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {((mergePage - 1) * 50) + 1} - {Math.min(mergePage * 50, totalMerged)} of {totalMerged}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setMergePage(p => Math.max(1, p - 1))}
                        disabled={mergePage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setMergePage(p => Math.min(mergeTotalPages, p + 1))}
                        disabled={mergePage >= mergeTotalPages}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Order Time Punch Tab */}
        <TabsContent value="time-punch" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Leads closed within 2 days of creation (quick wins / time punch orders)
            </p>
            <div className="flex gap-2">
              {/* Search */}
              <form onSubmit={(e) => { e.preventDefault(); setTimePunchPage(1); }} className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search leads..."
                    value={timePunchSearchQuery}
                    onChange={(e) => setTimePunchSearchQuery(e.target.value)}
                    className="pl-9 w-48"
                  />
                  {timePunchSearchQuery && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                      onClick={() => { setTimePunchSearchQuery(''); setTimePunchPage(1); }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <Button type="submit" variant="secondary" size="sm">
                  Search
                </Button>
              </form>
            </div>
          </div>

          {/* Summary Cards */}
          {timePunchSummary && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold">{timePunchSummary.total_count || 0}</div>
                  <p className="text-xs text-muted-foreground">Total Orders</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold">{timePunchSummary.total_qty || 0}</div>
                  <p className="text-xs text-muted-foreground">Total Qty</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-green-600">{timePunchSummary.same_day || 0}</div>
                  <p className="text-xs text-muted-foreground">Same Day</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-blue-600">{timePunchSummary.one_day || 0}</div>
                  <p className="text-xs text-muted-foreground">1 Day</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-orange-600">{timePunchSummary.two_days || 0}</div>
                  <p className="text-xs text-muted-foreground">2 Days</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Time Punch Leads Table */}
          <Card>
            <CardContent className="p-0">
              {timePunchLoading ? (
                <div className="p-4 space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : timePunchLeads.length === 0 ? (
                <div className="p-8 text-center">
                  <Zap className="h-12 w-12 mx-auto text-muted-foreground/50" />
                  <p className="mt-4 text-muted-foreground">No Order Time Punch leads found</p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Enquiry No</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Dealer</TableHead>
                        <TableHead>Enquiry Date</TableHead>
                        <TableHead>Won Date</TableHead>
                        <TableHead className="text-center">Days</TableHead>
                        <TableHead>KVA</TableHead>
                        <TableHead>Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {timePunchLeads.map((lead) => (
                        <TableRow key={lead.lead_id}>
                          <TableCell className="font-mono text-xs">{lead.enquiry_no}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{lead.name}</div>
                              <div className="text-xs text-muted-foreground">{lead.phone_number}</div>
                            </div>
                          </TableCell>
                          <TableCell>{lead.dealer}</TableCell>
                          <TableCell>{lead.enquiry_date}</TableCell>
                          <TableCell>{lead.won_date}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={lead.days_to_close === 0 ? "success" : lead.days_to_close <= 1 ? "default" : "secondary"}>
                              {Math.round(lead.days_to_close)}
                            </Badge>
                          </TableCell>
                          <TableCell>{lead.kva}</TableCell>
                          <TableCell>{lead.won_qty || 1}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <p className="text-sm text-muted-foreground">
                      Showing {((timePunchPage - 1) * 50) + 1} - {Math.min(timePunchPage * 50, totalTimePunch)} of {totalTimePunch}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setTimePunchPage(p => Math.max(1, p - 1))}
                        disabled={timePunchPage <= 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="flex items-center px-2 text-sm">
                        {timePunchPage} / {timePunchTotalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setTimePunchPage(p => Math.min(timePunchTotalPages, p + 1))}
                        disabled={timePunchPage >= timePunchTotalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Lead Detail Sheet */}
      <Sheet open={showLeadDetail} onOpenChange={setShowLeadDetail}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Duplicate Lead Details</SheetTitle>
            <SheetDescription>
              Lead flagged as duplicate of another entry
            </SheetDescription>
          </SheetHeader>
          
          {selectedLead && (
            <div className="mt-6 space-y-6">
              <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">Flagged as Duplicate</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Detected on {formatDate(selectedLead.duplicate_detected_at)}
                </p>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground">Lead Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Name</p>
                    <p className="font-medium">{selectedLead.name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Phone</p>
                    <p className="font-medium">{selectedLead.phone_number || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Employee Name</p>
                    <p className="font-medium">{selectedLead.employee_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Corporate Name</p>
                    <p className="font-medium">{selectedLead.corporate_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Enquiry No</p>
                    <p className="font-medium font-mono">{selectedLead.enquiry_no || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Enquiry Date</p>
                    <p className="font-medium">{selectedLead.enquiry_date || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">State</p>
                    <p className="font-medium">{selectedLead.state || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Dealer</p>
                    <p className="font-medium">{selectedLead.dealer || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Stage</p>
                    <Badge variant="outline">{selectedLead.enquiry_stage || '-'}</Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">KVA</p>
                    <p className="font-medium">{selectedLead.kva || '-'}</p>
                  </div>
                </div>
              </div>

              {originalLead && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Original Lead (Kept)
                    </h4>
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Name</p>
                          <p className="font-medium">{originalLead.name || '-'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Phone</p>
                          <p className="font-medium">{originalLead.phone_number || '-'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Enquiry No</p>
                          <p className="font-medium font-mono">{originalLead.enquiry_no || '-'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Created At</p>
                          <p className="font-medium">{formatDate(originalLead.created_at)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {(isAdmin || isManager) && (
                <div className="pt-4">
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => {
                      setShowLeadDetail(false);
                      setUnflagLead(selectedLead);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove Duplicate Flag
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Unflag Confirmation Dialog */}
      <AlertDialog open={!!unflagLead} onOpenChange={(open) => !open && setUnflagLead(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Duplicate Flag?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore the lead to the main leads list. It will be included in KPIs, 
              dashboards, and follow-ups again.
              <br /><br />
              <strong>Lead:</strong> {unflagLead?.name || unflagLead?.enquiry_no}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnflag} disabled={unflagging}>
              {unflagging ? 'Removing...' : 'Remove Flag'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DuplicateLeads;
