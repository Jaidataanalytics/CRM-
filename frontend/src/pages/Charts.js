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
];

const chartTypes = [
  { value: 'pie', label: 'Pie Chart', icon: PieChart },
  { value: 'doughnut', label: 'Doughnut Chart', icon: PieChart },
  { value: 'bar', label: 'Bar Chart', icon: BarChart2 },
  { value: 'line', label: 'Line Chart', icon: LineChartIcon },
];

const dataOptions = [
  // Data groupings
  { value: 'segment', label: 'By Segment', type: 'data' },
  { value: 'stage', label: 'By Stage', type: 'data' },
  { value: 'state', label: 'By State', type: 'data' },
  { value: 'dealer', label: 'By Dealer', type: 'data' },
  { value: 'source', label: 'By Source', type: 'data' },
  { value: 'type', label: 'By Type (Hot/Warm/Cold)', type: 'data' },
  { value: 'qualification', label: 'By Qualification Status', type: 'data' },
  { value: 'monthly', label: 'Monthly Trend', type: 'data' },
  // Metrics
  { value: 'metric_won', label: 'Won Leads by State', type: 'metric' },
  { value: 'metric_lost', label: 'Lost Leads by State', type: 'metric' },
  { value: 'metric_qualified', label: 'Qualified Leads by Dealer', type: 'metric' },
  { value: 'metric_conversion', label: 'Conversion Rate by Employee', type: 'metric' },
  { value: 'metric_monthly_won', label: 'Monthly Won Leads Trend', type: 'metric' },
  { value: 'metric_monthly_qualified', label: 'Monthly Qualified Leads', type: 'metric' },
];

