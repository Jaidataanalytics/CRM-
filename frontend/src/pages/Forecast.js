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
  Sparkles, TrendingUp, AlertCircle, Lightbulb, Calendar, 
  ChevronDown, ChevronRight, Zap, BarChart3, Target,
  CheckCircle2, XCircle, Info, FlaskConical, FileText,
  MapPin, Building2, Users, Layers, Save, Archive, Trash2
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

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

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
      
      const res = await axios.post(`${API}/forecast`, payload, { withCredentials: true });
      
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
      const res = await axios.post(`${API}/forecast/save`, {
        forecast_data: forecast
      }, { withCredentials: true });
      
      if (res.data.success) {
        toast.success('Projection saved successfully!');
        // Refresh saved forecasts list if viewing
        if (savedForecasts) {
          loadSavedForecasts();
        }
      } else {
        toast.error(res.data.message || 'Failed to save projection');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save projection');
    } finally {
      setLoadingSave(false);
    }
  };

  const loadSavedForecasts = async () => {
    setLoadingSaved(true);
    try {
      const res = await axios.get(`${API}/forecast/saved`, { withCredentials: true });
      if (res.data.success) {
        setSavedForecasts(res.data);
        setActiveTab('saved');
        toast.success(`${res.data.total} saved projections loaded`);
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
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-8 w-8 text-primary" />
          AI-Powered Forecast
        </h1>
        <p className="text-muted-foreground mt-1">Generate intelligent predictions with KVA breakdown and accuracy testing</p>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Forecast Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Settings */}
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>Forecast Horizon</Label>
              <Select value={horizon} onValueChange={setHorizon}>
                <SelectTrigger className="w-40" data-testid="horizon-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 Months</SelectItem>
                  <SelectItem value="6">6 Months</SelectItem>
                  <SelectItem value="12">12 Months</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>State (Optional)</Label>
              <Input
                placeholder="Filter by state..."
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-48"
                data-testid="state-filter"
              />
            </div>
            <div className="space-y-2">
              <Label>Dealer (Optional)</Label>
              <Input
                placeholder="Filter by dealer..."
                value={dealer}
                onChange={(e) => setDealer(e.target.value)}
                className="w-48"
                data-testid="dealer-filter"
              />
            </div>
          </div>
          
          {/* Business Context Toggle */}
          <div className="border-t pt-4">
            <Button 
              variant="ghost" 
              onClick={() => setShowBusinessContext(!showBusinessContext)}
              className="w-full justify-between"
              data-testid="toggle-business-context"
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                <span>Business Context Adjustments</span>
                {(marketingEffort !== 'same' || campaignType !== 'none' || marketConditions !== 'stable' || seasonalFactor !== 'normal') && (
                  <Badge variant="secondary" className="bg-green-100 text-green-700">Active</Badge>
                )}
              </div>
              {showBusinessContext ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
            
            {showBusinessContext && (
              <div className="mt-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg space-y-4">
                <p className="text-sm text-muted-foreground">
                  Adjust predictions based on planned marketing activities and market conditions
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Marketing Effort */}
                  <div className="space-y-2">
                    <Label className="text-xs">Marketing Effort</Label>
                    <Select value={marketingEffort} onValueChange={setMarketingEffort}>
                      <SelectTrigger data-testid="marketing-effort-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="decreasing">Decreasing</SelectItem>
                        <SelectItem value="same">Same as before</SelectItem>
                        <SelectItem value="increasing">Increasing</SelectItem>
                      </SelectContent>
                    </Select>
                    {marketingEffort !== 'same' && (
                      <div className="pt-2">
                        <Label className="text-xs text-muted-foreground">Intensity ({marketingIntensity}%)</Label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={marketingIntensity}
                          onChange={(e) => setMarketingIntensity(e.target.value)}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    )}
                  </div>
                  
                  {/* Campaign Type */}
                  <div className="space-y-2">
                    <Label className="text-xs">Promotional Campaign</Label>
                    <Select value={campaignType} onValueChange={setCampaignType}>
                      <SelectTrigger data-testid="campaign-type-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No campaign</SelectItem>
                        <SelectItem value="minor">Minor campaign (+10%)</SelectItem>
                        <SelectItem value="major">Major campaign (+25%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Market Conditions */}
                  <div className="space-y-2">
                    <Label className="text-xs">Market Conditions</Label>
                    <Select value={marketConditions} onValueChange={setMarketConditions}>
                      <SelectTrigger data-testid="market-conditions-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="challenging">Challenging (-10%)</SelectItem>
                        <SelectItem value="stable">Stable</SelectItem>
                        <SelectItem value="growing">Growing (+15%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Seasonal Factor */}
                  <div className="space-y-2">
                    <Label className="text-xs">Expected Demand</Label>
                    <Select value={seasonalFactor} onValueChange={setSeasonalFactor}>
                      <SelectTrigger data-testid="seasonal-factor-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low_demand">Low demand (-15%)</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high_demand">High demand (+20%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Reset Button */}
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setMarketingEffort('same');
                    setMarketingIntensity(50);
                    setCampaignType('none');
                    setMarketConditions('stable');
                    setSeasonalFactor('normal');
                  }}
                  data-testid="reset-context-btn"
                >
                  Reset to Default
                </Button>
              </div>
            )}
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button onClick={generateForecast} disabled={loading} className="gap-2" data-testid="generate-forecast-btn">
              {loading ? 'Generating...' : <><Sparkles className="h-4 w-4" />Generate Forecast</>}
            </Button>
            <Button variant="outline" onClick={runBacktest} disabled={loadingBacktest} className="gap-2" data-testid="run-backtest-btn">
              {loadingBacktest ? 'Testing...' : <><FlaskConical className="h-4 w-4" />Backtest</>}
            </Button>
            <Button variant="outline" onClick={loadFactors} disabled={loadingFactors} className="gap-2" data-testid="view-factors-btn">
              {loadingFactors ? 'Loading...' : <><FileText className="h-4 w-4" />Factors</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {(loading || loadingBacktest) && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <p className="text-muted-foreground">
                {loading ? 'AI is analyzing data and generating detailed forecast...' : 'Running rolling window backtest...'}
              </p>
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

      {/* Results Tabs */}
      {(forecast || backtest || factors) && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="forecast" disabled={!forecast} data-testid="tab-forecast">
              <Sparkles className="h-4 w-4 mr-2" />Forecast
            </TabsTrigger>
            <TabsTrigger value="backtest" disabled={!backtest} data-testid="tab-backtest">
              <FlaskConical className="h-4 w-4 mr-2" />Backtest Results
            </TabsTrigger>
            <TabsTrigger value="factors" disabled={!factors} data-testid="tab-factors">
              <FileText className="h-4 w-4 mr-2" />Factors
            </TabsTrigger>
          </TabsList>

          {/* Forecast Tab */}
          <TabsContent value="forecast" className="space-y-6 mt-6">
            {forecast?.success && forecast.forecast && (
              <>
                {/* Trend Analysis */}
                {forecast.forecast.trend_analysis && (
                  <Card className="bg-gradient-to-br from-blue-50 to-indigo-50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Trend Analysis
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Volume Trend</p>
                          <p className="font-medium">{forecast.forecast.trend_analysis.volume_trend}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Conversion Trend</p>
                          <p className="font-medium">{forecast.forecast.trend_analysis.conversion_trend}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">KVA Mix Trend</p>
                          <p className="font-medium">{forecast.forecast.trend_analysis.kva_mix_trend}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Seasonal Patterns</p>
                          <p className="font-medium">{forecast.forecast.trend_analysis.seasonal_patterns}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Business Adjustments Applied */}
                {forecast.business_adjustments?.applied && (
                  <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-green-600" />
                        Business Context Adjustments Applied
                        <Badge className="bg-green-600">{forecast.business_adjustments.total_adjustment}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {forecast.business_adjustments.details?.map((detail, idx) => (
                          <Badge key={idx} variant="outline" className="bg-white border-green-300">
                            {detail}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-3">
                        Base predictions have been adjusted by a multiplier of {forecast.business_adjustments.multiplier}x based on your business inputs.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Summary */}
                <Card className="bg-gradient-to-br from-primary/5 to-primary/10">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Info className="h-5 w-5" />
                      Forecast Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{forecast.forecast.summary}</p>
                    
                    {forecast.forecast.factors_considered && (
                      <div className="mt-4">
                        <h4 className="font-medium mb-2">Factors Considered:</h4>
                        <div className="flex flex-wrap gap-2">
                          {forecast.forecast.factors_considered.map((factor, idx) => (
                            <Badge key={idx} variant="secondary">{factor}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {predictionChartData && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Lead & Closure Predictions</CardTitle>
                      </CardHeader>
                      <CardContent className="h-72">
                        <Bar 
                          data={predictionChartData}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { position: 'top' } },
                            scales: {
                              y: { beginAtZero: true, ticks: { callback: (v) => v.toLocaleString() } },
                              x: { grid: { display: false } }
                            }
                          }}
                        />
                      </CardContent>
                    </Card>
                  )}

                  {kvaChartData && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Total KVA Trend</CardTitle>
                      </CardHeader>
                      <CardContent className="h-72">
                        <Line 
                          data={kvaChartData}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { position: 'top' } },
                            scales: {
                              y: { beginAtZero: false, ticks: { callback: (v) => v.toLocaleString() } },
                              x: { grid: { display: false } }
                            }
                          }}
                        />
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* KVA Distribution */}
                {forecast.kva_distribution && forecast.kva_distribution.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-amber-500" />
                        Historical KVA Product Distribution
                      </CardTitle>
                      <CardDescription>Your generator portfolio based on historical data</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                        {forecast.kva_distribution.map((kv, idx) => (
                          <div key={idx} className="p-2 rounded border text-center hover:bg-muted/50 transition-colors">
                            <p className="font-bold text-lg">{kv.kva}</p>
                            <p className="text-xs text-muted-foreground">KVA</p>
                            <p className="text-sm font-medium mt-1">{kv.count.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">{kv.percentage}%</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Monthly Predictions with KVA Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Detailed Monthly Predictions
                    </CardTitle>
                    <CardDescription>Click on a month to see KVA breakdown</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {forecast.forecast.predictions?.map((prediction, idx) => (
                      <Collapsible 
                        key={idx} 
                        open={expandedMonth === idx}
                        onOpenChange={() => setExpandedMonth(expandedMonth === idx ? null : idx)}
                      >
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors">
                            <div className="flex items-center gap-4">
                              <div className="text-lg font-bold">{prediction.month}</div>
                              <Badge variant={
                                prediction.confidence === 'high' ? 'default' :
                                prediction.confidence === 'medium' ? 'secondary' : 'outline'
                              }>
                                {prediction.confidence} confidence
                              </Badge>
                            </div>
                            <div className="flex items-center gap-6">
                              <div className="text-right">
                                <p className="text-2xl font-bold text-primary">{prediction.predicted_enquiries?.toLocaleString()}</p>
                                <p className="text-xs text-muted-foreground">Leads</p>
                              </div>
                              <div className="text-right">
                                <p className="text-2xl font-bold text-green-600">{prediction.predicted_closures?.toLocaleString()}</p>
                                <p className="text-xs text-muted-foreground">Closures</p>
                              </div>
                              <div className="text-right">
                                <p className="text-2xl font-bold text-amber-600">{prediction.predicted_total_kva?.toLocaleString()}</p>
                                <p className="text-xs text-muted-foreground">Total KVA</p>
                              </div>
                              {expandedMonth === idx ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        
                        <CollapsibleContent>
                          <div className="mt-2 space-y-2">
                            {/* KVA Breakdown */}
                            {prediction.breakdown?.by_kva && (
                              <div className="border rounded-lg">
                                <KVABreakdownSection
                                  data={prediction.breakdown.by_kva}
                                  expanded={expandedBreakdown[`${idx}-kva`] !== false}
                                  onToggle={() => toggleBreakdown(idx, 'kva')}
                                />
                              </div>
                            )}
                            
                            {/* State Breakdown */}
                            {prediction.breakdown?.by_state && prediction.breakdown.by_state.length > 0 && (
                              <div className="border rounded-lg">
                                <GenericBreakdownSection
                                  data={prediction.breakdown.by_state}
                                  title="State Breakdown"
                                  icon={MapPin}
                                  iconColor="text-blue-600"
                                  bgGradient="bg-gradient-to-r from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100"
                                  fieldName="state"
                                  expanded={expandedBreakdown[`${idx}-state`] === true}
                                  onToggle={() => toggleBreakdown(idx, 'state')}
                                />
                              </div>
                            )}
                            
                            {/* Dealer Breakdown */}
                            {prediction.breakdown?.by_dealer && prediction.breakdown.by_dealer.length > 0 && (
                              <div className="border rounded-lg">
                                <GenericBreakdownSection
                                  data={prediction.breakdown.by_dealer}
                                  title="Dealer Breakdown"
                                  icon={Building2}
                                  iconColor="text-purple-600"
                                  bgGradient="bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100"
                                  fieldName="dealer"
                                  expanded={expandedBreakdown[`${idx}-dealer`] === true}
                                  onToggle={() => toggleBreakdown(idx, 'dealer')}
                                />
                              </div>
                            )}
                            
                            {/* Employee Breakdown */}
                            {prediction.breakdown?.by_employee && prediction.breakdown.by_employee.length > 0 && (
                              <div className="border rounded-lg">
                                <GenericBreakdownSection
                                  data={prediction.breakdown.by_employee}
                                  title="Employee Breakdown"
                                  icon={Users}
                                  iconColor="text-green-600"
                                  bgGradient="bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100"
                                  fieldName="employee"
                                  expanded={expandedBreakdown[`${idx}-employee`] === true}
                                  onToggle={() => toggleBreakdown(idx, 'employee')}
                                />
                              </div>
                            )}
                            
                            {/* Segment Breakdown */}
                            {prediction.breakdown?.by_segment && prediction.breakdown.by_segment.length > 0 && (
                              <div className="border rounded-lg">
                                <GenericBreakdownSection
                                  data={prediction.breakdown.by_segment}
                                  title="Segment Breakdown"
                                  icon={Layers}
                                  iconColor="text-indigo-600"
                                  bgGradient="bg-gradient-to-r from-indigo-50 to-violet-50 hover:from-indigo-100 hover:to-violet-100"
                                  fieldName="segment"
                                  expanded={expandedBreakdown[`${idx}-segment`] === true}
                                  onToggle={() => toggleBreakdown(idx, 'segment')}
                                />
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </CardContent>
                </Card>

                {/* Recommendations & Risks */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {forecast.forecast.recommendations && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Lightbulb className="h-5 w-5 text-yellow-500" />
                          Recommendations
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {forecast.forecast.recommendations.map((rec, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                              <span className="text-sm">{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {forecast.forecast.risks && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <AlertCircle className="h-5 w-5 text-red-500" />
                          Risks & Uncertainties
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {forecast.forecast.risks.map((risk, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                              <span className="text-sm">{risk}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </>
            )}
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
        </Tabs>
      )}
    </div>
  );
};

export default Forecast;
