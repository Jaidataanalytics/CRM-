import { useState, useEffect } from 'react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  TrendingUp, TrendingDown, Minus, Target, BarChart3, 
  Calendar, RefreshCw, CheckCircle2, AlertCircle, GitCompare
} from 'lucide-react';
import { Bar, Line } from 'react-chartjs-2';

const API = '/api';

export const CompareTab = () => {
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [savedForecasts, setSavedForecasts] = useState([]);
  const [selectedProjectionId, setSelectedProjectionId] = useState(null);
  const [comparisonData, setComparisonData] = useState(null);

  useEffect(() => {
    loadSavedForecasts();
  }, []);

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

  const handleCompare = async () => {
    if (!selectedProjectionId) {
      toast.error('Please select a forecast to compare');
      return;
    }
    
    setComparing(true);
    try {
      const forecast = savedForecasts.find(f => f.projection_id === selectedProjectionId || f.index?.toString() === selectedProjectionId);
      
      if (forecast?.projection_id) {
        // Use enhanced compare with targets
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
      day: 'numeric', month: 'short', year: 'numeric'
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <GitCompare className="h-6 w-6 text-indigo-600" />
            Compare: Target vs Predicted vs Actual
          </h2>
          <p className="text-sm text-muted-foreground">
            Compare forecasts against targets and actual results. Set targets in the Comparison page.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadSavedForecasts}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

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

      {/* No Forecasts Message */}
      {savedForecasts.length === 0 && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-amber-500" />
            <h3 className="font-medium text-amber-800">No Saved Forecasts</h3>
            <p className="text-sm text-amber-600 mt-2">
              Generate a forecast first, then save it to compare against actual results later.
            </p>
          </CardContent>
        </Card>
      )}

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
