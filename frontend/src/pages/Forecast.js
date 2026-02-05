import { useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Sparkles, TrendingUp, TrendingDown, AlertCircle, Lightbulb, Calendar, 
  ChevronDown, ChevronRight, Zap, BarChart3, Target,
  CheckCircle2, XCircle, Info, FlaskConical, FileText,
  MapPin, Building2, Users, Layers, Save, Archive, Trash2, Download,
  RefreshCw, GitCompare, Minus
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
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2';
import { ExportButton } from '@/components/ui/export-button';
import { EnhancedForecastTab } from '@/components/forecast/EnhancedForecast';
import { CompareTab } from '@/components/forecast/CompareTab';
import AIForecastView from '@/components/forecast/AIForecastView';

ChartJS.register(
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
);

const API = '/api';

const COLORS = [
  '#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', 
  '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
  '#3b82f6', '#a855f7', '#10b981', '#f43f5e', '#0ea5e9'
];

const KVABreakdownSection = ({ data, expanded, onToggle }) => {
  if (!data || data.length === 0) return null;
  
  // Group KVA into categories for better visualization
  const categories = {
    'Small (5-15 KVA)': data.filter(d => d.kva <= 15),
    'Medium (16-50 KVA)': data.filter(d => d.kva > 15 && d.kva <= 50),
    'Large (51-125 KVA)': data.filter(d => d.kva > 50 && d.kva <= 125),
    'Industrial (126+ KVA)': data.filter(d => d.kva > 125)
  };

  const categoryTotals = Object.entries(categories).map(([name, items]) => ({
    name,
    leads: items.reduce((sum, i) => sum + (i.predicted_leads || 0), 0),
    closures: items.reduce((sum, i) => sum + (i.predicted_closures_category || 0), 0)
  }));

  const chartData = {
    labels: categoryTotals.map(c => c.name),
    datasets: [{
      data: categoryTotals.map(c => c.closures),
      backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444'],
      borderWidth: 0
    }]
  };

  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between p-4 h-auto bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-600" />
            <span className="font-medium">KVA Breakdown</span>
            <Badge variant="secondary" className="ml-2 bg-amber-100">{data.length} products</Badge>
          </div>
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4">
        {/* Category Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 mt-4">
          {categoryTotals.map((cat, idx) => (
            <div key={cat.name} className="p-3 rounded-lg border" style={{ borderLeftColor: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444'][idx], borderLeftWidth: 4 }}>
              <p className="text-xs text-muted-foreground">{cat.name}</p>
              <p className="text-lg font-bold text-green-600">{cat.closures.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{cat.leads.toLocaleString()} leads</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Detailed Table */}
          <div className="border rounded-lg overflow-hidden max-h-80 overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-white">
                <TableRow>
                  <TableHead>KVA</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Closures</TableHead>
                  <TableHead className="text-right">Conv. %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item, idx) => (
                  <TableRow key={idx} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{item.kva} KVA</TableCell>
                    <TableCell className="text-right">{item.predicted_leads?.toLocaleString() || 0}</TableCell>
                    <TableCell className="text-right text-green-600 font-medium">{item.predicted_closures_category?.toLocaleString() || 0}</TableCell>
                    <TableCell className="text-right">{item.conversion_rate?.toFixed(1) || 0}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {/* Category Chart */}
          <div className="h-64 flex items-center justify-center">
            <Doughnut 
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'right',
                    labels: { boxWidth: 12, font: { size: 11 } }
                  },
                  tooltip: {
                    callbacks: {
                      label: (context) => `${context.label}: ${context.raw.toLocaleString()} closures`
                    }
                  }
                }
              }}
            />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

