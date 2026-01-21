import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useFilters } from '@/context/FilterContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, RotateCcw, Filter, X } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { SearchableSelect } from '@/components/ui/searchable-select';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const FilterBar = () => {
  const { filters, updateFilter, resetFilters, getActiveFilters } = useFilters();
  const [options, setOptions] = useState({
    states: [],
    areas: [],
    dealers: [],
    employees: [],
    segments: []
  });
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadInitialOptions = useCallback(async () => {
    setLoading(true);
    try {
      const [statesRes, segmentsRes, dealersRes] = await Promise.all([
        axios.get(`${API}/filters/states`, { withCredentials: true }),
        axios.get(`${API}/filters/segments`, { withCredentials: true }),
        axios.get(`${API}/filters/dealers`, { withCredentials: true })
      ]);
      setOptions(prev => ({
        ...prev,
        states: statesRes.data.states || [],
        segments: segmentsRes.data.segments || [],
        dealers: dealersRes.data.dealers || []
      }));
    } catch (error) {
      console.error('Error loading filter options:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialOptions();
  }, [loadInitialOptions]);

  useEffect(() => {
    if (filters.state) {
      loadAreas();
      loadDealers();
    }
  }, [filters.state]);

  useEffect(() => {
    if (filters.dealer) {
      loadEmployees();
    }
  }, [filters.dealer]);

  const loadAreas = async () => {
    try {
      const res = await axios.get(`${API}/filters/areas`, {
        params: { state: filters.state },
        withCredentials: true
      });
      setOptions(prev => ({ ...prev, areas: res.data.areas || [] }));
    } catch (error) {
      console.error('Error loading areas:', error);
    }
  };

  const loadDealers = async () => {
    try {
      const params = {};
      if (filters.state) params.state = filters.state;
      if (filters.area) params.area = filters.area;
      
      const res = await axios.get(`${API}/filters/dealers`, {
        params,
        withCredentials: true
      });
      setOptions(prev => ({ ...prev, dealers: res.data.dealers || [] }));
    } catch (error) {
      console.error('Error loading dealers:', error);
    }
  };

  const loadEmployees = async () => {
    try {
      const res = await axios.get(`${API}/filters/employees`, {
        params: { dealer: filters.dealer },
        withCredentials: true
      });
      setOptions(prev => ({ ...prev, employees: res.data.employees || [] }));
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  };

  const activeFilters = getActiveFilters();
  const activeCount = Object.keys(activeFilters).filter(k => !['startDate', 'endDate'].includes(k)).length;

  return (
    <div className="backdrop-blur-md bg-background/80 border-b border-border/40 sticky top-0 z-20 p-4">
      <div className="flex items-center gap-4 flex-wrap">
        <Button
          variant={expanded ? "default" : "outline"}
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          Filters
          {activeCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
              {activeCount}
            </Badge>
          )}
        </Button>

        {/* Date Range */}
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {filters.startDate ? format(new Date(filters.startDate), 'MMM dd, yyyy') : 'Start Date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.startDate ? new Date(filters.startDate) : undefined}
                onSelect={(date) => updateFilter('startDate', date ? format(date, 'yyyy-MM-dd') : '')}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <span className="text-muted-foreground">to</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {filters.endDate ? format(new Date(filters.endDate), 'MMM dd, yyyy') : 'End Date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.endDate ? new Date(filters.endDate) : undefined}
                onSelect={(date) => updateFilter('endDate', date ? format(date, 'yyyy-MM-dd') : '')}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
      </div>

      {expanded && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-4">
          {/* State */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">State</label>
            <SearchableSelect
              options={['', ...options.states]}
              value={filters.state || ''}
              onValueChange={(v) => updateFilter('state', v)}
              placeholder="All States"
              searchPlaceholder="Search states..."
              emptyText="No states found."
            />
          </div>

          {/* Dealer */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Dealer</label>
            <SearchableSelect
              options={['', ...options.dealers]}
              value={filters.dealer || ''}
              onValueChange={(v) => updateFilter('dealer', v)}
              placeholder="All Dealers"
              searchPlaceholder="Search dealers..."
              emptyText="No dealers found."
            />
          </div>

          {/* Employee */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Employee</label>
            <SearchableSelect
              options={['', ...options.employees]}
              value={filters.employee || ''}
              onValueChange={(v) => updateFilter('employee', v)}
              placeholder="All Employees"
              searchPlaceholder="Search employees..."
              emptyText="No employees found."
              disabled={!filters.dealer && options.employees.length === 0}
            />
          </div>

          {/* Segment */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Segment</label>
            <SearchableSelect
              options={['', ...options.segments]}
              value={filters.segment || ''}
              onValueChange={(v) => updateFilter('segment', v)}
              placeholder="All Segments"
              searchPlaceholder="Search segments..."
              emptyText="No segments found."
            />
          </div>

          {/* KVA Min */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Min KVA</label>
            <Input
              type="number"
              placeholder="Min"
              value={filters.kvaMin}
              onChange={(e) => updateFilter('kvaMin', e.target.value)}
            />
          </div>

          {/* KVA Max */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Max KVA</label>
            <Input
              type="number"
              placeholder="Max"
              value={filters.kvaMax}
              onChange={(e) => updateFilter('kvaMax', e.target.value)}
            />
          </div>

          {/* Max Lead Age */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Max Lead Age (days)</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="365"
                step="10"
                value={filters.maxLeadAge || 365}
                onChange={(e) => updateFilter('maxLeadAge', e.target.value === '365' ? '' : e.target.value)}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <span className="text-sm font-medium min-w-[50px] text-right">
                {filters.maxLeadAge ? `≤${filters.maxLeadAge}d` : 'All'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
