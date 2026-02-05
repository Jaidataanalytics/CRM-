import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useFilters } from '@/context/FilterContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  TrendingUp, TrendingDown, Minus, Plus, MapPin, Building, Users, User,
  Target, BarChart3, Trash2, Save, RefreshCw, Map, Globe, Download,
  Upload, FileSpreadsheet, Edit, X, Zap, AlertCircle
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { ExportButton } from '@/components/ui/export-button';

const API = '/api';

const Comparison = () => {
  const { buildQueryParams } = useFilters();
  const [loading, setLoading] = useState(true);
  const [comparisonData, setComparisonData] = useState([]);
  const [totals, setTotals] = useState({});
  const [dateRange, setDateRange] = useState({});
  const [compareBy, setCompareBy] = useState('district');
  const [potentialSummary, setPotentialSummary] = useState(null);
  
  // District/KVA management
  const [districtData, setDistrictData] = useState([]);
  const [kvaData, setKvaData] = useState([]);
  const [managementTab, setManagementTab] = useState('districts');
  
  // Upload state
  const [uploading, setUploading] = useState(false);
  
  // Add/Edit dialogs
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [newEntry, setNewEntry] = useState({
    dealer: '',
    district: '',
    state: '',
    potential: '',
    kva_range: '',
    market_size: ''
  });
  
  // Targets state
  const [targets, setTargets] = useState(null);
  const [allTargets, setAllTargets] = useState({ organization: [], dealer: [], employee: [] });
  const [targetsFiscalYear, setTargetsFiscalYear] = useState(() => {
    const now = new Date();
    if (now.getMonth() >= 3) return `${now.getFullYear()}-${String(now.getFullYear() + 1).slice(2)}`;
    return `${now.getFullYear() - 1}-${String(now.getFullYear()).slice(2)}`;
  });
  const [savingTargets, setSavingTargets] = useState(false);
  const [editTargets, setEditTargets] = useState({
    yearly: { leads: 0, closures: 0 },
    half_yearly: { H1: { leads: 0, closures: 0 }, H2: { leads: 0, closures: 0 } },
    quarterly: { Q1: { leads: 0, closures: 0 }, Q2: { leads: 0, closures: 0 }, Q3: { leads: 0, closures: 0 }, Q4: { leads: 0, closures: 0 } },
    monthly: {}
  });
  const [targetsTab, setTargetsTab] = useState('yearly');
  const [entityType, setEntityType] = useState('organization'); // organization, dealer, employee
  const [selectedEntityId, setSelectedEntityId] = useState('org');
  const [selectedEntityName, setSelectedEntityName] = useState('Organization');
  const [dealersList, setDealersList] = useState([]);
  const [employeesList, setEmployeesList] = useState([]);

  useEffect(() => {
    loadPotentialSummary();
    loadDistrictData();
    loadKvaData();
    loadTargets();
  }, []);

  useEffect(() => {
    loadComparisonData();
  }, [buildQueryParams, compareBy]);

  const loadPotentialSummary = async () => {
    try {
      const res = await axios.get(`${API}/market-potential/summary`, { withCredentials: true });
      setPotentialSummary(res.data);
    } catch (error) {
      console.error('Error loading potential summary:', error);
    }
  };

  const loadDistrictData = async () => {
    try {
      const res = await axios.get(`${API}/market-potential/districts`, { withCredentials: true });
      setDistrictData(res.data.districts || []);
    } catch (error) {
      console.error('Error loading district data:', error);
    }
  };

  const loadKvaData = async () => {
    try {
      const res = await axios.get(`${API}/market-potential/kva-ranges`, { withCredentials: true });
      setKvaData(res.data.kva_ranges || []);
    } catch (error) {
      console.error('Error loading KVA data:', error);
    }
  };

  const loadTargets = async () => {
    try {
      const res = await axios.get(`${API}/forecast-enhanced/targets?fiscal_year=${targetsFiscalYear}&entity_type=${entityType}&entity_id=${selectedEntityId}`, { withCredentials: true });
      if (res.data.success) {
        setTargets(res.data);
        if (res.data.targets) {
          setEditTargets({
            yearly: res.data.targets.yearly || { leads: 0, closures: 0 },
            half_yearly: res.data.targets.half_yearly || { H1: { leads: 0, closures: 0 }, H2: { leads: 0, closures: 0 } },
            quarterly: res.data.targets.quarterly || { Q1: { leads: 0, closures: 0 }, Q2: { leads: 0, closures: 0 }, Q3: { leads: 0, closures: 0 }, Q4: { leads: 0, closures: 0 } },
            monthly: res.data.targets.monthly || {}
          });
        } else {
          setEditTargets({
            yearly: { leads: 0, closures: 0 },
            half_yearly: { H1: { leads: 0, closures: 0 }, H2: { leads: 0, closures: 0 } },
            quarterly: { Q1: { leads: 0, closures: 0 }, Q2: { leads: 0, closures: 0 }, Q3: { leads: 0, closures: 0 }, Q4: { leads: 0, closures: 0 } },
            monthly: {}
          });
        }
      }
    } catch (error) {
      console.error('Error loading targets:', error);
    }
  };

  const loadAllTargets = async () => {
    try {
      const res = await axios.get(`${API}/forecast-enhanced/targets/all?fiscal_year=${targetsFiscalYear}`, { withCredentials: true });
      if (res.data.success) {
        setAllTargets(res.data.targets || { organization: [], dealer: [], employee: [] });
      }
    } catch (error) {
      console.error('Error loading all targets:', error);
    }
  };

  const loadDealersAndEmployees = async () => {
    try {
      const [dealersRes, employeesRes] = await Promise.all([
        axios.get(`${API}/forecast-enhanced/targets/dealers`, { withCredentials: true }),
        axios.get(`${API}/forecast-enhanced/targets/employees`, { withCredentials: true })
      ]);
      setDealersList(dealersRes.data.dealers || []);
      setEmployeesList(employeesRes.data.employees || []);
    } catch (error) {
      console.error('Error loading dealers/employees:', error);
    }
  };

  // Load targets when entity changes
  useEffect(() => {
    loadTargets();
  }, [entityType, selectedEntityId, targetsFiscalYear]);

  // Load dealers and employees list once
  useEffect(() => {
    loadDealersAndEmployees();
    loadAllTargets();
  }, [targetsFiscalYear]);

  const saveTargets = async () => {
    setSavingTargets(true);
    try {
      const res = await axios.post(`${API}/forecast-enhanced/targets`, {
        fiscal_year: targetsFiscalYear,
        entity_type: entityType,
        entity_id: selectedEntityId,
        entity_name: selectedEntityName,
        targets: editTargets
      }, { withCredentials: true });
      
      if (res.data.success) {
        toast.success(`Targets saved for ${selectedEntityName}`);
        loadTargets();
        loadAllTargets();
      }
    } catch (error) {
      console.error('Error saving targets:', error);
      toast.error('Failed to save targets');
    } finally {
      setSavingTargets(false);
    }
  };

  const handleEntityTypeChange = (type) => {
    setEntityType(type);
    if (type === 'organization') {
      setSelectedEntityId('org');
      setSelectedEntityName('Organization');
    } else {
      setSelectedEntityId('');
      setSelectedEntityName('');
    }
  };

  const handleEntitySelect = (id, name) => {
    setSelectedEntityId(id);
    setSelectedEntityName(name);
  };

  const updateTarget = (level, period, field, value) => {
    const numValue = parseInt(value) || 0;
    setEditTargets(prev => {
      const newTargets = { ...prev };
      if (level === 'yearly') {
        newTargets.yearly = { ...newTargets.yearly, [field]: numValue };
      } else if (level === 'half_yearly') {
        newTargets.half_yearly = { ...newTargets.half_yearly, [period]: { ...newTargets.half_yearly[period], [field]: numValue } };
      } else if (level === 'quarterly') {
        newTargets.quarterly = { ...newTargets.quarterly, [period]: { ...newTargets.quarterly[period], [field]: numValue } };
      } else if (level === 'monthly') {
        newTargets.monthly = { ...newTargets.monthly, [period]: { ...newTargets.monthly[period], [field]: numValue } };
      }
      return newTargets;
    });
  };

  const getFiscalYearMonths = () => {
    const [startYear] = targetsFiscalYear.split('-').map(y => y.length === 2 ? `20${y}` : y);
    const months = [];
    for (let i = 4; i <= 12; i++) months.push(`${startYear}-${String(i).padStart(2, '0')}`);
    for (let i = 1; i <= 3; i++) months.push(`${parseInt(startYear) + 1}-${String(i).padStart(2, '0')}`);
    return months;
  };

  const loadComparisonData = async () => {
    setLoading(true);
    try {
      const queryParams = buildQueryParams();
      const res = await axios.get(
        `${API}/market-potential/comparison?compare_by=${compareBy}&${queryParams}`,
        { withCredentials: true }
      );
      setComparisonData(res.data.data || []);
      setTotals(res.data.totals || {});
      setDateRange(res.data.date_range || {});
    } catch (error) {
      console.error('Error loading comparison data:', error);
      toast.error('Failed to load comparison data');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await axios.get(`${API}/market-potential/template`, {
        withCredentials: true,
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'market_potential_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Template downloaded successfully');
    } catch (error) {
      console.error('Error downloading template:', error);
      toast.error('Failed to download template');
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('Please upload an Excel file (.xlsx or .xls)');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${API}/market-potential/upload`, formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(`Uploaded: ${res.data.districts_imported} districts, ${res.data.kva_ranges_imported} KVA ranges`);
      loadPotentialSummary();
      loadDistrictData();
      loadKvaData();
      loadComparisonData();
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error(error.response?.data?.detail || 'Failed to upload file');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleAddEntry = async () => {
    try {
      if (managementTab === 'districts') {
        if (!newEntry.dealer || !newEntry.district) {
          toast.error('Dealer and District are required');
          return;
        }
        await axios.post(`${API}/market-potential/districts`, {
          dealer: newEntry.dealer,
          district: newEntry.district,
          state: newEntry.state,
          potential: parseInt(newEntry.potential) || 0
        }, { withCredentials: true });
        toast.success('District potential added');
        loadDistrictData();
      } else {
        if (!newEntry.kva_range) {
          toast.error('KVA Range is required');
          return;
        }
        await axios.post(`${API}/market-potential/kva-ranges`, {
          kva_range: newEntry.kva_range,
          market_size: parseInt(newEntry.market_size) || 0
        }, { withCredentials: true });
        toast.success('KVA potential added');
        loadKvaData();
      }
      setShowAddDialog(false);
      setNewEntry({ dealer: '', district: '', state: '', potential: '', kva_range: '', market_size: '' });
      loadPotentialSummary();
      loadComparisonData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add entry');
    }
  };

  const handleUpdateEntry = async () => {
    try {
      if (managementTab === 'districts') {
        await axios.put(
          `${API}/market-potential/districts/${encodeURIComponent(editingItem.district)}/${encodeURIComponent(editingItem.dealer)}`,
          { potential: parseInt(editingItem.potential) || 0, state: editingItem.state },
          { withCredentials: true }
        );
        toast.success('District potential updated');
        loadDistrictData();
      } else {
        await axios.put(
          `${API}/market-potential/kva-ranges/${encodeURIComponent(editingItem.kva_range)}`,
          { market_size: parseInt(editingItem.market_size) || 0 },
          { withCredentials: true }
        );
        toast.success('KVA potential updated');
        loadKvaData();
      }
      setEditingItem(null);
      loadPotentialSummary();
      loadComparisonData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update entry');
    }
  };

  const handleDeleteEntry = async (item) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) return;
    
    try {
      if (managementTab === 'districts') {
        await axios.delete(
          `${API}/market-potential/districts/${encodeURIComponent(item.district)}/${encodeURIComponent(item.dealer)}`,
          { withCredentials: true }
        );
        toast.success('District potential deleted');
        loadDistrictData();
      } else {
        await axios.delete(
          `${API}/market-potential/kva-ranges/${encodeURIComponent(item.kva_range)}`,
          { withCredentials: true }
        );
        toast.success('KVA potential deleted');
        loadKvaData();
      }
      loadPotentialSummary();
      loadComparisonData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete entry');
    }
  };

  const getTrendIcon = (value) => {
    if (value > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (value < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  const getMarketShareColor = (share) => {
    if (share >= 50) return 'text-green-600 bg-green-50';
    if (share >= 25) return 'text-yellow-600 bg-yellow-50';
    if (share >= 10) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  // Chart data for top 10
  const chartData = useMemo(() => {
    return comparisonData.slice(0, 10).map(item => ({
      name: item.name?.substring(0, 15) || 'Unknown',
      current: item.current_sales,
      lastYear: item.last_year_sales,
      potential: item.potential
    }));
  }, [comparisonData]);

  if (loading && !potentialSummary) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Market Comparison</h1>
          <p className="text-muted-foreground mt-1">Compare sales against market potential</p>
        </div>
        <div className="flex gap-2">
          <ExportButton
            data={comparisonData}
            filename="market_comparison"
            sheetName="Market Comparison"
            columns={[
              { key: 'name', header: 'Name', width: 25 },
              { key: 'current_sales', header: 'Current Sales', width: 15 },
              { key: 'last_year_sales', header: 'Last Year Sales', width: 18 },
              { key: 'potential', header: 'Market Potential', width: 18 },
              { key: 'market_share', header: 'Market Share %', width: 15 },
              { key: 'yoy_growth', header: 'YoY Growth %', width: 15 },
              { key: 'gap', header: 'Gap', width: 12 }
            ]}
            size="sm"
          >
            Export Data
          </ExportButton>
          <Button variant="outline" onClick={handleDownloadTemplate} data-testid="download-template-btn">
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </Button>
          <label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
              disabled={uploading}
            />
            <Button variant="default" disabled={uploading} asChild>
              <span className="cursor-pointer">
                {uploading ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Upload Data
              </span>
            </Button>
          </label>
        </div>
      </div>

      {/* Summary Cards */}
      {potentialSummary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">District Entries</p>
                  <p className="text-2xl font-bold">{potentialSummary.district_entries}</p>
                </div>
                <MapPin className="h-8 w-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Unique Dealers</p>
                  <p className="text-2xl font-bold">{potentialSummary.unique_dealers}</p>
                </div>
                <Building className="h-8 w-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total District Potential</p>
                  <p className="text-2xl font-bold">{potentialSummary.total_district_potential?.toLocaleString()}</p>
                </div>
                <Target className="h-8 w-8 text-purple-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">KVA Range Entries</p>
                  <p className="text-2xl font-bold">{potentialSummary.kva_entries}</p>
                </div>
                <Zap className="h-8 w-8 text-amber-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* No Data Warning */}
      {potentialSummary && !potentialSummary.has_data && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-800">No Market Potential Data</p>
                <p className="text-sm text-amber-700">
                  Upload market potential data using the template to see comparison analysis.
                  Click "Download Template" to get the Excel format.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="comparison" className="space-y-6">
        <TabsList>
          <TabsTrigger value="comparison">
            <BarChart3 className="h-4 w-4 mr-2" />
            Market Comparison
          </TabsTrigger>
          <TabsTrigger value="manage">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Manage Data
          </TabsTrigger>
          <TabsTrigger value="targets">
            <Target className="h-4 w-4 mr-2" />
            Targets
          </TabsTrigger>
        </TabsList>

        <TabsContent value="comparison" className="space-y-6">
          {/* Comparison Controls */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label>Compare by:</Label>
              <Select value={compareBy} onValueChange={setCompareBy}>
                <SelectTrigger className="w-40" data-testid="compare-by-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="district">District</SelectItem>
                  <SelectItem value="dealer">Dealer</SelectItem>
                  <SelectItem value="state">State</SelectItem>
                  <SelectItem value="kva">KVA Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={loadComparisonData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Totals Summary */}
          {totals && Object.keys(totals).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Overall Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Potential</p>
                    <p className="text-xl font-bold">{totals.potential?.toLocaleString() || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Current Sales</p>
                    <p className="text-xl font-bold text-blue-600">{totals.current_sales?.toLocaleString() || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Last Year Sales</p>
                    <p className="text-xl font-bold text-gray-600">{totals.last_year_sales?.toLocaleString() || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Market Share</p>
                    <p className="text-xl font-bold text-purple-600">{totals.market_share || 0}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">YoY Change</p>
                    <div className="flex items-center justify-center gap-1">
                      {getTrendIcon(totals.yoy_change)}
                      <p className={`text-xl font-bold ${totals.yoy_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {totals.yoy_change >= 0 ? '+' : ''}{totals.yoy_change || 0}%
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Chart */}
          {chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Top 10 {compareBy.charAt(0).toUpperCase() + compareBy.slice(1)}s by Sales</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="current" name="Current Year" fill="#3b82f6" />
                    <Bar dataKey="lastYear" name="Last Year" fill="#9ca3af" />
                    <Bar dataKey="potential" name="Potential" fill="#a855f7" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Comparison Table */}
          <Card>
            <CardHeader>
              <CardTitle>Detailed Comparison</CardTitle>
              <CardDescription>
                {dateRange.current?.start} to {dateRange.current?.end} vs {dateRange.last_year?.start} to {dateRange.last_year?.end}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12" />)}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{compareBy.charAt(0).toUpperCase() + compareBy.slice(1)}</TableHead>
                      {compareBy === 'dealer' && <TableHead className="text-right">Districts</TableHead>}
                      {compareBy === 'state' && <TableHead className="text-right">Dealers</TableHead>}
                      <TableHead className="text-right">Potential</TableHead>
                      <TableHead className="text-right">Current Sales</TableHead>
                      <TableHead className="text-right">Last Year</TableHead>
                      <TableHead className="text-right">Market Share</TableHead>
                      <TableHead className="text-right">YoY Change</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparisonData.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">
                          {item.name}
                          {item.state && <span className="text-xs text-muted-foreground ml-2">({item.state})</span>}
                        </TableCell>
                        {compareBy === 'dealer' && (
                          <TableCell className="text-right">{item.districts_count || 0}</TableCell>
                        )}
                        {compareBy === 'state' && (
                          <TableCell className="text-right">{item.dealers_count || 0}</TableCell>
                        )}
                        <TableCell className="text-right">{item.potential?.toLocaleString() || 0}</TableCell>
                        <TableCell className="text-right font-medium text-blue-600">
                          {item.current_sales?.toLocaleString() || 0}
                        </TableCell>
                        <TableCell className="text-right text-gray-600">
                          {item.last_year_sales?.toLocaleString() || 0}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge className={`${getMarketShareColor(item.market_share)}`}>
                            {item.market_share || 0}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {getTrendIcon(item.yoy_change)}
                            <span className={item.yoy_change >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {item.yoy_change >= 0 ? '+' : ''}{item.yoy_change || 0}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {comparisonData.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No comparison data available. Upload market potential data to see comparisons.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manage" className="space-y-6">
          <Tabs value={managementTab} onValueChange={setManagementTab}>
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="districts">District Potentials</TabsTrigger>
                <TabsTrigger value="kva">KVA Range Potentials</TabsTrigger>
              </TabsList>
              <Button onClick={() => setShowAddDialog(true)} data-testid="add-entry-btn">
                <Plus className="h-4 w-4 mr-2" />
                Add Entry
              </Button>
            </div>

            <TabsContent value="districts">
              <Card>
                <CardHeader>
                  <CardTitle>District Market Potentials</CardTitle>
                  <CardDescription>
                    Manage district-wise market potential data. Each dealer can cover multiple districts.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Dealer</TableHead>
                        <TableHead>District</TableHead>
                        <TableHead>State</TableHead>
                        <TableHead className="text-right">Potential</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {districtData.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{item.dealer}</TableCell>
                          <TableCell>{item.district}</TableCell>
                          <TableCell>{item.state}</TableCell>
                          <TableCell className="text-right">
                            {editingItem?.district === item.district && editingItem?.dealer === item.dealer ? (
                              <Input
                                type="number"
                                value={editingItem.potential}
                                onChange={(e) => setEditingItem({...editingItem, potential: e.target.value})}
                                className="w-24 text-right"
                              />
                            ) : (
                              item.potential?.toLocaleString()
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {editingItem?.district === item.district && editingItem?.dealer === item.dealer ? (
                              <div className="flex gap-1 justify-end">
                                <Button size="sm" variant="ghost" onClick={handleUpdateEntry}>
                                  <Save className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingItem(null)}>
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex gap-1 justify-end">
                                <Button size="sm" variant="ghost" onClick={() => setEditingItem({...item})}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => handleDeleteEntry(item)}>
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {districtData.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            No district data. Upload a template or add entries manually.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="kva">
              <Card>
                <CardHeader>
                  <CardTitle>KVA Range Market Potentials</CardTitle>
                  <CardDescription>
                    Manage KVA range market size data for KVA-wise comparison.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>KVA Range</TableHead>
                        <TableHead className="text-right">Market Size</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {kvaData.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{item.kva_range}</TableCell>
                          <TableCell className="text-right">
                            {editingItem?.kva_range === item.kva_range ? (
                              <Input
                                type="number"
                                value={editingItem.market_size}
                                onChange={(e) => setEditingItem({...editingItem, market_size: e.target.value})}
                                className="w-24 text-right"
                              />
                            ) : (
                              item.market_size?.toLocaleString()
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {editingItem?.kva_range === item.kva_range ? (
                              <div className="flex gap-1 justify-end">
                                <Button size="sm" variant="ghost" onClick={handleUpdateEntry}>
                                  <Save className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingItem(null)}>
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex gap-1 justify-end">
                                <Button size="sm" variant="ghost" onClick={() => setEditingItem({...item})}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => handleDeleteEntry(item)}>
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {kvaData.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                            No KVA data. Upload a template or add entries manually.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Targets Tab */}
        <TabsContent value="targets" className="space-y-6">
          {/* Entity Selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Select Target Type</CardTitle>
              <CardDescription>Choose who you want to set targets for</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 items-end">
                {/* Entity Type Selection */}
                <div className="space-y-2">
                  <Label>Target For</Label>
                  <Select value={entityType} onValueChange={handleEntityTypeChange}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="organization">Organization</SelectItem>
                      <SelectItem value="dealer">Dealer</SelectItem>
                      <SelectItem value="employee">Employee</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Dealer Selection */}
                {entityType === 'dealer' && (
                  <div className="space-y-2">
                    <Label>Select Dealer</Label>
                    <Select value={selectedEntityId} onValueChange={(v) => handleEntitySelect(v, v)}>
                      <SelectTrigger className="w-64">
                        <SelectValue placeholder="Choose a dealer" />
                      </SelectTrigger>
                      <SelectContent>
                        {dealersList.map(dealer => (
                          <SelectItem key={dealer} value={dealer}>{dealer}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Employee Selection */}
                {entityType === 'employee' && (
                  <div className="space-y-2">
                    <Label>Select Employee</Label>
                    <Select value={selectedEntityId} onValueChange={(v) => {
                      const emp = employeesList.find(e => e.user_id === v);
                      handleEntitySelect(v, emp?.name || v);
                    }}>
                      <SelectTrigger className="w-64">
                        <SelectValue placeholder="Choose an employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {employeesList.map(emp => (
                          <SelectItem key={emp.user_id} value={emp.user_id}>
                            {emp.name} ({emp.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Fiscal Year */}
                <div className="space-y-2">
                  <Label>Fiscal Year</Label>
                  <Select value={targetsFiscalYear} onValueChange={setTargetsFiscalYear}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2024-25">FY 2024-25</SelectItem>
                      <SelectItem value="2025-26">FY 2025-26</SelectItem>
                      <SelectItem value="2026-27">FY 2026-27</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Target Entry Form */}
          {(entityType === 'organization' || selectedEntityId) && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-amber-500" />
                      Targets for: {selectedEntityName || 'Organization'}
                    </CardTitle>
                    <CardDescription>
                      Set leads and closures targets at yearly, half-yearly, quarterly, and monthly levels
                    </CardDescription>
                  </div>
                  <Button onClick={saveTargets} disabled={savingTargets}>
                    {savingTargets ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Targets
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs value={targetsTab} onValueChange={setTargetsTab}>
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="yearly">Yearly</TabsTrigger>
                    <TabsTrigger value="half_yearly">Half-Yearly</TabsTrigger>
                    <TabsTrigger value="quarterly">Quarterly</TabsTrigger>
                    <TabsTrigger value="monthly">Monthly</TabsTrigger>
                  </TabsList>

                {/* Yearly Targets */}
                <TabsContent value="yearly" className="pt-4">
                  <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg text-amber-800">Annual Targets</CardTitle>
                      <CardDescription>Set your total leads and closures target for FY {targetsFiscalYear}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className="text-amber-700">Total Leads Target</Label>
                          <Input
                            type="number"
                            value={editTargets.yearly?.leads || 0}
                            onChange={(e) => updateTarget('yearly', null, 'leads', e.target.value)}
                            className="text-lg font-bold"
                            data-testid="yearly-leads-target"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-amber-700">Total Closures Target</Label>
                          <Input
                            type="number"
                            value={editTargets.yearly?.closures || 0}
                            onChange={(e) => updateTarget('yearly', null, 'closures', e.target.value)}
                            className="text-lg font-bold"
                            data-testid="yearly-closures-target"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Half-Yearly Targets */}
                <TabsContent value="half_yearly" className="pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { key: 'H1', label: 'H1 (April - September)', color: 'indigo' },
                      { key: 'H2', label: 'H2 (October - March)', color: 'purple' }
                    ].map(({ key, label, color }) => (
                      <Card key={key} className={`bg-gradient-to-br from-${color}-50 to-white border-${color}-200`}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">{label}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-sm">Leads Target</Label>
                              <Input
                                type="number"
                                value={editTargets.half_yearly?.[key]?.leads || 0}
                                onChange={(e) => updateTarget('half_yearly', key, 'leads', e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm">Closures Target</Label>
                              <Input
                                type="number"
                                value={editTargets.half_yearly?.[key]?.closures || 0}
                                onChange={(e) => updateTarget('half_yearly', key, 'closures', e.target.value)}
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                {/* Quarterly Targets */}
                <TabsContent value="quarterly" className="pt-4">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { key: 'Q1', label: 'Q1 (Apr-Jun)', color: 'emerald' },
                      { key: 'Q2', label: 'Q2 (Jul-Sep)', color: 'blue' },
                      { key: 'Q3', label: 'Q3 (Oct-Dec)', color: 'orange' },
                      { key: 'Q4', label: 'Q4 (Jan-Mar)', color: 'rose' }
                    ].map(({ key, label, color }) => (
                      <Card key={key} className="bg-slate-50 border">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">{label}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-500">Leads</Label>
                            <Input
                              type="number"
                              value={editTargets.quarterly?.[key]?.leads || 0}
                              onChange={(e) => updateTarget('quarterly', key, 'leads', e.target.value)}
                              className="h-9"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-500">Closures</Label>
                            <Input
                              type="number"
                              value={editTargets.quarterly?.[key]?.closures || 0}
                              onChange={(e) => updateTarget('quarterly', key, 'closures', e.target.value)}
                              className="h-9"
                            />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                {/* Monthly Targets */}
                <TabsContent value="monthly" className="pt-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {getFiscalYearMonths().map(month => {
                      const monthDate = new Date(month + '-01');
                      const monthName = monthDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                      return (
                        <Card key={month} className="p-3 bg-gray-50">
                          <p className="font-medium text-sm mb-2 text-gray-700">{monthName}</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs text-gray-500">Leads</Label>
                              <Input
                                type="number"
                                value={editTargets.monthly?.[month]?.leads || 0}
                                onChange={(e) => updateTarget('monthly', month, 'leads', e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-gray-500">Closures</Label>
                              <Input
                                type="number"
                                value={editTargets.monthly?.[month]?.closures || 0}
                                onChange={(e) => updateTarget('monthly', month, 'closures', e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Current Entity Target Summary */}
          {targets?.exists && (
            <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-emerald-800">
                  Saved Targets for {selectedEntityName || 'Organization'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-white rounded-lg">
                    <p className="text-xs text-gray-500">Yearly Leads</p>
                    <p className="text-2xl font-bold text-emerald-700">{targets.targets?.yearly?.leads?.toLocaleString() || 0}</p>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg">
                    <p className="text-xs text-gray-500">Yearly Closures</p>
                    <p className="text-2xl font-bold text-emerald-700">{targets.targets?.yearly?.closures?.toLocaleString() || 0}</p>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg">
                    <p className="text-xs text-gray-500">Last Updated</p>
                    <p className="text-sm font-medium text-gray-700">
                      {targets.updated_at ? new Date(targets.updated_at).toLocaleDateString() : 'Not set'}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg">
                    <p className="text-xs text-gray-500">Updated By</p>
                    <p className="text-sm font-medium text-gray-700">{targets.updated_by?.name || 'N/A'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* All Targets Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">All Targets Summary - FY {targetsFiscalYear}</CardTitle>
              <CardDescription>Overview of all targets set for this fiscal year</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Organization Target */}
                {allTargets.organization?.length > 0 && (
                  <div>
                    <h4 className="font-medium text-amber-700 mb-2 flex items-center gap-2">
                      <Building className="h-4 w-4" /> Organization Target
                    </h4>
                    <div className="grid grid-cols-4 gap-3">
                      {allTargets.organization.map(t => (
                        <div key="org" className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                          <p className="text-xs text-amber-600">Yearly</p>
                          <p className="font-bold text-amber-800">{t.targets?.yearly?.leads?.toLocaleString() || 0} leads</p>
                          <p className="text-sm text-amber-700">{t.targets?.yearly?.closures?.toLocaleString() || 0} closures</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dealer Targets */}
                {allTargets.dealer?.length > 0 && (
                  <div>
                    <h4 className="font-medium text-indigo-700 mb-2 flex items-center gap-2">
                      <Users className="h-4 w-4" /> Dealer Targets ({allTargets.dealer.length})
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-64 overflow-y-auto">
                      {allTargets.dealer.map(t => (
                        <div key={t.entity_id} className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                          <p className="text-xs text-indigo-600 truncate font-medium">{t.entity_name || t.entity_id}</p>
                          <p className="font-bold text-indigo-800">{t.targets?.yearly?.leads?.toLocaleString() || 0} leads</p>
                          <p className="text-sm text-indigo-700">{t.targets?.yearly?.closures?.toLocaleString() || 0} closures</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Employee Targets */}
                {allTargets.employee?.length > 0 && (
                  <div>
                    <h4 className="font-medium text-purple-700 mb-2 flex items-center gap-2">
                      <User className="h-4 w-4" /> Employee Targets ({allTargets.employee.length})
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-64 overflow-y-auto">
                      {allTargets.employee.map(t => (
                        <div key={t.entity_id} className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                          <p className="text-xs text-purple-600 truncate font-medium">{t.entity_name || t.entity_id}</p>
                          <p className="font-bold text-purple-800">{t.targets?.yearly?.leads?.toLocaleString() || 0} leads</p>
                          <p className="text-sm text-purple-700">{t.targets?.yearly?.closures?.toLocaleString() || 0} closures</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No targets message */}
                {(!allTargets.organization?.length && !allTargets.dealer?.length && !allTargets.employee?.length) && (
                  <div className="text-center py-8 text-gray-500">
                    <Target className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p>No targets set yet for FY {targetsFiscalYear}</p>
                    <p className="text-sm">Select an entity type above and set targets</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Entry Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Add {managementTab === 'districts' ? 'District Potential' : 'KVA Range Potential'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {managementTab === 'districts' ? (
              <>
                <div className="space-y-2">
                  <Label>Dealer Name *</Label>
                  <Input
                    value={newEntry.dealer}
                    onChange={(e) => setNewEntry({...newEntry, dealer: e.target.value})}
                    placeholder="Enter dealer name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>District *</Label>
                  <Input
                    value={newEntry.district}
                    onChange={(e) => setNewEntry({...newEntry, district: e.target.value})}
                    placeholder="Enter district name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Input
                    value={newEntry.state}
                    onChange={(e) => setNewEntry({...newEntry, state: e.target.value})}
                    placeholder="Enter state name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Market Potential (Units)</Label>
                  <Input
                    type="number"
                    value={newEntry.potential}
                    onChange={(e) => setNewEntry({...newEntry, potential: e.target.value})}
                    placeholder="e.g., 500"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>KVA Range *</Label>
                  <Input
                    value={newEntry.kva_range}
                    onChange={(e) => setNewEntry({...newEntry, kva_range: e.target.value})}
                    placeholder="e.g., 82.5-125"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Market Size (Units)</Label>
                  <Input
                    type="number"
                    value={newEntry.market_size}
                    onChange={(e) => setNewEntry({...newEntry, market_size: e.target.value})}
                    placeholder="e.g., 2500"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAddEntry}>Add Entry</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Comparison;