// Generic Breakdown Section for State, Dealer, Employee, Segment
const GenericBreakdownSection = ({ data, title, icon: Icon, iconColor, bgGradient, fieldName, expanded, onToggle }) => {
  if (!data || data.length === 0) return null;
  
  const totalClosures = data.reduce((sum, d) => sum + (d.predicted_closures_category || 0), 0);
  
  const chartData = {
    labels: data.slice(0, 8).map(d => d[fieldName] || 'Unknown'),
    datasets: [{
      data: data.slice(0, 8).map(d => d.predicted_closures_category || 0),
      backgroundColor: COLORS.slice(0, 8),
      borderWidth: 0
    }]
  };

  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className={`w-full justify-between p-4 h-auto ${bgGradient}`}>
          <div className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${iconColor}`} />
            <span className="font-medium">{title}</span>
            <Badge variant="secondary" className="ml-2">{data.length} items</Badge>
            <Badge className="ml-1 bg-green-600">{totalClosures.toLocaleString()} closures</Badge>
          </div>
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          {/* Table */}
          <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-white">
                <TableRow>
                  <TableHead>{title.replace(' Breakdown', '')}</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Closures</TableHead>
                  <TableHead className="text-right">Conv. %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item, idx) => (
                  <TableRow key={idx} className="hover:bg-muted/50">
                    <TableCell className="font-medium truncate max-w-[150px]">{item[fieldName] || 'Unknown'}</TableCell>
                    <TableCell className="text-right">{(item.predicted_leads || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-green-600 font-medium">{(item.predicted_closures_category || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{(item.conversion_rate || 0).toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {/* Chart */}
          <div className="h-56 flex items-center justify-center">
            <Doughnut 
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'right',
                    labels: { boxWidth: 10, font: { size: 10 } }
                  },
                  tooltip: {
                    callbacks: {
                      label: (context) => `${context.label}: ${context.raw.toLocaleString()} closures`
                    }
                  }
                }
              }}
            />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const AccuracyMetricCard = ({ title, metrics, icon: Icon, color }) => {
  if (!metrics) return null;
  
  const getGradeColor = (accuracy) => {
    if (accuracy >= 90) return 'text-green-600';
    if (accuracy >= 75) return 'text-blue-600';
    if (accuracy >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className={`pb-2 ${color}`}>
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="text-3xl font-bold mb-2">
          <span className={getGradeColor(metrics.accuracy_percentage)}>
            {metrics.accuracy_percentage?.toFixed(1)}%
          </span>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">MAPE</span>
            <span className="font-medium">{metrics.mape?.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">MAE</span>
            <span className="font-medium">{metrics.mae?.toFixed(0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">R²</span>
            <span className="font-medium">{metrics.r_squared?.toFixed(3)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Direction</span>
            <span className="font-medium">{metrics.direction_accuracy?.toFixed(0)}%</span>
          </div>
        </div>
        {metrics.interpretation && (
          <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
            {metrics.interpretation.mape}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const Forecast = () => {
  const [horizon, setHorizon] = useState('3');
  const [state, setState] = useState('');
  const [dealer, setDealer] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingBacktest, setLoadingBacktest] = useState(false);
  const [loadingFactors, setLoadingFactors] = useState(false);
  const [loadingSave, setLoadingSave] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [forecast, setForecast] = useState(null);
  const [backtest, setBacktest] = useState(null);
  const [factors, setFactors] = useState(null);
  const [savedForecasts, setSavedForecasts] = useState(null);
  const [error, setError] = useState(null);
  const [expandedMonth, setExpandedMonth] = useState(null);
  const [expandedBreakdown, setExpandedBreakdown] = useState({});
  const [activeTab, setActiveTab] = useState('forecast');
  const [expandedSaved, setExpandedSaved] = useState(null);
  
  // Toggle function for breakdown sections
  const toggleBreakdown = (monthIdx, breakdownType) => {
    const key = `${monthIdx}-${breakdownType}`;
    setExpandedBreakdown(prev => ({ ...prev, [key]: !prev[key] }));
  };
  
  // Business context state
  const [showBusinessContext, setShowBusinessContext] = useState(false);
  const [marketingEffort, setMarketingEffort] = useState('same');
  const [marketingIntensity, setMarketingIntensity] = useState(50);
  const [campaignType, setCampaignType] = useState('none');
  const [marketConditions, setMarketConditions] = useState('stable');
  const [seasonalFactor, setSeasonalFactor] = useState('normal');

  const generateForecast = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        horizon: parseInt(horizon),
        state: state || undefined,
        dealer: dealer || undefined,
        business_context: {
          marketing_effort: marketingEffort,
          marketing_intensity: parseInt(marketingIntensity),
          campaign_active: campaignType !== 'none',
          campaign_type: campaignType,
          market_conditions: marketConditions,
          seasonal_factor: seasonalFactor
        }
      };
      
      const res = await axios.post(`${API}/forecast`, payload, { 
        withCredentials: true,
        timeout: 120000 // 2 minute timeout for forecast generation
      });
      
      if (res.data.success) {
        setForecast(res.data);
        if (res.data.forecast?.predictions?.length > 0) {
          setExpandedMonth(0);
        }
        toast.success('Forecast generated successfully');
      } else {
        setError(res.data.message || 'Forecast generation failed');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to generate forecast');
      toast.error('Forecast generation failed');
    } finally {
      setLoading(false);
    }
  };

  const runBacktest = async () => {
    setLoadingBacktest(true);
    try {
      const res = await axios.post(`${API}/forecast/backtest`, {
        window_size: 6,
        test_periods: 12
      }, { withCredentials: true });
      
      if (res.data.success) {
        setBacktest(res.data);
        setActiveTab('backtest');
        toast.success('Backtest completed');
      } else {
        toast.error(res.data.message || 'Backtest failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Backtest failed');
    } finally {
      setLoadingBacktest(false);
    }
  };

  const loadFactors = async () => {
    setLoadingFactors(true);
    try {
      const res = await axios.get(`${API}/forecast/factors`, { withCredentials: true });
      if (res.data.success) {
        setFactors(res.data);
        setActiveTab('factors');
        toast.success('Factors loaded');
      }
    } catch (err) {
      toast.error('Failed to load factors');
    } finally {
      setLoadingFactors(false);
    }
  };

  const saveProjection = async () => {
    if (!forecast) {
      toast.error('No forecast to save');
      return;
    }
    setLoadingSave(true);
    try {
      // Fetch all enhanced forecast data to save together
      const [dealerKvaRes, dealerDistrictRes, scenariosRes, seasonalityRes, conversionRes, productTrendsRes, geoRes] = await Promise.all([
        axios.get(`${API}/forecast-enhanced/dealer-kva-forecast?months_ahead=${horizon}`, { withCredentials: true }).catch(() => ({ data: null })),
        axios.get(`${API}/forecast-enhanced/dealer-district-forecast?months_ahead=${horizon}`, { withCredentials: true }).catch(() => ({ data: null })),
        axios.get(`${API}/forecast-enhanced/forecast-scenarios?months_ahead=${horizon}`, { withCredentials: true }).catch(() => ({ data: null })),
        axios.get(`${API}/forecast-enhanced/seasonality-analysis`, { withCredentials: true }).catch(() => ({ data: null })),
        axios.get(`${API}/forecast-enhanced/conversion-time-analysis`, { withCredentials: true }).catch(() => ({ data: null })),
        axios.get(`${API}/forecast-enhanced/product-mix-trends`, { withCredentials: true }).catch(() => ({ data: null })),
        axios.get(`${API}/forecast-enhanced/geographic-opportunities`, { withCredentials: true }).catch(() => ({ data: null }))
      ]);

      // Save with all enhanced data
      const res = await axios.post(`${API}/forecast-enhanced/save-enhanced`, {
        forecast_data: forecast,
        dealer_kva_forecast: dealerKvaRes.data,
        dealer_district_forecast: dealerDistrictRes.data,
        scenarios: scenariosRes.data,
        seasonality: seasonalityRes.data,
        conversion_analysis: conversionRes.data,
        product_trends: productTrendsRes.data,
        geographic_opportunities: geoRes.data,
        recommendations: forecast.forecast?.recommendations || [],
        trends: forecast.forecast?.trend_analysis || {},
        notes: ""
      }, { withCredentials: true });
      
      if (res.data.success) {
        toast.success('Full projection saved with all analytics!');
        // Refresh saved forecasts list if viewing
        if (savedForecasts) {
          loadSavedForecasts();
        }
      } else {
        toast.error(res.data.message || 'Failed to save projection');
      }
    } catch (err) {
      console.error('Save error:', err);
      toast.error(err.response?.data?.detail || 'Failed to save projection');
    } finally {
      setLoadingSave(false);
    }
  };

  const loadSavedForecasts = async () => {
    setLoadingSaved(true);
    try {
      // Try enhanced forecasts first, fall back to regular
      let res;
      try {
        res = await axios.get(`${API}/forecast-enhanced/projections`, { withCredentials: true });
      } catch {
        res = await axios.get(`${API}/forecast/saved`, { withCredentials: true });
      }
      
      if (res.data.success) {
        setSavedForecasts(res.data);
        setActiveTab('saved');
        toast.success(`${res.data.total || res.data.projections?.length || 0} saved projections loaded`);
      }
    } catch (err) {
      toast.error('Failed to load saved projections');
    } finally {
      setLoadingSaved(false);
    }
  };

  const deleteSavedForecast = async (index) => {
    try {
      const res = await axios.delete(`${API}/forecast/saved/${index}`, { withCredentials: true });
      if (res.data.success) {
        toast.success('Projection deleted');
        loadSavedForecasts();
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete projection');
    }
  };

  const exportFullForecast = async () => {
    if (!forecast) {
      toast.error('No forecast to export');
      return;
    }
    
    toast.info('Generating full report...');
    
    try {
      // Fetch all enhanced data for export
      const [dealerKvaRes, dealerDistrictRes, scenariosRes, seasonalityRes] = await Promise.all([
        axios.get(`${API}/forecast-enhanced/dealer-kva-forecast?months_ahead=${horizon}`, { withCredentials: true }).catch(() => ({ data: null })),
        axios.get(`${API}/forecast-enhanced/dealer-district-forecast?months_ahead=${horizon}`, { withCredentials: true }).catch(() => ({ data: null })),
        axios.get(`${API}/forecast-enhanced/forecast-scenarios?months_ahead=${horizon}`, { withCredentials: true }).catch(() => ({ data: null })),
        axios.get(`${API}/forecast-enhanced/seasonality-analysis`, { withCredentials: true }).catch(() => ({ data: null }))
      ]);

      // Export via backend
      const response = await axios.post(
        `${API}/forecast-enhanced/export-excel`,
        {
          forecast_data: {
            ...forecast,
            horizon_months: parseInt(horizon),
            predictions: forecast.forecast?.predictions || [],
            summary: forecast.forecast?.summary || ''
          },
          dealer_kva_forecast: dealerKvaRes.data,
          dealer_district_forecast: dealerDistrictRes.data,
          scenarios: scenariosRes.data,
          seasonality: seasonalityRes.data,
          include_charts: true
        },
        { 
          withCredentials: true,
          responseType: 'blob'
        }
      );

      // Download the file
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `forecast_report_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Report downloaded successfully!');
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Failed to export report');
    }
  };

  // Chart data for predictions
  const predictionChartData = forecast?.forecast?.predictions ? {
    labels: forecast.forecast.predictions.map(p => p.month),
    datasets: [
      {
        label: 'Predicted Enquiries',
        data: forecast.forecast.predictions.map(p => p.predicted_enquiries),
        backgroundColor: 'rgba(99, 102, 241, 0.8)',
        borderColor: '#6366f1',
        borderWidth: 1,
        borderRadius: 4
      },
      {
        label: 'Predicted Closures',
        data: forecast.forecast.predictions.map(p => p.predicted_closures),
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
        borderColor: '#22c55e',
        borderWidth: 1,
        borderRadius: 4
      }
    ]
  } : null;

  // KVA trend chart
  const kvaChartData = forecast?.forecast?.predictions ? {
    labels: forecast.forecast.predictions.map(p => p.month),
    datasets: [{
      label: 'Predicted Total KVA',
      data: forecast.forecast.predictions.map(p => p.predicted_total_kva || 0),
      borderColor: '#f59e0b',
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      fill: true,
      tension: 0.4
    }]
  } : null;

  // Backtest accuracy chart
  const backtestChartData = backtest?.detailed_results ? {
    labels: backtest.detailed_results.map(r => r.test_month),
    datasets: [
      {
        label: 'Actual Enquiries',
        data: backtest.detailed_results.map(r => r.actual.enquiries),
        borderColor: '#22c55e',
        backgroundColor: 'transparent',
        borderWidth: 2,
        tension: 0.3
      },
      {
        label: 'Predicted Enquiries',
        data: backtest.detailed_results.map(r => r.predicted.enquiries),
        borderColor: '#6366f1',
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [5, 5],
        tension: 0.3
      }
    ]
  } : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-primary" />
            AI-Powered Forecast
          </h1>
          <p className="text-muted-foreground mt-1">Generate intelligent predictions with KVA breakdown and accuracy testing</p>
        </div>
        {forecast && (
          <div className="flex gap-2">
            <ExportButton
              data={forecast.monthly_predictions?.map(p => ({
                period: p.period,
                predicted: p.predicted,
                lower_bound: p.lower_bound,
                upper_bound: p.upper_bound,
                lkva: p.kva_breakdown?.lkva || 0,
                mkva: p.kva_breakdown?.mkva || 0,
                hkva: p.kva_breakdown?.hkva || 0
              })) || []}
              filename="forecast_predictions"
              sheetName="Forecast"
              columns={[
                { key: 'period', header: 'Period', width: 15 },
                { key: 'predicted', header: 'Predicted', width: 12 },
                { key: 'lower_bound', header: 'Lower Bound', width: 15 },
                { key: 'upper_bound', header: 'Upper Bound', width: 15 },
                { key: 'lkva', header: 'LKVA', width: 10 },
                { key: 'mkva', header: 'MKVA', width: 10 },
                { key: 'hkva', header: 'HKVA', width: 10 }
              ]}
              size="sm"
            >
              Export Basic
            </ExportButton>
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={exportFullForecast}
              data-testid="export-full-btn"
            >
              <Download className="h-4 w-4" />
              Export Full Report
            </Button>
          </div>
        )}
      </div>

      {/* Action Buttons for other features */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={loadSavedForecasts} disabled={loadingSaved} className="gap-2" data-testid="view-saved-btn">
          {loadingSaved ? 'Loading...' : <><Archive className="h-4 w-4" />Saved Projections</>}
        </Button>
        <Button variant="outline" onClick={runBacktest} disabled={loadingBacktest} className="gap-2" data-testid="run-backtest-btn">
          {loadingBacktest ? 'Testing...' : <><FlaskConical className="h-4 w-4" />Backtest</>}
        </Button>
        <Button variant="outline" onClick={loadFactors} disabled={loadingFactors} className="gap-2" data-testid="view-factors-btn">
          {loadingFactors ? 'Loading...' : <><FileText className="h-4 w-4" />Factors</>}
        </Button>
      </div>

      {/* Loading for Backtest */}
      {loadingBacktest && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <p className="text-muted-foreground">Running rolling window backtest...</p>
              <p className="text-xs text-muted-foreground">This may take 30-60 seconds</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Tabs - Consolidated view */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="forecast" data-testid="tab-forecast">
            <Sparkles className="h-4 w-4 mr-2" />Forecast
          </TabsTrigger>
          <TabsTrigger value="compare" data-testid="tab-compare">
            <GitCompare className="h-4 w-4 mr-2" />Compare
          </TabsTrigger>
          <TabsTrigger value="saved" disabled={!savedForecasts} data-testid="tab-saved">
            <Archive className="h-4 w-4 mr-2" />Saved
          </TabsTrigger>
          <TabsTrigger value="backtest" disabled={!backtest} data-testid="tab-backtest">
            <FlaskConical className="h-4 w-4 mr-2" />Backtest
          </TabsTrigger>
          <TabsTrigger value="factors" disabled={!factors} data-testid="tab-factors">
            <FileText className="h-4 w-4 mr-2" />Factors
          </TabsTrigger>
        </TabsList>

        {/* Unified Forecast Tab - AI-Powered with all breakdowns */}
        <TabsContent value="forecast" className="space-y-6 mt-6">
          <AIForecastView />
        </TabsContent>

        {/* Compare Tab */}
        <TabsContent value="compare" className="space-y-6 mt-6">
          <CompareTab />
        </TabsContent>

          {/* Backtest Tab */}
          <TabsContent value="backtest" className="space-y-6 mt-6">
            {backtest && (
              <>
                {/* Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FlaskConical className="h-5 w-5" />
                      Backtest Summary
                    </CardTitle>
                    <CardDescription>
                      Rolling window test: {backtest.backtest_summary?.window_size_months} months training, {backtest.backtest_summary?.total_tests} test periods
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 rounded-lg bg-muted">
                        <p className="text-sm text-muted-foreground">Data Range</p>
                        <p className="font-medium">{backtest.backtest_summary?.data_range}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted">
                        <p className="text-sm text-muted-foreground">Total Months</p>
                        <p className="font-medium">{backtest.backtest_summary?.total_months_available}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted">
                        <p className="text-sm text-muted-foreground">Tests Run</p>
                        <p className="font-medium">{backtest.backtest_summary?.total_tests}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-green-50">
                        <p className="text-sm text-muted-foreground">Overall Accuracy</p>
                        <p className="font-bold text-2xl text-green-600">{backtest.accuracy_metrics?.overall_accuracy}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Accuracy Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <AccuracyMetricCard 
                    title="Enquiry Predictions" 
                    metrics={backtest.accuracy_metrics?.enquiries}
                    icon={Target}
                    color="bg-indigo-50"
                  />
                  <AccuracyMetricCard 
                    title="Closure Predictions" 
                    metrics={backtest.accuracy_metrics?.closures}
                    icon={CheckCircle2}
                    color="bg-green-50"
                  />
                  <AccuracyMetricCard 
                    title="KVA Predictions" 
                    metrics={backtest.accuracy_metrics?.kva}
                    icon={Zap}
                    color="bg-amber-50"
                  />
                </div>

                {/* Actual vs Predicted Chart */}
                {backtestChartData && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Actual vs Predicted (Enquiries)</CardTitle>
                      <CardDescription>Solid line = Actual, Dashed line = Predicted</CardDescription>
                    </CardHeader>
                    <CardContent className="h-80">
                      <Line 
                        data={backtestChartData}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: { legend: { position: 'top' } },
                          scales: {
                            y: { beginAtZero: false },
                            x: { grid: { display: false } }
                          }
                        }}
                      />
                    </CardContent>
                  </Card>
                )}

                {/* Detailed Results Table */}
                <Card>
                  <CardHeader>
                    <CardTitle>Detailed Test Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Test Month</TableHead>
                            <TableHead className="text-right">Actual Leads</TableHead>
                            <TableHead className="text-right">Predicted</TableHead>
                            <TableHead className="text-right">Error</TableHead>
                            <TableHead className="text-right">Error %</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {backtest.detailed_results?.map((result, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{result.test_month}</TableCell>
                              <TableCell className="text-right">{result.actual.enquiries}</TableCell>
                              <TableCell className="text-right">{result.predicted.enquiries}</TableCell>
                              <TableCell className={`text-right ${result.error.enquiries > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {result.error.enquiries > 0 ? '+' : ''}{result.error.enquiries}
                              </TableCell>
                              <TableCell className={`text-right ${Math.abs(result.error_pct.enquiries) > 15 ? 'text-red-600' : 'text-green-600'}`}>
                                {result.error_pct.enquiries > 0 ? '+' : ''}{result.error_pct.enquiries}%
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                {/* Recommendations & Improvements */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Lightbulb className="h-5 w-5 text-yellow-500" />
                        Recommendations
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {backtest.recommendations?.map((rec, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                            <span className="text-sm">{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-blue-500" />
                        Improvement Suggestions
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {backtest.improvement_suggestions?.map((sug, idx) => (
                          <div key={idx} className="flex items-start gap-3 p-2 rounded hover:bg-muted/50">
                            <Badge variant={sug.impact === 'High' ? 'default' : 'secondary'} className="shrink-0">
                              {sug.impact}
                            </Badge>
                            <div>
                              <p className="font-medium text-sm">{sug.factor}</p>
                              <p className="text-xs text-muted-foreground">{sug.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>

          {/* Factors Tab */}
          <TabsContent value="factors" className="space-y-6 mt-6">
            {factors && (
              <>
                {/* Data Quality */}
                <Card>
                  <CardHeader>
                    <CardTitle>Data Quality Overview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="p-4 rounded-lg bg-muted text-center">
                        <p className="text-3xl font-bold">{factors.data_quality?.total_leads?.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">Total Leads</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted text-center">
                        <p className="text-3xl font-bold">{factors.data_quality?.leads_with_kva?.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">With KVA Data</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted text-center">
                        <p className="text-3xl font-bold">{factors.data_quality?.kva_coverage}%</p>
                        <p className="text-sm text-muted-foreground">KVA Coverage</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted text-center">
                        <p className="text-3xl font-bold">{factors.data_quality?.date_coverage}%</p>
                        <p className="text-sm text-muted-foreground">Date Coverage</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted text-center">
                        <p className="text-3xl font-bold">{factors.data_quality?.months_of_data}</p>
                        <p className="text-sm text-muted-foreground">Months of Data</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Forecast Factors */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-green-600">Primary Factors (High Weight)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {factors.forecast_factors?.primary_factors?.map((f, idx) => (
                          <div key={idx} className="p-3 border rounded-lg">
                            <div className="flex items-center justify-between">
                              <p className="font-medium">{f.name}</p>
                              <Badge>{f.weight}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{f.description}</p>
                            {f.data_points && (
                              <p className="text-xs text-muted-foreground mt-1">Data points: {f.data_points}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-blue-600">Secondary Factors</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {factors.forecast_factors?.secondary_factors?.map((f, idx) => (
                          <div key={idx} className="p-3 border rounded-lg">
                            <div className="flex items-center justify-between">
                              <p className="font-medium">{f.name}</p>
                              <Badge variant="secondary">{f.weight}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{f.description}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Not Currently Used */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-amber-600">Factors Not Currently Used</CardTitle>
                    <CardDescription>These could improve forecast accuracy if data becomes available</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {factors.forecast_factors?.not_currently_used?.map((f, idx) => (
                        <Badge key={idx} variant="outline" className="text-muted-foreground">{f}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* KVA Products */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-amber-500" />
                      All KVA Products in Your Portfolio
                    </CardTitle>
                    <CardDescription>{factors.kva_products?.length} different generator capacities</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-10 gap-2">
                      {factors.kva_products?.map((kv, idx) => (
                        <div key={idx} className="p-2 rounded border text-center hover:bg-amber-50 transition-colors">
                          <p className="font-bold">{kv.kva}</p>
                          <p className="text-xs text-muted-foreground">KVA</p>
                          <p className="text-xs mt-1">{kv.percentage}%</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Methodology */}
                <Card>
                  <CardHeader>
                    <CardTitle>Forecast Methodology</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 border rounded-lg">
                        <p className="font-medium">Model Type</p>
                        <p className="text-sm text-muted-foreground">{factors.methodology?.model_type}</p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <p className="font-medium">AI Component</p>
                        <p className="text-sm text-muted-foreground">{factors.methodology?.ai_component}</p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <p className="font-medium">Statistical Component</p>
                        <p className="text-sm text-muted-foreground">{factors.methodology?.statistical_component}</p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <p className="font-medium">Fallback Strategy</p>
                        <p className="text-sm text-muted-foreground">{factors.methodology?.fallback}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Saved Projections Tab */}
          <TabsContent value="saved" className="space-y-6 mt-6">
            {savedForecasts && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Archive className="h-5 w-5" />
                      Saved Projections
                    </CardTitle>
                    <CardDescription>
                      {savedForecasts.total || savedForecasts.projections?.length || 0} projection{(savedForecasts.total || savedForecasts.projections?.length || 0) !== 1 ? 's' : ''} saved
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {(savedForecasts.forecasts?.length === 0 && savedForecasts.projections?.length === 0) ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Archive className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No saved projections yet</p>
                        <p className="text-sm">Generate a forecast and click "Save Projection" to save it here</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Support both old format (forecasts) and new format (projections) */}
                        {(savedForecasts.projections || savedForecasts.forecasts)?.map((saved, idx) => (
                          <Collapsible
                            key={saved.projection_id || idx}
                            open={expandedSaved === idx}
                            onOpenChange={() => setExpandedSaved(expandedSaved === idx ? null : idx)}
                          >
                            <div className="border rounded-lg overflow-hidden">
                              <CollapsibleTrigger className="w-full">
                                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-slate-50 cursor-pointer hover:from-gray-100 hover:to-slate-100">
                                  <div className="flex items-center gap-4">
                                    <div className="text-left">
                                      <p className="font-medium">
                                        {saved.projection_id ? `Projection ${saved.projection_id.slice(-6)}` : `Projection #${saved.index}`}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        Saved {new Date(saved.saved_at).toLocaleString()} by {saved.saved_by?.name || saved.saved_by || 'Unknown'}
                                      </p>
                                    </div>
                                    <Badge variant="secondary">
                                      {saved.parameters?.months_ahead || saved.forecast_data?.horizon_months || saved.horizon_months || 3} months
                                    </Badge>
                                    {saved.version && saved.version > 1 && (
                                      <Badge variant="outline">v{saved.version}</Badge>
                                    )}
                                    {(saved.dealer_forecasts?.length > 0 || saved.dealer_kva_forecast) && (
                                      <Badge className="bg-indigo-600">+ Dealers</Badge>
                                    )}
                                    {saved.model_selection && (
                                      <Badge className="bg-purple-600">AI Model</Badge>
                                    )}
                                    {saved.notes && (
                                      <Badge variant="outline" className="bg-amber-50">Has Notes</Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-4">
                                    {expandedSaved === idx ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                                  </div>
                                </div>
                              </CollapsibleTrigger>
                              
                              <CollapsibleContent>
                                <div className="p-4 border-t bg-white space-y-6">
                                  {/* Notes */}
                                  {saved.notes && (
                                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                                      <p className="text-sm text-amber-800 font-medium">Notes:</p>
                                      <p className="text-sm text-amber-700">{saved.notes}</p>
                                    </div>
                                  )}
                                  
                                  {/* New Format: Organization-level totals */}
                                  {saved.forecast_data?.organization_forecast && (
                                    <div>
                                      <h4 className="font-medium mb-2 flex items-center gap-2">
                                        <TrendingUp className="h-4 w-4" />
                                        Forecast Summary
                                      </h4>
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="p-3 bg-indigo-50 rounded-lg text-center">
                                          <p className="text-xs text-indigo-600 font-medium">Total Leads</p>
                                          <p className="text-2xl font-bold text-indigo-700">
                                            {saved.forecast_data.organization_forecast.totals?.leads?.toLocaleString() || 0}
                                          </p>
                                        </div>
                                        <div className="p-3 bg-green-50 rounded-lg text-center">
                                          <p className="text-xs text-green-600 font-medium">Total Closures</p>
                                          <p className="text-2xl font-bold text-green-700">
                                            {saved.forecast_data.organization_forecast.totals?.closures?.toLocaleString() || 0}
                                          </p>
                                        </div>
                                        {saved.model_selection && (
                                          <>
                                            <div className="p-3 bg-slate-50 rounded-lg text-center">
                                              <p className="text-xs text-slate-600 font-medium">Leads Model</p>
                                              <p className="text-sm font-semibold text-slate-700">{saved.model_selection.leads_model}</p>
                                            </div>
                                            <div className="p-3 bg-slate-50 rounded-lg text-center">
                                              <p className="text-xs text-slate-600 font-medium">Closures Model</p>
                                              <p className="text-sm font-semibold text-slate-700">{saved.model_selection.closures_model}</p>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* New Format: Monthly breakdown */}
                                  {saved.forecast_data?.organization_forecast?.months && (
                                    <div>
                                      <h4 className="font-medium mb-2 flex items-center gap-2">
                                        <Calendar className="h-4 w-4" />
                                        Monthly Forecast
                                      </h4>
                                      <div className="border rounded-lg overflow-hidden">
                                        <Table>
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead>Month</TableHead>
                                              <TableHead className="text-right">Leads</TableHead>
                                              <TableHead className="text-right">Closures</TableHead>
                                              <TableHead className="text-right">Conversion</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {saved.forecast_data.organization_forecast.months.map((m, midx) => (
                                              <TableRow key={midx}>
                                                <TableCell className="font-medium">{m.month_name || m.month}</TableCell>
                                                <TableCell className="text-right">{m.predicted_leads?.toLocaleString()}</TableCell>
                                                <TableCell className="text-right text-green-600 font-medium">{m.predicted_closures?.toLocaleString()}</TableCell>
                                                <TableCell className="text-right">{m.conversion_rate || 0}%</TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* New Format: Dealer forecasts with FULL month-wise breakdown (nested) */}
                                  {saved.dealer_forecasts && saved.dealer_forecasts.length > 0 && (
                                    <div>
                                      <h4 className="font-medium mb-2 flex items-center gap-2">
                                        <Building2 className="h-4 w-4" />
                                        Dealer Breakdown ({saved.dealer_forecasts.length} dealers)
                                      </h4>
                                      <div className="space-y-2 max-h-[500px] overflow-y-auto border rounded-lg p-3 bg-slate-50">
                                        {saved.dealer_forecasts.slice(0, 30).map((d, didx) => (
                                          <Collapsible key={didx}>
                                            <CollapsibleTrigger className="w-full">
                                              <div className="flex items-center justify-between p-3 bg-white hover:bg-gray-50 rounded-lg border transition-colors">
                                                <div className="flex items-center gap-3">
                                                  <ChevronRight className="w-4 h-4 text-gray-500" />
                                                  <Building2 className="w-4 h-4 text-indigo-500" />
                                                  <span className="font-medium text-left">{d.dealer}</span>
                                                  <Badge variant="outline" className="text-xs">
                                                    {d.months?.length || 0} months
                                                  </Badge>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                  <Badge className="bg-indigo-100 text-indigo-700">
                                                    {d.totals?.leads || 0} leads
                                                  </Badge>
                                                  <Badge className="bg-green-100 text-green-700">
                                                    {d.totals?.closures || 0} closures
                                                  </Badge>
                                                </div>
                                              </div>
                                            </CollapsibleTrigger>
                                            <CollapsibleContent>
                                              <div className="ml-7 mt-2 space-y-2">
                                                {/* Month-wise breakdown */}
                                                {d.months?.map((month, midx) => (
                                                  <Collapsible key={midx}>
                                                    <CollapsibleTrigger className="w-full">
                                                      <div className="flex items-center justify-between p-2 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-100 transition-colors">
                                                        <div className="flex items-center gap-2">
                                                          <ChevronRight className="w-3 h-3 text-indigo-500" />
                                                          <Calendar className="w-3 h-3 text-indigo-600" />
                                                          <span className="text-sm font-medium text-indigo-800">{month.month_name}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                          <Badge variant="outline" className="text-xs bg-white">
                                                            {month.predicted_leads || 0} leads
                                                          </Badge>
                                                          <Badge variant="outline" className="text-xs bg-white text-green-700">
                                                            {month.predicted_closures || 0} closures
                                                          </Badge>
                                                        </div>
                                                      </div>
                                                    </CollapsibleTrigger>
                                                    <CollapsibleContent>
                                                      <div className="ml-5 mt-2 p-3 bg-white border rounded-lg">
                                                        <div className="grid grid-cols-2 gap-4">
                                                          {/* KVA Breakdown */}
                                                          <div>
                                                            <p className="text-xs font-medium text-indigo-700 mb-2 flex items-center gap-1">
                                                              <Layers className="w-3 h-3" /> By KVA
                                                            </p>
                                                            <div className="space-y-1 max-h-32 overflow-y-auto">
                                                              {month.by_kva?.length > 0 ? month.by_kva.slice(0, 8).map((k, kidx) => (
                                                                <div key={kidx} className="flex justify-between text-xs p-1 bg-gray-50 rounded">
                                                                  <span>{k.kva} KVA</span>
                                                                  <span className="text-gray-600">{k.leads} leads, {k.closures} won</span>
                                                                </div>
                                                              )) : (
                                                                <p className="text-xs text-gray-400 italic">No KVA data</p>
                                                              )}
                                                            </div>
                                                          </div>
                                                          {/* District Breakdown */}
                                                          <div>
                                                            <p className="text-xs font-medium text-purple-700 mb-2 flex items-center gap-1">
                                                              <MapPin className="w-3 h-3" /> By District
                                                            </p>
                                                            <div className="space-y-1 max-h-32 overflow-y-auto">
                                                              {month.by_district?.length > 0 ? month.by_district.slice(0, 8).map((dist, distidx) => (
                                                                <div key={distidx} className="flex justify-between text-xs p-1 bg-gray-50 rounded">
                                                                  <span className="truncate max-w-[100px]">{dist.district}</span>
                                                                  <span className="text-gray-600">{dist.leads} leads, {dist.closures} won</span>
                                                                </div>
                                                              )) : (
                                                                <p className="text-xs text-gray-400 italic">No district data</p>
                                                              )}
                                                            </div>
                                                          </div>
                                                        </div>
                                                      </div>
                                                    </CollapsibleContent>
                                                  </Collapsible>
                                                ))}
                                              </div>
                                            </CollapsibleContent>
                                          </Collapsible>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Old Format: Summary */}
                                  {(saved.forecast_data?.forecast?.summary || saved.summary) && (
                                    <div className="p-3 bg-muted/50 rounded-lg">
                                      <p className="text-sm">{saved.forecast_data?.forecast?.summary || saved.summary}</p>
                                    </div>
                                  )}
                                  
                                  {/* Old Format: Monthly Predictions Table */}
                                  {(saved.forecast_data?.forecast?.predictions || saved.predictions) && (
                                    <div>
                                      <h4 className="font-medium mb-2 flex items-center gap-2">
                                        <Calendar className="h-4 w-4" />
                                        Monthly Forecast
                                      </h4>
                                      <div className="border rounded-lg overflow-hidden">
                                        <Table>
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead>Month</TableHead>
                                              <TableHead className="text-right">Predicted Leads</TableHead>
                                              <TableHead className="text-right">Predicted Closures</TableHead>
                                              <TableHead className="text-right">Total KVA</TableHead>
                                              <TableHead className="text-right">Conv. Rate</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {(saved.forecast_data?.forecast?.predictions || saved.predictions)?.map((pred, pidx) => (
                                              <TableRow key={pidx}>
                                                <TableCell className="font-medium">{pred.month || pred.forecast_month}</TableCell>
                                                <TableCell className="text-right">{(pred.predicted_enquiries || pred.enquiries)?.toLocaleString()}</TableCell>
                                                <TableCell className="text-right text-green-600 font-medium">{(pred.predicted_closures || pred.closures)?.toLocaleString()}</TableCell>
                                                <TableCell className="text-right">{(pred.predicted_total_kva || pred.total_kva)?.toLocaleString()}</TableCell>
                                                <TableCell className="text-right">{pred.overall_conversion_rate || pred.conversion_rate}%</TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    </div>
                                  )}

                                  {/* Scenario Summary */}
                                  {saved.scenarios?.scenario_totals && (
                                    <div>
                                      <h4 className="font-medium mb-2 flex items-center gap-2">
                                        <Zap className="h-4 w-4" />
                                        Forecast Scenarios
                                      </h4>
                                      <div className="grid grid-cols-3 gap-4">
                                        <div className="p-3 bg-red-50 rounded-lg text-center">
                                          <p className="text-xs text-red-600 font-medium">Pessimistic</p>
                                          <p className="text-lg font-bold text-red-700">{saved.scenarios.scenario_totals.pessimistic?.total_leads}</p>
                                          <p className="text-xs text-red-500">{saved.scenarios.scenario_totals.pessimistic?.total_won} won</p>
                                        </div>
                                        <div className="p-3 bg-indigo-50 rounded-lg text-center">
                                          <p className="text-xs text-indigo-600 font-medium">Realistic</p>
                                          <p className="text-lg font-bold text-indigo-700">{saved.scenarios.scenario_totals.realistic?.total_leads}</p>
                                          <p className="text-xs text-indigo-500">{saved.scenarios.scenario_totals.realistic?.total_won} won</p>
                                        </div>
                                        <div className="p-3 bg-green-50 rounded-lg text-center">
                                          <p className="text-xs text-green-600 font-medium">Optimistic</p>
                                          <p className="text-lg font-bold text-green-700">{saved.scenarios.scenario_totals.optimistic?.total_leads}</p>
                                          <p className="text-xs text-green-500">{saved.scenarios.scenario_totals.optimistic?.total_won} won</p>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Dealer-KVA Summary */}
                                  {saved.dealer_kva_forecast?.dealer_forecasts && (
                                    <div>
                                      <h4 className="font-medium mb-2 flex items-center gap-2">
                                        <Layers className="h-4 w-4" />
                                        Dealer-KVA Forecast ({saved.dealer_kva_forecast.grand_total_units} total units)
                                      </h4>
                                      <div className="max-h-48 overflow-y-auto border rounded-lg">
                                        <Table>
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead>Dealer</TableHead>
                                              <TableHead className="text-right">Total Units</TableHead>
                                              <TableHead className="text-right">KVA Breakdown</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {saved.dealer_kva_forecast.dealer_forecasts.slice(0, 10).map((d, didx) => (
                                              <TableRow key={didx}>
                                                <TableCell className="font-medium">{d.dealer}</TableCell>
                                                <TableCell className="text-right">{d.total_units}</TableCell>
                                                <TableCell className="text-right text-xs text-gray-500">
                                                  {d.kva_breakdown?.slice(0, 3).map(k => `${k.kva}KVA:${k.predicted_units}`).join(', ')}
                                                </TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    </div>
                                  )}

                                  {/* Dealer-District Summary */}
                                  {saved.dealer_district_forecast?.dealer_forecasts && (
                                    <div>
                                      <h4 className="font-medium mb-2 flex items-center gap-2">
                                        <MapPin className="h-4 w-4" />
                                        Dealer-District Forecast ({saved.dealer_district_forecast.grand_total_units} total units)
                                      </h4>
                                      <div className="max-h-48 overflow-y-auto border rounded-lg">
                                        <Table>
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead>Dealer</TableHead>
                                              <TableHead className="text-right">Districts</TableHead>
                                              <TableHead className="text-right">Total Units</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {saved.dealer_district_forecast.dealer_forecasts.slice(0, 10).map((d, didx) => (
                                              <TableRow key={didx}>
                                                <TableCell className="font-medium">{d.dealer}</TableCell>
                                                <TableCell className="text-right">{d.districts_count || d.district_breakdown?.length}</TableCell>
                                                <TableCell className="text-right">{d.total_units}</TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    </div>
                                  )}

                                  {/* Seasonality Insights */}
                                  {saved.seasonality && (
                                    <div>
                                      <h4 className="font-medium mb-2 flex items-center gap-2">
                                        <Calendar className="h-4 w-4" />
                                        Seasonality Insights
                                      </h4>
                                      <div className="grid grid-cols-2 gap-4">
                                        {saved.seasonality.best_month && (
                                          <div className="p-3 bg-green-50 rounded-lg">
                                            <p className="text-xs text-green-600">Best Month</p>
                                            <p className="font-bold text-green-700">{saved.seasonality.best_month.month_name}</p>
                                            <p className="text-xs">Index: {saved.seasonality.best_month.seasonality_index}</p>
                                          </div>
                                        )}
                                        {saved.seasonality.worst_month && (
                                          <div className="p-3 bg-red-50 rounded-lg">
                                            <p className="text-xs text-red-600">Weakest Month</p>
                                            <p className="font-bold text-red-700">{saved.seasonality.worst_month.month_name}</p>
                                            <p className="text-xs">Index: {saved.seasonality.worst_month.seasonality_index}</p>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Audit Trail */}
                                  {saved.audit_trail && saved.audit_trail.length > 0 && (
                                    <div>
                                      <h4 className="font-medium mb-2 flex items-center gap-2">
                                        <FileText className="h-4 w-4" />
                                        Audit Trail
                                      </h4>
                                      <div className="space-y-2 max-h-32 overflow-y-auto">
                                        {saved.audit_trail.map((entry, aidx) => (
                                          <div key={aidx} className="text-xs p-2 bg-gray-50 rounded flex justify-between">
                                            <span className="font-medium">{entry.action}</span>
                                            <span className="text-gray-500">
                                              {entry.user} • {new Date(entry.timestamp).toLocaleString()}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Metadata */}
                                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2 border-t">
                                    {saved.model_info?.type && <span>Model: {saved.model_info?.type}</span>}
                                    {saved.model_info?.training_months && <span>Training: {saved.model_info?.training_months} months</span>}
                                    {saved.version && <span>Version: {saved.version}</span>}
                                  </div>
                                </div>
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
    </div>
  );
};

export default Forecast;
