import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useFilters } from '@/context/FilterContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { PieChart, BarChart2, LineChart as LineChartIcon, Plus, X, GripVertical } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Pie, Bar, Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const chartColors = [
  'hsl(243, 75%, 59%)',
  'hsl(142, 71%, 45%)',
  'hsl(32, 95%, 44%)',
  'hsl(346, 84%, 61%)',
  'hsl(270, 50%, 40%)',
  'hsl(200, 70%, 50%)',
  'hsl(45, 90%, 50%)',
  'hsl(180, 60%, 45%)',
  'hsl(0, 70%, 50%)',
  'hsl(120, 60%, 40%)',
];

// Chart type options
const chartTypeOptions = [
  { value: 'pie', label: 'Pie Chart', icon: PieChart },
  { value: 'doughnut', label: 'Doughnut Chart', icon: PieChart },
  { value: 'bar', label: 'Bar Chart', icon: BarChart2 },
  { value: 'line', label: 'Line Chart', icon: LineChartIcon },
];

// Metric options (what to measure)
const metricOptions = [
  { value: 'total', label: 'Total Leads' },
  { value: 'won', label: 'Won Leads' },
  { value: 'lost', label: 'Lost Leads' },
  { value: 'open', label: 'Open Leads' },
  { value: 'qualified', label: 'Qualified Leads' },
  { value: 'faulty', label: 'Faulty Leads' },
  { value: 'hot', label: 'Hot Leads' },
  { value: 'warm', label: 'Warm Leads' },
  { value: 'cold', label: 'Cold Leads' },
  { value: 'conversion_rate', label: 'Conversion Rate (%)' },
];

// Group by options (how to group)
const groupByOptions = [
  { value: 'segment', label: 'By Segment' },
  { value: 'dealer', label: 'By Dealer' },
  { value: 'state', label: 'By State' },
  { value: 'employee', label: 'By Employee' },
  { value: 'stage', label: 'By Stage' },
  { value: 'type', label: 'By Type (Hot/Warm/Cold)' },
  { value: 'monthly', label: 'By Month (Trend)' },
];

