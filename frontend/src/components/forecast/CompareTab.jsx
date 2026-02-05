import { useState, useEffect } from 'react';
import axios from 'axios';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { 
  TrendingUp, TrendingDown, Minus, Target, BarChart3, 
  Calendar, RefreshCw, CheckCircle2, XCircle, AlertCircle,
  FileText, GitCompare, Settings, Save, Loader2
} from 'lucide-react';
import { Bar, Line } from 'react-chartjs-2';

const API = '/api';

const COLORS = [
  '#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', 
  '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#84cc16'
];

// Get current fiscal year
const getCurrentFiscalYear = () => {
  const now = new Date();
  if (now.getMonth() >= 3) { // April onwards
    return `${now.getFullYear()}-${String(now.getFullYear() + 1).slice(2)}`;
  }
  return `${now.getFullYear() - 1}-${String(now.getFullYear()).slice(2)}`;
};

// Get months in fiscal year
const getFiscalYearMonths = (fiscalYear) => {
  const [startYear] = fiscalYear.split('-').map(y => y.length === 2 ? `20${y}` : y);
  const months = [];
  for (let i = 4; i <= 12; i++) {
    months.push(`${startYear}-${String(i).padStart(2, '0')}`);
  }
  for (let i = 1; i <= 3; i++) {
    months.push(`${parseInt(startYear) + 1}-${String(i).padStart(2, '0')}`);
  }
  return months;
};