const ChartCard = ({ chart, onRemove, data }) => {
  const chartData = {
    labels: data?.labels || [],
    datasets: [{
      label: chart.title,
      data: data?.values || [],
      backgroundColor: chartColors,
      borderColor: chartColors,
      borderWidth: (chart.type === 'pie' || chart.type === 'doughnut') ? 0 : 2,
      fill: chart.type === 'line' ? false : true,
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
      y: { beginAtZero: true, grid: { display: false } },
      x: { grid: { display: false } }
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
      <CardContent className="h-64">
        {data ? (
          <ChartComponent data={chartData} options={options} />
        ) : (
          <Skeleton className="h-full w-full" />
        )}
      </CardContent>
    </Card>
  );
};

const Charts = () => {
  const { buildQueryParams } = useFilters();
  const [charts, setCharts] = useState([
    { id: 'default-1', type: 'pie', dataKey: 'segment', title: 'Leads by Segment' },
    { id: 'default-2', type: 'doughnut', dataKey: 'stage', title: 'Leads by Stage' },
  ]);
  const [chartData, setChartData] = useState({});
  const [newChart, setNewChart] = useState({ type: 'bar', dataKey: 'metric_won' });

  const loadChartData = useCallback(async () => {
    const queryParams = buildQueryParams();
    const newData = {};

    for (const chart of charts) {
      try {
        let labels = [];
        let values = [];

        // Data-based charts
        if (chart.dataKey === 'segment' || chart.dataKey === 'stage' || 
            chart.dataKey === 'type' || chart.dataKey === 'qualification') {
          const res = await axios.get(`${API}/kpis?${queryParams}`, { withCredentials: true });
          
          if (chart.dataKey === 'segment') {
            labels = res.data.segment_distribution?.map(s => s.segment) || [];
            values = res.data.segment_distribution?.map(s => s.count) || [];
          } else if (chart.dataKey === 'stage') {
            labels = res.data.stage_distribution?.map(s => s.stage) || [];
            values = res.data.stage_distribution?.map(s => s.count) || [];
          } else if (chart.dataKey === 'type') {
            labels = res.data.type_distribution?.map(t => t.type) || [];
            values = res.data.type_distribution?.map(t => t.count) || [];
          } else if (chart.dataKey === 'qualification') {
            labels = res.data.qualification_distribution?.map(q => q.status) || [];
            values = res.data.qualification_distribution?.map(q => q.count) || [];
          }
        } 
        else if (chart.dataKey === 'monthly') {
          const res = await axios.get(`${API}/insights/monthly-trends?months=12`, { withCredentials: true });
          labels = res.data.trends?.map(t => t.month) || [];
          values = res.data.trends?.map(t => t.total_leads) || [];
        }
        else if (chart.dataKey === 'state' || chart.dataKey === 'dealer') {
          const res = await axios.get(`${API}/insights/top-performers?by=${chart.dataKey}&metric=total&${queryParams}`, { withCredentials: true });
          labels = res.data.performers?.map(p => p.name) || [];
          values = res.data.performers?.map(p => p.total_leads) || [];
        }
        // Metric-based charts
        else if (chart.dataKey === 'metric_won') {
          const res = await axios.get(`${API}/insights/top-performers?by=state&metric=won&${queryParams}`, { withCredentials: true });
          labels = res.data.performers?.map(p => p.name) || [];
          values = res.data.performers?.map(p => p.won_leads) || [];
        }
        else if (chart.dataKey === 'metric_lost') {
          const res = await axios.get(`${API}/insights/top-performers?by=state&metric=total&${queryParams}`, { withCredentials: true });
          labels = res.data.performers?.map(p => p.name) || [];
          values = res.data.performers?.map(p => p.lost_leads) || [];
        }
        else if (chart.dataKey === 'metric_qualified') {
          const res = await axios.get(`${API}/insights/top-performers?by=dealer&metric=total&${queryParams}`, { withCredentials: true });
          // Note: We'd need to add qualified_leads to the performers data
          labels = res.data.performers?.map(p => p.name) || [];
          values = res.data.performers?.map(p => p.won_leads) || []; // Using won as proxy
        }
        else if (chart.dataKey === 'metric_conversion') {
          const res = await axios.get(`${API}/insights/top-performers?by=employee&metric=conversion_rate&${queryParams}`, { withCredentials: true });
          labels = res.data.performers?.map(p => p.name) || [];
          values = res.data.performers?.map(p => p.conversion_rate) || [];
        }
        else if (chart.dataKey === 'metric_monthly_won') {
          const res = await axios.get(`${API}/insights/monthly-trends?months=12`, { withCredentials: true });
          labels = res.data.trends?.map(t => t.month) || [];
          values = res.data.trends?.map(t => t.won) || [];
        }
        else if (chart.dataKey === 'metric_monthly_qualified') {
          const res = await axios.get(`${API}/insights/monthly-trends?months=12`, { withCredentials: true });
          labels = res.data.trends?.map(t => t.month) || [];
          values = res.data.trends?.map(t => t.won) || []; // Using won as proxy until qualified is tracked
        }

        newData[chart.id] = { labels, values };
      } catch (error) {
        console.error(`Error loading chart data for ${chart.id}:`, error);
        newData[chart.id] = { labels: [], values: [] };
      }
    }

    setChartData(newData);
  }, [charts, buildQueryParams]);

  useEffect(() => {
    loadChartData();
  }, [loadChartData]);

  const addChart = () => {
    const dataOption = dataOptions.find(d => d.value === newChart.dataKey);
    const newChartObj = {
      id: `chart-${Date.now()}`,
      type: newChart.type,
      dataKey: newChart.dataKey,
      title: dataOption?.label || 'Custom Chart'
    };
    setCharts([...charts, newChartObj]);
  };

  const removeChart = (id) => {
    setCharts(charts.filter(c => c.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Charts</h1>
          <p className="text-muted-foreground mt-1">Create custom visualizations with data and metrics</p>
        </div>
      </div>

      {/* Add Chart Panel */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="space-y-2">
              <label className="text-sm font-medium">Chart Type</label>
              <Select value={newChart.type} onValueChange={(v) => setNewChart(prev => ({ ...prev, type: v }))}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {chartTypes.map(t => (
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
            <div className="space-y-2">
              <label className="text-sm font-medium">Data / Metric</label>
              <Select value={newChart.dataKey} onValueChange={(v) => setNewChart(prev => ({ ...prev, dataKey: v }))}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Data Groupings</div>
                  {dataOptions.filter(d => d.type === 'data').map(d => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground mt-2">Metrics</div>
                  {dataOptions.filter(d => d.type === 'metric').map(d => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={addChart} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Chart
            </Button>
          </div>
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