const ChartCard = ({ chart, onRemove, data, loading }) => {
  const chartData = {
    labels: data?.labels || [],
    datasets: [{
      label: chart.title,
      data: data?.values || [],
      backgroundColor: chartColors,
      borderColor: chartColors.map(c => c.replace(')', ', 0.8)').replace('hsl', 'hsla')),
      borderWidth: (chart.type === 'pie' || chart.type === 'doughnut') ? 2 : 2,
      fill: chart.type === 'line' ? false : true,
      tension: 0.4,
    }]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: (chart.type === 'pie' || chart.type === 'doughnut') ? 'right' : 'top',
        labels: {
          usePointStyle: true,
          padding: 15,
          font: { size: 11 }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: { size: 14 },
        bodyFont: { size: 13 },
      }
    },
    scales: (chart.type !== 'pie' && chart.type !== 'doughnut') ? {
      y: { 
        beginAtZero: true, 
        grid: { display: true, color: 'rgba(0,0,0,0.05)' },
        ticks: { font: { size: 10 } }
      },
      x: { 
        grid: { display: false },
        ticks: { font: { size: 10 }, maxRotation: 45 }
      }
    } : undefined
  };

  const ChartComponent = 
    chart.type === 'pie' ? Pie : 
    chart.type === 'doughnut' ? Doughnut :
    chart.type === 'bar' ? Bar : Line;

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
          <CardTitle className="text-sm font-medium">{chart.title}</CardTitle>
        </div>
        <Button variant="ghost" size="icon" onClick={() => onRemove(chart.id)}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="h-72">
        {loading ? (
          <Skeleton className="h-full w-full" />
        ) : data && data.labels?.length > 0 ? (
          <ChartComponent data={chartData} options={options} />
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            No data available for this chart
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const Charts = () => {
  const { buildQueryParams } = useFilters();
  const [charts, setCharts] = useState([
    { id: 'default-1', type: 'pie', metric: 'total', groupBy: 'segment', title: 'Total Leads by Segment' },
    { id: 'default-2', type: 'bar', metric: 'won', groupBy: 'dealer', title: 'Won Leads by Dealer' },
  ]);
  const [chartData, setChartData] = useState({});
  const [loadingCharts, setLoadingCharts] = useState({});
  const [newChart, setNewChart] = useState({ 
    type: 'bar', 
    metric: 'won', 
    groupBy: 'segment' 
  });

  const fetchChartData = useCallback(async (chart) => {
    const queryParams = buildQueryParams();
    
    try {
      let labels = [];
      let values = [];

      // For monthly trends
      if (chart.groupBy === 'monthly') {
        const res = await axios.get(`${API}/insights/monthly-trends?months=12`, { withCredentials: true });
        labels = res.data.trends?.map(t => t.month) || [];
        
        switch (chart.metric) {
          case 'total':
            values = res.data.trends?.map(t => t.total_leads) || [];
            break;
          case 'won':
            values = res.data.trends?.map(t => t.won) || [];
            break;
          case 'lost':
            values = res.data.trends?.map(t => t.lost) || [];
            break;
          default:
            values = res.data.trends?.map(t => t.total_leads) || [];
        }
      }
      // For stage grouping (from KPIs)
      else if (chart.groupBy === 'stage') {
        const res = await axios.get(`${API}/kpis?${queryParams}`, { withCredentials: true });
        labels = res.data.stage_distribution?.map(s => s.stage) || [];
        values = res.data.stage_distribution?.map(s => s.count) || [];
      }
      // For type grouping (Hot/Warm/Cold from KPIs)
      else if (chart.groupBy === 'type') {
        const res = await axios.get(`${API}/kpis?${queryParams}`, { withCredentials: true });
        labels = res.data.type_distribution?.map(t => t.type) || [];
        values = res.data.type_distribution?.map(t => t.count) || [];
      }
      // For segment grouping (from KPIs for total, from insights for others)
      else if (chart.groupBy === 'segment' && chart.metric === 'total') {
        const res = await axios.get(`${API}/kpis?${queryParams}`, { withCredentials: true });
        labels = res.data.segment_distribution?.map(s => s.segment) || [];
        values = res.data.segment_distribution?.map(s => s.count) || [];
      }
      // For all other combinations - use insights/top-performers
      else {
        const byParam = chart.groupBy === 'segment' ? 'state' : chart.groupBy; // segment analysis not in top-performers
        const res = await axios.get(`${API}/insights/top-performers?by=${byParam}&metric=${chart.metric}&${queryParams}&limit=15`, { 
          withCredentials: true 
        });
        
        labels = res.data.performers?.map(p => p.name) || [];
        
        switch (chart.metric) {
          case 'total':
            values = res.data.performers?.map(p => p.total_leads) || [];
            break;
          case 'won':
            values = res.data.performers?.map(p => p.won_leads) || [];
            break;
          case 'lost':
            values = res.data.performers?.map(p => p.lost_leads) || [];
            break;
          case 'open':
            values = res.data.performers?.map(p => p.open_leads) || [];
            break;
          case 'conversion_rate':
            values = res.data.performers?.map(p => p.conversion_rate) || [];
            break;
          default:
            values = res.data.performers?.map(p => p.total_leads) || [];
        }

        // For segment grouping with non-total metrics, use segment analysis
        if (chart.groupBy === 'segment') {
          const segRes = await axios.get(`${API}/insights/segment-analysis?${queryParams}`, { withCredentials: true });
          labels = segRes.data.segments?.map(s => s.segment) || [];
          
          switch (chart.metric) {
            case 'total':
              values = segRes.data.segments?.map(s => s.total_leads) || [];
              break;
            case 'won':
              values = segRes.data.segments?.map(s => s.won_leads) || [];
              break;
            case 'lost':
              values = segRes.data.segments?.map(s => s.lost_leads) || [];
              break;
            case 'open':
              values = segRes.data.segments?.map(s => s.open_leads) || [];
              break;
            case 'hot':
              values = segRes.data.segments?.map(s => s.hot_leads) || [];
              break;
            case 'conversion_rate':
              values = segRes.data.segments?.map(s => s.conversion_rate) || [];
              break;
            default:
              values = segRes.data.segments?.map(s => s.total_leads) || [];
          }
        }
      }

      return { labels, values };
    } catch (error) {
      console.error(`Error loading chart data for ${chart.id}:`, error);
      return { labels: [], values: [] };
    }
  }, [buildQueryParams]);

  const loadAllChartData = useCallback(async () => {
    const newData = {};
    const newLoading = {};
    
    // Set all charts to loading
    charts.forEach(chart => {
      newLoading[chart.id] = true;
    });
    setLoadingCharts(newLoading);

    // Fetch data for each chart
    for (const chart of charts) {
      const data = await fetchChartData(chart);
      newData[chart.id] = data;
      setChartData(prev => ({ ...prev, [chart.id]: data }));
      setLoadingCharts(prev => ({ ...prev, [chart.id]: false }));
    }
  }, [charts, fetchChartData]);

  useEffect(() => {
    loadAllChartData();
  }, [loadAllChartData]);

  const addChart = () => {
    const metricLabel = metricOptions.find(m => m.value === newChart.metric)?.label || '';
    const groupByLabel = groupByOptions.find(g => g.value === newChart.groupBy)?.label || '';
    
    const newChartObj = {
      id: `chart-${Date.now()}`,
      type: newChart.type,
      metric: newChart.metric,
      groupBy: newChart.groupBy,
      title: `${metricLabel} ${groupByLabel}`
    };
    
    setCharts([...charts, newChartObj]);
  };

  const removeChart = (id) => {
    setCharts(charts.filter(c => c.id !== id));
    setChartData(prev => {
      const newData = { ...prev };
      delete newData[id];
      return newData;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Charts</h1>
          <p className="text-muted-foreground mt-1">Create custom visualizations with metrics and groupings</p>
        </div>
      </div>

      {/* Add Chart Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Create New Chart</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            {/* Metric Dropdown */}
            <div className="space-y-2">
              <Label>Metric (What to show)</Label>
              <Select value={newChart.metric} onValueChange={(v) => setNewChart(prev => ({ ...prev, metric: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select metric" />
                </SelectTrigger>
                <SelectContent>
                  {metricOptions.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Group By Dropdown */}
            <div className="space-y-2">
              <Label>Group By (How to group)</Label>
              <Select value={newChart.groupBy} onValueChange={(v) => setNewChart(prev => ({ ...prev, groupBy: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select grouping" />
                </SelectTrigger>
                <SelectContent>
                  {groupByOptions.map(g => (
                    <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Chart Type Dropdown */}
            <div className="space-y-2">
              <Label>Chart Type</Label>
              <Select value={newChart.type} onValueChange={(v) => setNewChart(prev => ({ ...prev, type: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select chart type" />
                </SelectTrigger>
                <SelectContent>
                  {chartTypeOptions.map(t => (
                    <SelectItem key={t.value} value={t.value}>
                      <div className="flex items-center gap-2">
                        <t.icon className="h-4 w-4" />
                        {t.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Add Button */}
            <Button onClick={addChart} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Chart
            </Button>
          </div>
          
          {/* Preview text */}
          <p className="text-sm text-muted-foreground mt-4">
            Preview: <strong>{metricOptions.find(m => m.value === newChart.metric)?.label}</strong> grouped <strong>{groupByOptions.find(g => g.value === newChart.groupBy)?.label}</strong> as a <strong>{chartTypeOptions.find(t => t.value === newChart.type)?.label}</strong>
          </p>
        </CardContent>
      </Card>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {charts.map(chart => (
          <ChartCard
            key={chart.id}
            chart={chart}
            onRemove={removeChart}
            data={chartData[chart.id]}
            loading={loadingCharts[chart.id]}
          />
        ))}
      </div>

      {charts.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No charts added. Use the panel above to create your first chart.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Charts;