export const CompareTab = () => {
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [savedForecasts, setSavedForecasts] = useState([]);
  const [selectedProjectionId, setSelectedProjectionId] = useState(null);
  const [comparisonData, setComparisonData] = useState(null);
  const [selectedForecast, setSelectedForecast] = useState(null);
  
  // Targets state
  const [targets, setTargets] = useState(null);
  const [targetsFiscalYear, setTargetsFiscalYear] = useState(getCurrentFiscalYear());
  const [showTargetsDialog, setShowTargetsDialog] = useState(false);
  const [savingTargets, setSavingTargets] = useState(false);
  const [editTargets, setEditTargets] = useState({
    yearly: { leads: 0, closures: 0 },
    half_yearly: {
      H1: { leads: 0, closures: 0 },
      H2: { leads: 0, closures: 0 }
    },
    quarterly: {
      Q1: { leads: 0, closures: 0 },
      Q2: { leads: 0, closures: 0 },
      Q3: { leads: 0, closures: 0 },
      Q4: { leads: 0, closures: 0 }
    },
    monthly: {}
  });

  useEffect(() => {
    loadSavedForecasts();
    loadTargets();
  }, []);

  useEffect(() => {
    if (selectedProjectionId) {
      const forecast = savedForecasts.find(f => f.projection_id === selectedProjectionId || f.index?.toString() === selectedProjectionId);
      setSelectedForecast(forecast);
    } else {
      setSelectedForecast(null);
    }
  }, [selectedProjectionId, savedForecasts]);

  const loadSavedForecasts = async () => {
    setLoading(true);
    try {
      let forecasts = [];
      try {
        const enhancedRes = await axios.get(`${API}/forecast-enhanced/projections`, { withCredentials: true });
        if (enhancedRes.data.projections?.length > 0) {
          forecasts = enhancedRes.data.projections.map((p, idx) => ({
            ...p,
            index: idx,
            label: `${p.projection_id?.slice(-6) || idx} - ${new Date(p.saved_at).toLocaleDateString()}`
          }));
        }
      } catch (e) {
        console.log('Enhanced API not available');
      }
      
      try {
        const legacyRes = await axios.get(`${API}/forecast/saved`, { withCredentials: true });
        if (legacyRes.data.forecasts?.length > 0) {
          const legacyForecasts = legacyRes.data.forecasts.map((f, idx) => ({
            ...f,
            label: `Legacy #${f.index || idx} - ${new Date(f.saved_at).toLocaleDateString()}`
          }));
          forecasts = [...forecasts, ...legacyForecasts];
        }
      } catch (e) {
        console.log('Legacy API not available');
      }
      
      setSavedForecasts(forecasts);
    } catch (error) {
      console.error('Error loading forecasts:', error);
      toast.error('Failed to load saved forecasts');
    } finally {
      setLoading(false);
    }
  };

  const loadTargets = async () => {
    try {
      const res = await axios.get(`${API}/forecast-enhanced/targets?fiscal_year=${targetsFiscalYear}`, { withCredentials: true });
      if (res.data.success) {
        setTargets(res.data);
        setEditTargets(res.data.targets || {
          yearly: { leads: 0, closures: 0 },
          half_yearly: { H1: { leads: 0, closures: 0 }, H2: { leads: 0, closures: 0 } },
          quarterly: { Q1: { leads: 0, closures: 0 }, Q2: { leads: 0, closures: 0 }, Q3: { leads: 0, closures: 0 }, Q4: { leads: 0, closures: 0 } },
          monthly: {}
        });
      }
    } catch (error) {
      console.error('Error loading targets:', error);
    }
  };

  const saveTargets = async () => {
    setSavingTargets(true);
    try {
      const res = await axios.post(`${API}/forecast-enhanced/targets`, {
        fiscal_year: targetsFiscalYear,
        targets: editTargets
      }, { withCredentials: true });
      
      if (res.data.success) {
        toast.success('Targets saved successfully');
        setShowTargetsDialog(false);
        loadTargets();
      }
    } catch (error) {
      console.error('Error saving targets:', error);
      toast.error('Failed to save targets');
    } finally {
      setSavingTargets(false);
    }
  };

  const handleCompare = async () => {
    if (!selectedProjectionId) {
      toast.error('Please select a forecast to compare');
      return;
    }
    
    setComparing(true);
    try {
      const forecast = savedForecasts.find(f => f.projection_id === selectedProjectionId || f.index?.toString() === selectedProjectionId);
      
      if (forecast?.projection_id) {
        // Use the new compare with targets endpoint
        const res = await axios.get(`${API}/forecast-enhanced/targets/compare/${forecast.projection_id}`, { withCredentials: true });
        setComparisonData(res.data);
      } else {
        const res = await axios.get(`${API}/forecast/compare/${selectedProjectionId}`, { withCredentials: true });
        setComparisonData(res.data);
      }
      toast.success('Comparison loaded successfully');
    } catch (error) {
      console.error('Error comparing:', error);
      toast.error(error.response?.data?.detail || 'Failed to compare forecast');
    } finally {
      setComparing(false);
    }
  };

  const getAccuracyColor = (accuracy) => {
    if (accuracy >= 80) return 'text-green-600 bg-green-100';
    if (accuracy >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getVarianceIcon = (variance) => {
    if (variance > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (variance < 0) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const updateEditTarget = (path, field, value) => {
    const numValue = parseInt(value) || 0;
    setEditTargets(prev => {
      const newTargets = { ...prev };
      if (path === 'yearly') {
        newTargets.yearly = { ...newTargets.yearly, [field]: numValue };
      } else if (path.startsWith('H')) {
        newTargets.half_yearly = { ...newTargets.half_yearly, [path]: { ...newTargets.half_yearly[path], [field]: numValue } };
      } else if (path.startsWith('Q')) {
        newTargets.quarterly = { ...newTargets.quarterly, [path]: { ...newTargets.quarterly[path], [field]: numValue } };
      } else {
        // Monthly
        newTargets.monthly = { ...newTargets.monthly, [path]: { ...newTargets.monthly[path], [field]: numValue } };
      }
      return newTargets;
    });
  };

  // Chart data with targets
  const getComparisonChartData = () => {
    if (!comparisonData?.monthly_comparison) return null;
    
    const data = comparisonData.monthly_comparison;
    return {
      labels: data.map(m => m.month_name?.split(' ')[0] || m.month?.substring(5, 7) || ''),
      datasets: [
        {
          label: 'Target',
          data: data.map(m => m.target?.leads || 0),
          backgroundColor: 'rgba(245, 158, 11, 0.7)',
          borderRadius: 4
        },
        {
          label: 'Predicted',
          data: data.map(m => m.predicted?.leads || 0),
          backgroundColor: 'rgba(99, 102, 241, 0.7)',
          borderRadius: 4
        },
        {
          label: 'Actual',
          data: data.map(m => m.actual?.leads || 0),
          backgroundColor: 'rgba(34, 197, 94, 0.7)',
          borderRadius: 4
        }
      ]
    };
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-500">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  const comparisonChartData = getComparisonChartData();

  return (
    <div className="space-y-6">
      {/* Header with Targets Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <GitCompare className="h-6 w-6 text-indigo-600" />
            Compare: Target vs Predicted vs Actual
          </h2>
          <p className="text-sm text-muted-foreground">
            Compare forecasts against targets and actual results
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showTargetsDialog} onOpenChange={setShowTargetsDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Target className="h-4 w-4" />
                Set Targets
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Set Targets for FY {targetsFiscalYear}</DialogTitle>
                <DialogDescription>
                  Define your leads and closure targets at different levels
                </DialogDescription>
              </DialogHeader>
              
              <Tabs defaultValue="yearly" className="mt-4">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="yearly">Yearly</TabsTrigger>
                  <TabsTrigger value="half_yearly">Half-Yearly</TabsTrigger>
                  <TabsTrigger value="quarterly">Quarterly</TabsTrigger>
                  <TabsTrigger value="monthly">Monthly</TabsTrigger>
                </TabsList>
                
                {/* Yearly */}
                <TabsContent value="yearly" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Annual Targets</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Total Leads Target</Label>
                        <Input
                          type="number"
                          value={editTargets.yearly?.leads || 0}
                          onChange={(e) => updateEditTarget('yearly', 'leads', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Total Closures Target</Label>
                        <Input
                          type="number"
                          value={editTargets.yearly?.closures || 0}
                          onChange={(e) => updateEditTarget('yearly', 'closures', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                {/* Half-Yearly */}
                <TabsContent value="half_yearly" className="space-y-4">
                  {['H1', 'H2'].map(half => (
                    <Card key={half}>
                      <CardHeader>
                        <CardTitle className="text-lg">
                          {half} ({half === 'H1' ? 'Apr-Sep' : 'Oct-Mar'})
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Leads Target</Label>
                          <Input
                            type="number"
                            value={editTargets.half_yearly?.[half]?.leads || 0}
                            onChange={(e) => updateEditTarget(half, 'leads', e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label>Closures Target</Label>
                          <Input
                            type="number"
                            value={editTargets.half_yearly?.[half]?.closures || 0}
                            onChange={(e) => updateEditTarget(half, 'closures', e.target.value)}
                            className="mt-1"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>
                
                {/* Quarterly */}
                <TabsContent value="quarterly" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { q: 'Q1', label: 'Q1 (Apr-Jun)' },
                      { q: 'Q2', label: 'Q2 (Jul-Sep)' },
                      { q: 'Q3', label: 'Q3 (Oct-Dec)' },
                      { q: 'Q4', label: 'Q4 (Jan-Mar)' }
                    ].map(({ q, label }) => (
                      <Card key={q}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">{label}</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Leads</Label>
                            <Input
                              type="number"
                              value={editTargets.quarterly?.[q]?.leads || 0}
                              onChange={(e) => updateEditTarget(q, 'leads', e.target.value)}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Closures</Label>
                            <Input
                              type="number"
                              value={editTargets.quarterly?.[q]?.closures || 0}
                              onChange={(e) => updateEditTarget(q, 'closures', e.target.value)}
                              className="mt-1"
                            />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>
                
                {/* Monthly */}
                <TabsContent value="monthly" className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    {getFiscalYearMonths(targetsFiscalYear).map(month => {
                      const monthName = new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                      return (
                        <Card key={month} className="p-3">
                          <p className="font-medium text-sm mb-2">{monthName}</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Leads</Label>
                              <Input
                                type="number"
                                value={editTargets.monthly?.[month]?.leads || 0}
                                onChange={(e) => updateEditTarget(month, 'leads', e.target.value)}
                                className="mt-1 h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Closures</Label>
                              <Input
                                type="number"
                                value={editTargets.monthly?.[month]?.closures || 0}
                                onChange={(e) => updateEditTarget(month, 'closures', e.target.value)}
                                className="mt-1 h-8 text-sm"
                              />
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </TabsContent>
              </Tabs>
              
              <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                <Button variant="outline" onClick={() => setShowTargetsDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={saveTargets} disabled={savingTargets} className="gap-2">
                  {savingTargets ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Targets
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          
          <Button variant="outline" size="sm" onClick={loadSavedForecasts}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Target Summary Card */}
      {targets?.exists && (
        <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Target className="h-5 w-5 text-amber-600" />
                <span className="font-medium text-amber-800">FY {targetsFiscalYear} Targets</span>
              </div>
              <div className="flex gap-6">
                <div className="text-center">
                  <p className="text-xs text-amber-600">Yearly Leads</p>
                  <p className="text-lg font-bold text-amber-800">{targets.targets?.yearly?.leads?.toLocaleString() || 0}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-amber-600">Yearly Closures</p>
                  <p className="text-lg font-bold text-amber-800">{targets.targets?.yearly?.closures?.toLocaleString() || 0}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Forecast Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Select Projection to Compare
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <Select 
                value={selectedProjectionId || ''} 
                onValueChange={(v) => setSelectedProjectionId(v)}
              >
                <SelectTrigger data-testid="compare-forecast-select">
                  <SelectValue placeholder="Select a saved forecast" />
                </SelectTrigger>
                <SelectContent>
                  {savedForecasts.length === 0 ? (
                    <SelectItem value="none" disabled>No saved forecasts found</SelectItem>
                  ) : (
                    savedForecasts.map((f, idx) => (
                      <SelectItem key={f.projection_id || f.index || idx} value={f.projection_id || f.index?.toString() || idx.toString()}>
                        {f.projection_id ? (
                          <>#{f.projection_id.slice(-6)} - {formatDate(f.saved_at)} ({f.parameters?.months_ahead || 3} months)</>
                        ) : (
                          <>#{f.index} - {formatDate(f.saved_at)}</>
                        )}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCompare} disabled={!selectedProjectionId || comparing}>
              {comparing ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Comparing...</> : <><BarChart3 className="h-4 w-4 mr-2" />Compare</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Comparison Results */}
      {comparisonData && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-200">
              <CardContent className="p-4">
                <p className="text-sm text-amber-600">Target (Total)</p>
                <p className="text-2xl font-bold text-amber-700">{comparisonData.totals?.target?.leads?.toLocaleString() || 0}</p>
                <p className="text-xs text-amber-500">{comparisonData.totals?.target?.closures || 0} closures</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-200">
              <CardContent className="p-4">
                <p className="text-sm text-indigo-600">Predicted (Total)</p>
                <p className="text-2xl font-bold text-indigo-700">{comparisonData.totals?.predicted?.leads?.toLocaleString() || 0}</p>
                <p className="text-xs text-indigo-500">{comparisonData.totals?.predicted?.closures || 0} closures</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-50 to-white border-green-200">
              <CardContent className="p-4">
                <p className="text-sm text-green-600">Actual (Total)</p>
                <p className="text-2xl font-bold text-green-700">{comparisonData.totals?.actual?.leads?.toLocaleString() || 0}</p>
                <p className="text-xs text-green-500">{comparisonData.totals?.actual?.closures || 0} closures</p>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          {comparisonChartData && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-indigo-500" />
                  Target vs Predicted vs Actual (Leads)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <Bar
                    data={comparisonChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { position: 'top' } },
                      scales: { y: { beginAtZero: true } }
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Monthly Breakdown Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Monthly Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Month</TableHead>
                      <TableHead className="text-center bg-amber-50">Target</TableHead>
                      <TableHead className="text-center bg-indigo-50">Predicted</TableHead>
                      <TableHead className="text-center bg-green-50">Actual</TableHead>
                      <TableHead className="text-center">vs Target</TableHead>
                      <TableHead className="text-center">Achievement %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparisonData.monthly_comparison?.map((month, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{month.month_name || month.month}</TableCell>
                        <TableCell className="text-center bg-amber-50/50">
                          <div>{month.target?.leads || 0}</div>
                          <div className="text-xs text-gray-500">{month.target?.closures || 0} won</div>
                        </TableCell>
                        <TableCell className="text-center bg-indigo-50/50">
                          <div>{month.predicted?.leads || 0}</div>
                          <div className="text-xs text-gray-500">{month.predicted?.closures || 0} won</div>
                        </TableCell>
                        <TableCell className="text-center bg-green-50/50">
                          <div>{month.actual?.leads || 0}</div>
                          <div className="text-xs text-gray-500">{month.actual?.closures || 0} won</div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {getVarianceIcon(month.variance_vs_target?.leads || 0)}
                            <span className={month.variance_vs_target?.leads >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {month.variance_vs_target?.leads > 0 ? '+' : ''}{month.variance_vs_target?.leads || 0}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={getAccuracyColor(month.achievement_pct?.leads || 0)}>
                            {month.achievement_pct?.leads?.toFixed(0) || 0}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default CompareTab;
