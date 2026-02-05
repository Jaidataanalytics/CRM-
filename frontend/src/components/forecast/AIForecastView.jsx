import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Download, TrendingUp, TrendingDown, MapPin, Building2, 
  Users, Layers, Calendar, BarChart3, ChevronDown, ChevronRight,
  Target, Zap, Settings2, RefreshCw, CheckCircle2, AlertCircle,
  TreePine, TableIcon, Filter, Brain, Cpu, Save, Loader2
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler
);

const API = '/api';

const COLORS = [
  '#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', 
  '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#84cc16'
];

// ============================================
// AI FORECAST VIEW COMPONENT
// ============================================
const AIForecastView = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Parameters
  const [monthsAhead, setMonthsAhead] = useState(3);
  const [yearsBack, setYearsBack] = useState(3);
  const [forceModel, setForceModel] = useState('auto');
  const [includeCurrentMonth, setIncludeCurrentMonth] = useState(true);
  
  // View state
  const [viewMode, setViewMode] = useState('tree'); // 'tree' or 'table'
  const [expandedDealers, setExpandedDealers] = useState({});
  const [filterDealer, setFilterDealer] = useState('');
  const [filterKva, setFilterKva] = useState('');
  const [filterDistrict, setFilterDistrict] = useState('');
  
  // Save state
  const [savingProjection, setSavingProjection] = useState(false);
  const [projectionNotes, setProjectionNotes] = useState('');

  const loadForecast = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        months_ahead: parseInt(monthsAhead),
        years_back: parseInt(yearsBack),
        include_current_month: includeCurrentMonth
      };
      
      if (forceModel && forceModel !== 'auto') {
        payload.force_model = forceModel;
      }
      
      const res = await axios.post(
        `${API}/forecast-enhanced/comprehensive-forecast`,
        payload,
        { withCredentials: true, timeout: 120000 } // 2 minute timeout
      );
      
      if (res.data.success) {
        setData(res.data);
        toast.success('Forecast generated successfully');
      } else {
        setError(res.data.message || 'Failed to generate forecast');
        toast.error(res.data.message || 'Failed to generate forecast');
      }
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Failed to load forecast';
      setError(msg);
      toast.error(msg);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // REMOVED: Auto-load on mount - user must click "Generate Forecast"
  // useEffect(() => {
  //   loadForecast();
  // }, []);

  // Save projection with all data
  const saveProjection = async () => {
    if (!data) {
      toast.error('No forecast to save');
      return;
    }
    
    setSavingProjection(true);
    try {
      // Prepare comprehensive payload with all forecast data
      const payload = {
        forecast_data: {
          organization_forecast: data.organization_forecast,
          chart_data: data.chart_data,
          historical_summary: data.historical_summary,
          consistency_check: data.consistency_check
        },
        dealer_forecasts: data.dealer_forecasts, // Full dealer array with by_kva, by_district
        model_metrics: data.model_metrics,
        model_selection: data.model_selection,
        model_selection_mode: data.model_selection_mode,
        parameters: {
          months_ahead: monthsAhead,
          years_back: yearsBack,
          force_model: forceModel === 'auto' ? null : forceModel,
          include_current_month: includeCurrentMonth
        },
        view_settings: {
          view_mode: viewMode,
          expanded_dealers: expandedDealers
        },
        notes: projectionNotes
      };
      
      const res = await axios.post(
        `${API}/forecast-enhanced/save-enhanced`,
        payload,
        { withCredentials: true }
      );
      
      if (res.data.success) {
        toast.success(`Projection saved! ID: ${res.data.projection_id}`);
        setProjectionNotes(''); // Clear notes after save
      } else {
        toast.error(res.data.message || 'Failed to save projection');
      }
    } catch (err) {
      console.error('Save error:', err);
      toast.error(err.response?.data?.detail || 'Failed to save projection');
    } finally {
      setSavingProjection(false);
    }
  };

  const toggleDealer = (dealerName) => {
    setExpandedDealers(prev => ({
      ...prev,
      [dealerName]: !prev[dealerName]
    }));
  };

  // Filter dealers based on search
  // dealer_forecasts is now an array with pre-aggregated totals and breakdowns
  const filteredDealers = useMemo(() => {
    if (!data?.dealer_forecasts) return [];
    
    // dealer_forecasts is already an array with totals, by_kva, by_district pre-calculated
    return data.dealer_forecasts.filter(dealer => {
      const matchDealer = !filterDealer || dealer.dealer.toLowerCase().includes(filterDealer.toLowerCase());
      return matchDealer;
    });
  }, [data, filterDealer]);

  // Get unique KVAs and districts for filters
  const uniqueKvas = useMemo(() => {
    if (!data?.organization_forecast?.by_kva) return [];
    return Object.keys(data.organization_forecast.by_kva).sort((a, b) => Number(a) - Number(b));
  }, [data]);

  const uniqueDistricts = useMemo(() => {
    if (!data?.organization_forecast?.by_district) return [];
    return Object.keys(data.organization_forecast.by_district).sort();
  }, [data]);

  // Chart data
  const monthlyChartData = useMemo(() => {
    if (!data?.chart_data) return null;
    return {
      labels: data.chart_data.months,
      datasets: [
        {
          label: 'Predicted Leads',
          data: data.chart_data.leads,
          backgroundColor: '#6366f1',
          borderRadius: 6
        },
        {
          label: 'Predicted Closures',
          data: data.chart_data.closures,
          backgroundColor: '#22c55e',
          borderRadius: 6
        }
      ]
    };
  }, [data]);

  const conversionChartData = useMemo(() => {
    if (!data?.chart_data) return null;
    return {
      labels: data.chart_data.months,
      datasets: [{
        label: 'Conversion Rate %',
        data: data.chart_data.conversion_rates,
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        fill: true,
        tension: 0.3
      }]
    };
  }, [data]);

  // Default available models (shown before first forecast)
  const defaultModels = [
    "Simple Moving Average", "Weighted Moving Average", "Exponential Smoothing",
    "Seasonal (Same-Month)", "Linear Trend", "ARIMA", "Random Forest",
    "Gradient Boosting", "XGBoost", "Ensemble (Hybrid)"
  ];
  const availableModels = data?.model_metrics?.available_models || defaultModels;

  if (loading && !data) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Analyzing data and selecting best AI model...</p>
          <p className="text-sm text-gray-400 mt-2">Testing multiple models for optimal accuracy</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Configuration Panel */}
      <Card className="bg-gradient-to-r from-slate-50 to-indigo-50 border-indigo-100">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings2 className="w-5 h-5 text-indigo-600" />
            Forecast Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div>
              <Label className="text-sm font-medium">Forecast Horizon</Label>
              <Select value={String(monthsAhead)} onValueChange={(v) => setMonthsAhead(Number(v))}>
                <SelectTrigger data-testid="months-ahead-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 6, 9, 12].map(m => (
                    <SelectItem key={m} value={String(m)}>{m} month{m > 1 ? 's' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-sm font-medium">Training Data</Label>
              <Select value={String(yearsBack)} onValueChange={(v) => setYearsBack(Number(v))}>
                <SelectTrigger data-testid="years-back-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map(y => (
                    <SelectItem key={y} value={String(y)}>{y} year{y > 1 ? 's' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-sm font-medium">Model Selection</Label>
              <Select value={forceModel} onValueChange={setForceModel}>
                <SelectTrigger data-testid="model-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (Best Model)</SelectItem>
                  {availableModels.map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="includeCurrentMonth"
                checked={includeCurrentMonth}
                onChange={(e) => setIncludeCurrentMonth(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300"
              />
              <Label htmlFor="includeCurrentMonth" className="text-sm">Include Current Month</Label>
            </div>
            
            <Button 
              onClick={loadForecast} 
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700"
              data-testid="generate-forecast-btn"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Brain className="w-4 h-4 mr-2" />
              )}
              Generate Forecast
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-red-700">{error}</span>
          </CardContent>
        </Card>
      )}

      {/* Initial State - No forecast generated yet */}
      {!data && !loading && !error && (
        <Card className="border-2 border-dashed border-indigo-200 bg-indigo-50/30">
          <CardContent className="p-12 text-center">
            <Brain className="w-16 h-16 text-indigo-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">AI-Powered Forecast</h3>
            <p className="text-gray-500 mb-4 max-w-md mx-auto">
              Click "Generate Forecast" to analyze historical data and predict future leads and closures using machine learning models.
            </p>
            <div className="flex flex-wrap justify-center gap-2 text-sm text-gray-400">
              <Badge variant="outline">ARIMA</Badge>
              <Badge variant="outline">XGBoost</Badge>
              <Badge variant="outline">Random Forest</Badge>
              <Badge variant="outline">Exponential Smoothing</Badge>
              <Badge variant="outline">+6 more</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          {/* Model Performance Banner */}
          <Card className={`border-2 ${data.consistency_check?.passed ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-indigo-600" />
                    <span className="font-medium">Leads Model:</span>
                    <Badge variant="outline" className="bg-white">
                      {data.model_metrics?.leads_model?.name || 'None'}
                    </Badge>
                    {data.model_metrics?.leads_model?.accuracy && (
                      <Badge className="bg-indigo-100 text-indigo-700">
                        {data.model_metrics.leads_model.accuracy}% accuracy
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-green-600" />
                    <span className="font-medium">Closures Model:</span>
                    <Badge variant="outline" className="bg-white">
                      {data.model_metrics?.closures_model?.name}
                    </Badge>
                    {data.model_metrics?.closures_model?.accuracy && (
                      <Badge className="bg-green-100 text-green-700">
                        {data.model_metrics.closures_model.accuracy}% accuracy
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {data.consistency_check?.passed ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <span className="text-green-700 font-medium">Consistency Check Passed</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                      <span className="text-amber-700 font-medium">Consistency Issues Found</span>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-2 text-sm text-gray-600">
                Mode: <strong>{data.model_selection_mode === 'auto' ? 'Auto-selected' : 'Manual'}</strong> | 
                Training Period: <strong>{data.historical_summary?.period}</strong> | 
                Data Points: <strong>{data.historical_summary?.months_analyzed} months</strong>
              </div>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-100">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-100 rounded-xl">
                    <Users className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Predicted Leads</p>
                    <p className="text-3xl font-bold text-indigo-700" data-testid="total-leads">
                      {data.organization_forecast?.totals?.leads?.toLocaleString() || 0}
                    </p>
                    <p className="text-xs text-gray-400">
                      Next {monthsAhead} month{monthsAhead > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-white border-green-100">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green-100 rounded-xl">
                    <Target className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Predicted Closures</p>
                    <p className="text-3xl font-bold text-green-700" data-testid="total-closures">
                      {data.organization_forecast?.totals?.closures?.toLocaleString() || 0}
                    </p>
                    <p className="text-xs text-gray-400">
                      Next {monthsAhead} month{monthsAhead > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-100">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-100 rounded-xl">
                    <Building2 className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Active Dealers</p>
                    <p className="text-3xl font-bold text-amber-700">
                      {data.model_metrics?.data_quality?.unique_dealers || 0}
                    </p>
                    <p className="text-xs text-gray-400">With predictions</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-100">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-purple-100 rounded-xl">
                    <TrendingUp className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Avg Conversion</p>
                    <p className="text-3xl font-bold text-purple-700">
                      {data.historical_summary?.avg_conversion_rate || 0}%
                    </p>
                    <p className="text-xs text-gray-400">Historical avg</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-500" />
                  Monthly Forecast
                </CardTitle>
                <CardDescription>Predicted leads and closures by month</CardDescription>
              </CardHeader>
              <CardContent>
                {monthlyChartData && (
                  <div className="h-64">
                    <Bar
                      data={monthlyChartData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { position: 'top' } },
                        scales: { y: { beginAtZero: true } }
                      }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-amber-500" />
                  Conversion Rate Trend
                </CardTitle>
                <CardDescription>Predicted conversion percentage</CardDescription>
              </CardHeader>
              <CardContent>
                {conversionChartData && (
                  <div className="h-64">
                    <Line
                      data={conversionChartData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: { y: { beginAtZero: true, max: 100 } }
                      }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* View Toggle and Filters */}
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <CardTitle className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-500" />
                  Dealer Breakdown
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant={viewMode === 'tree' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('tree')}
                    data-testid="tree-view-btn"
                  >
                    <TreePine className="w-4 h-4 mr-1" />
                    Tree View
                  </Button>
                  <Button
                    variant={viewMode === 'table' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('table')}
                    data-testid="table-view-btn"
                  >
                    <TableIcon className="w-4 h-4 mr-1" />
                    Table View
                  </Button>
                </div>
              </div>
              <CardDescription>
                Full hierarchy: Organization → Dealer → KVA / District
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex flex-wrap gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-500" />
                  <Input
                    placeholder="Filter by dealer..."
                    value={filterDealer}
                    onChange={(e) => setFilterDealer(e.target.value)}
                    className="w-48"
                    data-testid="filter-dealer-input"
                  />
                </div>
                {viewMode === 'table' && (
                  <>
                    <Select value={filterKva} onValueChange={setFilterKva}>
                      <SelectTrigger className="w-36" data-testid="filter-kva-select">
                        <SelectValue placeholder="Filter KVA" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All KVAs</SelectItem>
                        {uniqueKvas.slice(0, 20).map(k => (
                          <SelectItem key={k} value={k}>{k} KVA</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={filterDistrict} onValueChange={setFilterDistrict}>
                      <SelectTrigger className="w-48" data-testid="filter-district-select">
                        <SelectValue placeholder="Filter District" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Districts</SelectItem>
                        {uniqueDistricts.slice(0, 30).map(d => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}
                <span className="text-sm text-gray-500 ml-auto">
                  Showing {filteredDealers.length} of {Object.keys(data.dealer_forecasts || {}).length} dealers
                </span>
              </div>

              {/* Tree View */}
              {viewMode === 'tree' && (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {filteredDealers.map((dealer, idx) => (
                    <Collapsible
                      key={dealer.dealer}
                      open={expandedDealers[dealer.dealer]}
                      onOpenChange={() => toggleDealer(dealer.dealer)}
                    >
                      <CollapsibleTrigger className="w-full">
                        <div className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                          <div className="flex items-center gap-3">
                            {expandedDealers[dealer.dealer] ? (
                              <ChevronDown className="w-4 h-4 text-gray-500" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-500" />
                            )}
                            <Building2 className="w-4 h-4 text-indigo-500" />
                            <span className="font-medium">{dealer.dealer}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="secondary" className="bg-indigo-100 text-indigo-700">
                              {dealer.totals?.leads || 0} leads
                            </Badge>
                            <Badge variant="secondary" className="bg-green-100 text-green-700">
                              {dealer.totals?.closures || 0} closures
                            </Badge>
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="ml-7 mt-2 p-4 bg-white border rounded-lg">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* KVA Breakdown */}
                            <div>
                              <h5 className="font-medium mb-3 flex items-center gap-2 text-indigo-700">
                                <Layers className="w-4 h-4" /> By KVA
                              </h5>
                              <div className="space-y-2 max-h-48 overflow-y-auto">
                                {dealer.by_kva && Object.entries(dealer.by_kva)
                                  .sort(([,a], [,b]) => (b.closures || 0) - (a.closures || 0))
                                  .slice(0, 10)
                                  .map(([kva, stats]) => (
                                    <div key={kva} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                      <span className="text-sm">{kva} KVA</span>
                                      <div className="flex gap-2">
                                        <Badge variant="outline" className="text-xs">
                                          {stats.leads || 0} leads
                                        </Badge>
                                        <Badge className="bg-green-100 text-green-700 text-xs">
                                          {stats.closures || 0} closures
                                        </Badge>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </div>
                            {/* District Breakdown */}
                            <div>
                              <h5 className="font-medium mb-3 flex items-center gap-2 text-purple-700">
                                <MapPin className="w-4 h-4" /> By District
                              </h5>
                              <div className="space-y-2 max-h-48 overflow-y-auto">
                                {dealer.by_district && Object.entries(dealer.by_district)
                                  .sort(([,a], [,b]) => (b.closures || 0) - (a.closures || 0))
                                  .slice(0, 10)
                                  .map(([district, stats]) => (
                                    <div key={district} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                      <span className="text-sm truncate max-w-[150px]">{district}</span>
                                      <div className="flex gap-2">
                                        <Badge variant="outline" className="text-xs">
                                          {stats.leads || 0} leads
                                        </Badge>
                                        <Badge className="bg-purple-100 text-purple-700 text-xs">
                                          {stats.closures || 0} closures
                                        </Badge>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              )}

              {/* Table View */}
              {viewMode === 'table' && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>Dealer</TableHead>
                        <TableHead className="text-right">Leads</TableHead>
                        <TableHead className="text-right">Closures</TableHead>
                        <TableHead className="text-right">Conversion %</TableHead>
                        <TableHead className="text-right">Top KVA</TableHead>
                        <TableHead className="text-right">Top District</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDealers.map((dealer) => {
                        const topKva = dealer.by_kva ? 
                          Object.entries(dealer.by_kva)
                            .filter(([k]) => !filterKva || filterKva === 'all' || k === filterKva)
                            .sort(([,a], [,b]) => (b.closures || 0) - (a.closures || 0))[0] : null;
                        const topDistrict = dealer.by_district ?
                          Object.entries(dealer.by_district)
                            .filter(([d]) => !filterDistrict || filterDistrict === 'all' || d === filterDistrict)
                            .sort(([,a], [,b]) => (b.closures || 0) - (a.closures || 0))[0] : null;
                        const conversion = dealer.totals?.leads > 0 
                          ? ((dealer.totals.closures / dealer.totals.leads) * 100).toFixed(1)
                          : 0;
                        
                        return (
                          <TableRow key={dealer.dealer} className="hover:bg-gray-50">
                            <TableCell className="font-medium">{dealer.dealer}</TableCell>
                            <TableCell className="text-right">{dealer.totals?.leads || 0}</TableCell>
                            <TableCell className="text-right">
                              <Badge className="bg-green-100 text-green-700">
                                {dealer.totals?.closures || 0}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant={conversion >= 20 ? 'default' : 'secondary'}>
                                {conversion}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {topKva ? (
                                <span className="text-sm">{topKva[0]} KVA ({topKva[1].closures})</span>
                              ) : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              {topDistrict ? (
                                <span className="text-sm truncate max-w-[120px] inline-block">
                                  {topDistrict[0]} ({topDistrict[1].closures})
                                </span>
                              ) : '-'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Model Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                Model Performance Details
              </CardTitle>
              <CardDescription>All tested models and their accuracy metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Leads Models */}
                <div>
                  <h4 className="font-medium mb-3 text-indigo-700">Leads Forecasting Models</h4>
                  <div className="space-y-2">
                    {data.model_metrics?.leads_model?.all_models_tested?.map((model, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center gap-2">
                          {model.model === data.model_metrics?.leads_model?.name && (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          )}
                          <span className={model.model === data.model_metrics?.leads_model?.name ? 'font-medium' : ''}>
                            {model.model}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          {model.accuracy !== null && (
                            <Badge variant={model.accuracy >= 80 ? 'default' : 'secondary'}>
                              {model.accuracy}%
                            </Badge>
                          )}
                          {model.note && (
                            <Badge variant="outline" className="text-xs">{model.note}</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Closures Models */}
                <div>
                  <h4 className="font-medium mb-3 text-green-700">Closures Forecasting Models</h4>
                  <div className="space-y-2">
                    {data.model_metrics?.closures_model?.all_models_tested?.map((model, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center gap-2">
                          {model.model === data.model_metrics?.closures_model?.name && (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          )}
                          <span className={model.model === data.model_metrics?.closures_model?.name ? 'font-medium' : ''}>
                            {model.model}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          {model.accuracy !== null && (
                            <Badge variant={model.accuracy >= 80 ? 'default' : 'secondary'}>
                              {model.accuracy}%
                            </Badge>
                          )}
                          {model.note && (
                            <Badge variant="outline" className="text-xs">{model.note}</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default AIForecastView;
