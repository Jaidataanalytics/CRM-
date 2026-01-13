import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, 
  FileText, 
  CheckCircle, 
  Clock, 
  XCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Calendar,
  IndianRupee,
  TrendingUp,
  ExternalLink,
  Eye
} from 'lucide-react';
import { format } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Quotations = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    loadQuotations();
    loadSummary();
  }, [activeTab, page, searchQuery]);

  const loadQuotations = async () => {
    setLoading(true);
    try {
      let url = `${API}/leads/quotations?page=${page}&limit=50&status=${activeTab}`;
      if (searchQuery.trim()) {
        url += `&search=${encodeURIComponent(searchQuery.trim())}`;
      }
      
      const res = await axios.get(url, { withCredentials: true });
      setQuotations(res.data.quotations || []);
      setTotal(res.data.total || 0);
      setTotalPages(res.data.pages || 1);
    } catch (error) {
      console.error('Error loading quotations:', error);
      toast.error('Failed to load quotations');
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const res = await axios.get(`${API}/leads/quotations/summary`, { withCredentials: true });
      setSummary(res.data);
    } catch (error) {
      console.error('Error loading summary:', error);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadQuotations();
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr), 'dd MMM yyyy');
    } catch {
      return dateStr;
    }
  };

  const formatAmount = (amount) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'pending': { color: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
      'won': { color: 'bg-green-100 text-green-800', label: 'Won' },
      'lost': { color: 'bg-red-100 text-red-800', label: 'Lost' },
      'expired': { color: 'bg-gray-100 text-gray-800', label: 'Expired' }
    };
    const config = statusMap[status] || statusMap['pending'];
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-8 w-8 text-blue-500" />
            Quotations
          </h1>
          <p className="text-muted-foreground mt-1">
            Track and manage quotations sent to leads
          </p>
        </div>
        <Button onClick={() => { loadQuotations(); loadSummary(); }} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
                <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Quotations</p>
                <p className="text-3xl font-bold">{summary?.total || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900 rounded-full">
                <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-3xl font-bold">{summary?.pending || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Won</p>
                <p className="text-3xl font-bold">{summary?.won || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-full">
                <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Conversion Rate</p>
                <p className="text-3xl font-bold">{summary?.conversion_rate || 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs and Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Quotation Pipeline</CardTitle>
              <CardDescription>
                Leads with quotations sent - track their progress
              </CardDescription>
            </div>
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, phone, quotation no..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <Button type="submit" variant="secondary" size="sm">
                Search
              </Button>
            </form>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setPage(1); }}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">All ({summary?.total || 0})</TabsTrigger>
              <TabsTrigger value="pending">Pending ({summary?.pending || 0})</TabsTrigger>
              <TabsTrigger value="won">Won ({summary?.won || 0})</TabsTrigger>
              <TabsTrigger value="lost">Lost ({summary?.lost || 0})</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12" />)}
                </div>
              ) : quotations.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <h3 className="font-medium text-lg mb-2">No Quotations Found</h3>
                  <p className="text-sm">
                    {searchQuery 
                      ? 'No quotations match your search criteria.' 
                      : 'No quotations have been sent yet. Upload SO data or mark leads with quotation_sent=Yes.'}
                  </p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Quotation No</TableHead>
                        <TableHead>Lead Name</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Date Sent</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {quotations.map((q) => (
                        <TableRow key={q.lead_id} className="hover:bg-muted/50">
                          <TableCell className="font-mono text-sm">
                            {q.quotation_no || q.enquiry_no || '-'}
                          </TableCell>
                          <TableCell className="font-medium">
                            {q.name || q.corporate_name || '-'}
                          </TableCell>
                          <TableCell>{q.phone_number || '-'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Calendar className="h-3 w-3" />
                              {formatDate(q.quotation_date)}
                            </div>
                          </TableCell>
                          <TableCell>
                            {q.quotation_amount ? (
                              <div className="flex items-center gap-1">
                                <IndianRupee className="h-3 w-3" />
                                {formatAmount(q.quotation_amount)}
                              </div>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{q.enquiry_stage || '-'}</Badge>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(q.quotation_status)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {((page - 1) * 50) + 1} - {Math.min(page * 50, total)} of {total}
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
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Quotations;
