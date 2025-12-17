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
import { Pie, Bar, Line } from 'react-chartjs-2';

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
];

const chartTypes = [
  { value: 'pie', label: 'Pie Chart', icon: PieChart },
  { value: 'bar', label: 'Bar Chart', icon: BarChart2 },
  { value: 'line', label: 'Line Chart', icon: LineChartIcon },
];

const dataOptions = [
  { value: 'segment', label: 'By Segment' },
  { value: 'stage', label: 'By Stage' },
  { value: 'state', label: 'By State' },
  { value: 'dealer', label: 'By Dealer' },
  { value: 'source', label: 'By Source' },
  { value: 'monthly', label: 'Monthly Trend' },
];

const ChartCard = ({ chart, onRemove, data }) => {
  const chartData = {
    labels: data?.labels || [],
    datasets: [{
      data: data?.values || [],
      backgroundColor: chartColors,
      borderColor: chartColors,
      borderWidth: chart.type === 'pie' ? 0 : 2,
      fill: chart.type === 'line' ? false : true,
    }]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: chart.type === 'pie' ? 'right' : 'top',
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
    scales: chart.type !== 'pie' ? {
      y: { beginAtZero: true, grid: { display: false } },
      x: { grid: { display: false } }
    } : undefined
  };

  const ChartComponent = chart.type === 'pie' ? Pie : chart.type === 'bar' ? Bar : Line;

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
    { id: 'default-1', type: 'pie', dataKey: 'segment', title: 'Leads by Segment' }
  ]);
  const [chartData, setChartData] = useState({});
  const [newChart, setNewChart] = useState({ type: 'bar', dataKey: 'stage' });

  const loadChartData = useCallback(async () => {
    const queryParams = buildQueryParams();
    const newData = {};

    for (const chart of charts) {
      try {
        let endpoint = '';
        if (chart.dataKey === 'segment' || chart.dataKey === 'stage') {
          endpoint = `${API}/kpis?${queryParams}`;
        } else if (chart.dataKey === 'monthly') {
          endpoint = `${API}/insights/monthly-trends?months=12`;
        } else {
          endpoint = `${API}/insights/top-performers?by=${chart.dataKey}&${queryParams}`;
        }

        const res = await axios.get(endpoint, { withCredentials: true });
        
        if (chart.dataKey === 'segment') {
          newData[chart.id] = {
            labels: res.data.segment_distribution?.map(s => s.segment) || [],
            values: res.data.segment_distribution?.map(s => s.count) || []
          };
        } else if (chart.dataKey === 'stage') {
          newData[chart.id] = {
            labels: res.data.stage_distribution?.map(s => s.stage) || [],
            values: res.data.stage_distribution?.map(s => s.count) || []
          };
        } else if (chart.dataKey === 'monthly') {
          newData[chart.id] = {
            labels: res.data.trends?.map(t => t.month) || [],
            values: res.data.trends?.map(t => t.total_leads) || []
          };
        } else {
          newData[chart.id] = {
            labels: res.data.performers?.map(p => p.name) || [],
            values: res.data.performers?.map(p => p.total_leads) || []
          };
        }
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
    const dataLabel = dataOptions.find(d => d.value === newChart.dataKey)?.label || '';
    const newChartObj = {
      id: `chart-${Date.now()}`,
      type: newChart.type,
      dataKey: newChart.dataKey,
      title: `Leads ${dataLabel}`
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
          <p className="text-muted-foreground mt-1">Create custom visualizations</p>
        </div>
      </div>

      {/* Add Chart Panel */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="space-y-2">
              <label className="text-sm font-medium">Chart Type</label>
              <Select value={newChart.type} onValueChange={(v) => setNewChart(prev => ({ ...prev, type: v }))}>
                <SelectTrigger className="w-40">
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
              <label className="text-sm font-medium">Data</label>
              <Select value={newChart.dataKey} onValueChange={(v) => setNewChart(prev => ({ ...prev, dataKey: v }))}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dataOptions.map(d => (
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
