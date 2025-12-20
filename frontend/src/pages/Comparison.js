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
import { toast } from 'sonner';
import { 
  TrendingUp, TrendingDown, Minus, Plus, MapPin, Building, Users, 
  Target, BarChart3, Trash2, Save, RefreshCw, Map, Globe
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
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// India GeoJSON URL (TopoJSON format)
const INDIA_TOPO_JSON = "https://raw.githubusercontent.com/geohacker/india/master/state/india_state.geojson";

// State name mapping for matching data
const STATE_NAME_MAP = {
  'andhra pradesh': 'Andhra Pradesh',
  'arunachal pradesh': 'Arunachal Pradesh',
  'assam': 'Assam',
  'bihar': 'Bihar',
  'chhattisgarh': 'Chhattisgarh',
  'goa': 'Goa',
  'gujarat': 'Gujarat',
  'haryana': 'Haryana',
  'himachal pradesh': 'Himachal Pradesh',
  'jharkhand': 'Jharkhand',
  'karnataka': 'Karnataka',
  'kerala': 'Kerala',
  'madhya pradesh': 'Madhya Pradesh',
  'maharashtra': 'Maharashtra',
  'manipur': 'Manipur',
  'meghalaya': 'Meghalaya',
  'mizoram': 'Mizoram',
  'nagaland': 'Nagaland',
  'odisha': 'Odisha',
  'punjab': 'Punjab',
  'rajasthan': 'Rajasthan',
  'sikkim': 'Sikkim',
  'tamil nadu': 'Tamil Nadu',
  'telangana': 'Telangana',
  'tripura': 'Tripura',
  'uttar pradesh': 'Uttar Pradesh',
  'uttarakhand': 'Uttarakhand',
  'west bengal': 'West Bengal',
  'delhi': 'Delhi',
  'jammu and kashmir': 'Jammu and Kashmir',
  'ladakh': 'Ladakh',
  'andaman and nicobar': 'Andaman and Nicobar',
  'chandigarh': 'Chandigarh',
  'dadra and nagar haveli': 'Dadra and Nagar Haveli',
  'daman and diu': 'Daman and Diu',
  'lakshadweep': 'Lakshadweep',
  'puducherry': 'Puducherry'
};

// Color scale for map based on lead count
const getStateColor = (count, maxCount) => {
  if (!count || count === 0) return '#f1f5f9'; // slate-100
  const ratio = count / maxCount;
  if (ratio > 0.7) return '#059669'; // emerald-600
  if (ratio > 0.5) return '#10b981'; // emerald-500
  if (ratio > 0.3) return '#34d399'; // emerald-400
  if (ratio > 0.15) return '#6ee7b7'; // emerald-300
  if (ratio > 0.05) return '#a7f3d0'; // emerald-200
  return '#d1fae5'; // emerald-100
};

const Comparison = () => {
  const { buildQueryParams } = useFilters();
  const [loading, setLoading] = useState(true);
  const [performanceData, setPerformanceData] = useState({
    states: [],
    dealers: [],
    areas: [],
    employees: []
  });
  const [availableFilters, setAvailableFilters] = useState({
    states: [],
    dealers: [],
    areas: [],
    employees: []
  });
  
  // Session-based market data
  const [marketData, setMarketData] = useState({
    states: {},
    dealers: {},
    areas: {},
    employees: {}
  });
  
  // New entry form
  const [newEntry, setNewEntry] = useState({
    entity: '',
    market_size: '',
    industry_avg: '',
    target: ''
  });
  const [selectedCategory, setSelectedCategory] = useState('states');
  
  // Map state
  const [hoveredState, setHoveredState] = useState(null);
  const [selectedState, setSelectedState] = useState(null);
  const [mapMetric, setMapMetric] = useState('total'); // total, won, conversion

  useEffect(() => {
    loadData();
  }, [buildQueryParams]);

  const loadData = async () => {
    setLoading(true);
    try {
      const queryParams = buildQueryParams();
      
      // Load data in parallel but handle individual failures
      const [statesRes, dealersRes, areasRes, employeesRes, filtersRes] = await Promise.allSettled([
        axios.get(`${API}/insights/top-performers?by=state&metric=total&limit=50&${queryParams}`, { withCredentials: true }),
        axios.get(`${API}/insights/top-performers?by=dealer&metric=total&limit=50&${queryParams}`, { withCredentials: true }),
        axios.get(`${API}/insights/top-performers?by=area&metric=total&limit=50&${queryParams}`, { withCredentials: true }),
        axios.get(`${API}/insights/top-performers?by=employee&metric=total&limit=50&${queryParams}`, { withCredentials: true }),
        axios.get(`${API}/filters/all`, { withCredentials: true })
      ]);
      
      setPerformanceData({
        states: statesRes.status === 'fulfilled' ? statesRes.value.data.performers || [] : [],
        dealers: dealersRes.status === 'fulfilled' ? dealersRes.value.data.performers || [] : [],
        areas: areasRes.status === 'fulfilled' ? areasRes.value.data.performers || [] : [],
        employees: employeesRes.status === 'fulfilled' ? employeesRes.value.data.performers || [] : []
      });
      
      if (filtersRes.status === 'fulfilled') {
        setAvailableFilters({
          states: filtersRes.value.data.states || [],
          dealers: filtersRes.value.data.dealers || [],
          areas: filtersRes.value.data.areas || [],
          employees: filtersRes.value.data.employees || []
        });
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load comparison data');
    } finally {
      setLoading(false);
    }
  };

  const addMarketEntry = () => {
    if (!newEntry.entity) {
      toast.error('Please select an entity');
      return;
    }
    
    setMarketData(prev => ({
      ...prev,
      [selectedCategory]: {
        ...prev[selectedCategory],
        [newEntry.entity]: {
          market_size: parseFloat(newEntry.market_size) || 0,
          industry_avg: parseFloat(newEntry.industry_avg) || 0,
          target: parseFloat(newEntry.target) || 0
        }
      }
    }));
    
    setNewEntry({ entity: '', market_size: '', industry_avg: '', target: '' });
    toast.success('Market data added');
  };

  const removeMarketEntry = (category, entity) => {
    setMarketData(prev => {
      const updated = { ...prev[category] };
      delete updated[entity];
      return { ...prev, [category]: updated };
    });
  };

  const clearAllMarketData = () => {
    if (window.confirm('Clear all market data?')) {
      setMarketData({ states: {}, dealers: {}, areas: {}, employees: {} });
      toast.success('Market data cleared');
    }
  };

  const getComparison = (category, entityName) => {
    const internal = performanceData[category]?.find(d => d.name === entityName);
    const market = marketData[category]?.[entityName];
    
    if (!internal) return null;
    
    const ourLeads = internal.total_leads || 0;
    const ourWon = internal.won_leads || 0;
    const ourConversion = internal.conversion_rate || 0;
    
    if (!market?.market_size) {
      return {
        ourLeads,
        ourWon,
        ourConversion,
        hasMarketData: false
      };
    }
    
    const marketSize = market.market_size;
    const ourShare = marketSize > 0 ? ((ourLeads / marketSize) * 100) : 0;
    const industryAvg = market.industry_avg || 0;
    const target = market.target || 0;
    const shareVsAvg = ourShare - industryAvg;
    const vsTarget = target > 0 ? ((ourLeads / target) * 100) : 0;
    
    return {
      ourLeads,
      ourWon,
      ourConversion,
      hasMarketData: true,
      marketSize,
      ourShare: ourShare.toFixed(1),
      industryAvg,
      shareVsAvg: shareVsAvg.toFixed(1),
      target,
      vsTarget: vsTarget.toFixed(1),
      status: shareVsAvg > 0 ? 'above' : shareVsAvg < 0 ? 'below' : 'equal'
    };
  };

  const getChartData = (category) => {
    return performanceData[category]?.slice(0, 10).map(item => {
      const market = marketData[category]?.[item.name];
      return {
        name: item.name?.substring(0, 15) || 'Unknown',
        'Our Leads': item.total_leads || 0,
        'Won': item.won_leads || 0,
        'Market Size': market?.market_size || 0,
        'Target': market?.target || 0
      };
    }) || [];
  };

  const getCategoryLabel = (cat) => {
    const labels = { states: 'State', dealers: 'Dealer', areas: 'Area', employees: 'Employee' };
    return labels[cat] || cat;
  };

  const getAvailableEntities = () => {
    return availableFilters[selectedCategory] || [];
  };

  // Map helpers
  const getStateDataMap = useMemo(() => {
    const map = {};
    performanceData.states?.forEach(state => {
      const normalizedName = state.name?.toLowerCase().trim();
      map[normalizedName] = state;
    });
    return map;
  }, [performanceData.states]);

  const maxStateValue = useMemo(() => {
    if (!performanceData.states?.length) return 1;
    if (mapMetric === 'won') {
      return Math.max(...performanceData.states.map(s => s.won_leads || 0), 1);
    }
    if (mapMetric === 'conversion') {
      return Math.max(...performanceData.states.map(s => s.conversion_rate || 0), 1);
    }
    return Math.max(...performanceData.states.map(s => s.total_leads || 0), 1);
  }, [performanceData.states, mapMetric]);

  const getStateValue = (stateName) => {
    const normalizedName = stateName?.toLowerCase().trim();
    const data = getStateDataMap[normalizedName];
    if (!data) return 0;
    if (mapMetric === 'won') return data.won_leads || 0;
    if (mapMetric === 'conversion') return data.conversion_rate || 0;
    return data.total_leads || 0;
  };

  const getStateData = (stateName) => {
    const normalizedName = stateName?.toLowerCase().trim();
    return getStateDataMap[normalizedName];
  };

  // Pie chart data for map sidebar
  const mapPieData = useMemo(() => {
    const topStates = performanceData.states?.slice(0, 5) || [];
    const others = performanceData.states?.slice(5) || [];
    const othersTotal = others.reduce((sum, s) => sum + (s.total_leads || 0), 0);
    
    const data = topStates.map(s => ({
      name: s.name,
      value: s.total_leads || 0
    }));
    
    if (othersTotal > 0) {
      data.push({ name: 'Others', value: othersTotal });
    }
    
    return data;
  }, [performanceData.states]);

  const PIE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#8b5cf6', '#94a3b8'];

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-8 w-8" />
            Market Comparison
          </h1>
          <p className="text-muted-foreground mt-1">Compare your performance against market benchmarks</p>
        </div>
        <Button variant="outline" size="sm" onClick={clearAllMarketData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Clear Market Data
        </Button>
      </div>

      {/* Market Data Input Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5" />
            Add Market Benchmark Data
          </CardTitle>
          <CardDescription>
            Enter market data to compare your performance (session-based, not saved)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="states">State</SelectItem>
                  <SelectItem value="dealers">Dealer</SelectItem>
                  <SelectItem value="areas">Area</SelectItem>
                  <SelectItem value="employees">Employee</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 flex-1 min-w-[200px]">
              <Label>{getCategoryLabel(selectedCategory)}</Label>
              <Select value={newEntry.entity} onValueChange={(v) => setNewEntry(prev => ({ ...prev, entity: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder={`Select ${getCategoryLabel(selectedCategory)}`} />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableEntities().map(entity => (
                    <SelectItem key={entity} value={entity}>{entity}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Market Size (Total Leads)</Label>
              <Input
                type="number"
                placeholder="e.g., 5000"
                value={newEntry.market_size}
                onChange={(e) => setNewEntry(prev => ({ ...prev, market_size: e.target.value }))}
                className="w-36"
              />
            </div>
            <div className="space-y-2">
              <Label>Industry Avg Share (%)</Label>
              <Input
                type="number"
                placeholder="e.g., 15"
                value={newEntry.industry_avg}
                onChange={(e) => setNewEntry(prev => ({ ...prev, industry_avg: e.target.value }))}
                className="w-36"
              />
            </div>
            <div className="space-y-2">
              <Label>Your Target</Label>
              <Input
                type="number"
                placeholder="e.g., 1000"
                value={newEntry.target}
                onChange={(e) => setNewEntry(prev => ({ ...prev, target: e.target.value }))}
                className="w-32"
              />
            </div>
            <Button onClick={addMarketEntry} className="gap-2">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
          
          {/* Show entered market data summary */}
          {Object.values(marketData).some(cat => Object.keys(cat).length > 0) && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm font-medium mb-2">Entered Market Data:</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(marketData).map(([category, entries]) =>
                  Object.entries(entries).map(([entity, data]) => (
                    <Badge key={`${category}-${entity}`} variant="secondary" className="gap-1 pr-1">
                      {getCategoryLabel(category)}: {entity} (Market: {data.market_size})
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 ml-1"
                        onClick={() => removeMarketEntry(category, entity)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="map" className="space-y-4">
        <TabsList>
          <TabsTrigger value="map">
            <Globe className="h-4 w-4 mr-2" />
            Geographic Map
          </TabsTrigger>
          <TabsTrigger value="states">
            <MapPin className="h-4 w-4 mr-2" />
            State Comparison
          </TabsTrigger>
          <TabsTrigger value="dealers">
            <Building className="h-4 w-4 mr-2" />
            Dealer Comparison
          </TabsTrigger>
          <TabsTrigger value="areas">
            <MapPin className="h-4 w-4 mr-2" />
            Area Comparison
          </TabsTrigger>
          <TabsTrigger value="employees">
            <Users className="h-4 w-4 mr-2" />
            Employee Comparison
          </TabsTrigger>
        </TabsList>

        {/* Geographic Map Tab */}
        <TabsContent value="map" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* India Map */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-primary" />
                    India State Performance Map
                  </CardTitle>
                  <Select value={mapMetric} onValueChange={setMapMetric}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="total">Total Leads</SelectItem>
                      <SelectItem value="won">Won Leads</SelectItem>
                      <SelectItem value="conversion">Conversion %</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <CardDescription>
                  Hover over states to see performance details. Color intensity shows {mapMetric === 'conversion' ? 'conversion rate' : mapMetric === 'won' ? 'won leads' : 'total leads'}.
                </CardDescription>
              </CardHeader>
              <CardContent className="relative">
                <div className="h-[500px] w-full">
                  <ComposableMap
                    projection="geoMercator"
                    projectionConfig={{
                      scale: 1000,
                      center: [82, 22]
                    }}
                    style={{ width: '100%', height: '100%' }}
                  >
                    <ZoomableGroup zoom={1} minZoom={0.8} maxZoom={4}>
                      <Geographies geography={INDIA_TOPO_JSON}>
                        {({ geographies }) =>
                          geographies.map((geo) => {
                            const stateName = geo.properties.NAME_1 || geo.properties.name || geo.properties.ST_NM;
                            const value = getStateValue(stateName);
                            const stateData = getStateData(stateName);
                            const isHovered = hoveredState === stateName;
                            const isSelected = selectedState === stateName;

                            return (
                              <Geography
                                key={geo.rsmKey}
                                geography={geo}
                                onMouseEnter={() => setHoveredState(stateName)}
                                onMouseLeave={() => setHoveredState(null)}
                                onClick={() => setSelectedState(isSelected ? null : stateName)}
                                style={{
                                  default: {
                                    fill: getStateColor(value, maxStateValue),
                                    stroke: isSelected ? '#6366f1' : '#94a3b8',
                                    strokeWidth: isSelected ? 2 : 0.5,
                                    outline: 'none',
                                    cursor: 'pointer'
                                  },
                                  hover: {
                                    fill: '#818cf8',
                                    stroke: '#6366f1',
                                    strokeWidth: 1.5,
                                    outline: 'none',
                                    cursor: 'pointer'
                                  },
                                  pressed: {
                                    fill: '#6366f1',
                                    outline: 'none'
                                  }
                                }}
                              />
                            );
                          })
                        }
                      </Geographies>
                    </ZoomableGroup>
                  </ComposableMap>
                </div>

                {/* Tooltip */}
                {hoveredState && (
                  <div className="absolute top-4 right-4 bg-background/95 backdrop-blur border rounded-lg shadow-lg p-3 min-w-[200px]">
                    <p className="font-semibold text-sm">{hoveredState}</p>
                    {getStateData(hoveredState) ? (
                      <div className="mt-2 space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total Leads:</span>
                          <span className="font-medium">{getStateData(hoveredState).total_leads?.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Won:</span>
                          <span className="font-medium text-green-600">{getStateData(hoveredState).won_leads?.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Conversion:</span>
                          <span className="font-medium">{getStateData(hoveredState).conversion_rate?.toFixed(1)}%</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1">No data available</p>
                    )}
                  </div>
                )}

                {/* Color Legend */}
                <div className="absolute bottom-4 left-4 bg-background/95 backdrop-blur border rounded-lg p-2">
                  <p className="text-xs font-medium mb-2">{mapMetric === 'conversion' ? 'Conversion Rate' : mapMetric === 'won' ? 'Won Leads' : 'Total Leads'}</p>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-3 bg-[#f1f5f9] border" title="No data"></div>
                    <div className="w-4 h-3 bg-[#d1fae5]" title="Low"></div>
                    <div className="w-4 h-3 bg-[#a7f3d0]"></div>
                    <div className="w-4 h-3 bg-[#6ee7b7]"></div>
                    <div className="w-4 h-3 bg-[#34d399]"></div>
                    <div className="w-4 h-3 bg-[#10b981]"></div>
                    <div className="w-4 h-3 bg-[#059669]" title="High"></div>
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>Low</span>
                    <span>High</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sidebar Stats */}
            <div className="space-y-4">
              {/* Distribution Pie */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Lead Distribution by State</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={mapPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {mapPieData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => value.toLocaleString()} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 space-y-1">
                    {mapPieData.slice(0, 5).map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[idx] }}></div>
                          <span className="truncate max-w-[100px]">{item.name}</span>
                        </div>
                        <span className="font-medium">{item.value.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Top States List */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Top Performing States</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {performanceData.states?.slice(0, 8).map((state, idx) => (
                      <div 
                        key={idx} 
                        className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                          selectedState === state.name ? 'bg-primary/10 border border-primary/30' : 'bg-muted/50 hover:bg-muted'
                        }`}
                        onClick={() => setSelectedState(selectedState === state.name ? null : state.name)}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            idx === 0 ? 'bg-yellow-500 text-white' : 
                            idx === 1 ? 'bg-gray-400 text-white' : 
                            idx === 2 ? 'bg-amber-600 text-white' : 'bg-muted text-muted-foreground'
                          }`}>
                            {idx + 1}
                          </span>
                          <span className="text-xs font-medium truncate max-w-[80px]">{state.name}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold">{state.total_leads?.toLocaleString()}</p>
                          <p className="text-[10px] text-green-600">{state.won_leads} won</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {['states', 'dealers', 'areas', 'employees'].map(category => (
          <TabsContent key={category} value={category} className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>{getCategoryLabel(category)} Performance Chart</CardTitle>
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={getChartData(category)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={100} fontSize={12} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Our Leads" fill="#6366f1" />
                      <Bar dataKey="Won" fill="#22c55e" />
                      {Object.keys(marketData[category] || {}).length > 0 && (
                        <>
                          <Bar dataKey="Market Size" fill="#f59e0b" />
                          <Bar dataKey="Target" fill="#ec4899" />
                        </>
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Summary Stats */}
              <Card>
                <CardHeader>
                  <CardTitle>Performance Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {performanceData[category]?.slice(0, 8).map((item, idx) => {
                      const comparison = getComparison(category, item.name);
                      return (
                        <div key={idx} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              idx === 0 ? 'bg-yellow-500 text-white' : 
                              idx === 1 ? 'bg-gray-400 text-white' : 
                              idx === 2 ? 'bg-amber-600 text-white' : 'bg-muted text-muted-foreground'
                            }`}>
                              {idx + 1}
                            </span>
                            <div>
                              <p className="font-medium text-sm">{item.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.total_leads} leads • {item.won_leads} won • {item.conversion_rate}% conv
                              </p>
                            </div>
                          </div>
                          {comparison?.hasMarketData && (
                            <Badge className={`text-xs ${
                              comparison.status === 'above' ? 'bg-green-100 text-green-800' :
                              comparison.status === 'below' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {comparison.status === 'above' && <TrendingUp className="h-3 w-3 mr-1" />}
                              {comparison.status === 'below' && <TrendingDown className="h-3 w-3 mr-1" />}
                              {comparison.shareVsAvg > 0 ? '+' : ''}{comparison.shareVsAvg}% vs avg
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Comparison Table */}
            <Card>
              <CardHeader>
                <CardTitle>Detailed {getCategoryLabel(category)} Comparison</CardTitle>
                <CardDescription>
                  {Object.keys(marketData[category] || {}).length > 0 
                    ? 'Showing comparison with your market data'
                    : 'Add market data above to see comparisons'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{getCategoryLabel(category)}</TableHead>
                      <TableHead className="text-right">Our Leads</TableHead>
                      <TableHead className="text-right">Won</TableHead>
                      <TableHead className="text-right">Conv %</TableHead>
                      <TableHead className="text-right">Market Size</TableHead>
                      <TableHead className="text-right">Our Share</TableHead>
                      <TableHead className="text-right">Industry Avg</TableHead>
                      <TableHead className="text-right">vs Avg</TableHead>
                      <TableHead className="text-right">Target</TableHead>
                      <TableHead className="text-right">vs Target</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {performanceData[category]?.map((item, idx) => {
                      const comparison = getComparison(category, item.name);
                      if (!comparison) return null;
                      
                      return (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="text-right">{comparison.ourLeads.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-green-600">{comparison.ourWon.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{comparison.ourConversion}%</TableCell>
                          <TableCell className="text-right">
                            {comparison.hasMarketData ? comparison.marketSize.toLocaleString() : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {comparison.hasMarketData ? `${comparison.ourShare}%` : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {comparison.hasMarketData ? `${comparison.industryAvg}%` : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {comparison.hasMarketData ? (
                              <Badge className={`${
                                comparison.status === 'above' ? 'bg-green-100 text-green-800' :
                                comparison.status === 'below' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {comparison.shareVsAvg > 0 ? '+' : ''}{comparison.shareVsAvg}%
                              </Badge>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {comparison.hasMarketData && comparison.target > 0 
                              ? comparison.target.toLocaleString() 
                              : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {comparison.hasMarketData && comparison.target > 0 ? (
                              <div className="flex items-center gap-2 justify-end">
                                <Progress 
                                  value={Math.min(parseFloat(comparison.vsTarget), 100)} 
                                  className="w-16 h-2"
                                />
                                <span className="text-xs">{comparison.vsTarget}%</span>
                              </div>
                            ) : '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Instructions */}
      <Card>
        <CardContent className="pt-6">
          <h4 className="font-medium mb-2">How to use:</h4>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Select a category (State/Dealer/Area/Employee) and choose an entity</li>
            <li>Enter the total market size (how many leads exist in that market)</li>
            <li>Enter the industry average share percentage</li>
            <li>Optionally set your target number of leads</li>
            <li>Click "Add" to see the comparison in the tables and charts</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
};

export default Comparison;
