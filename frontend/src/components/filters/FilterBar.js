import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useFilters } from '@/context/FilterContext';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, RotateCcw, Filter, X } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

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

  const handleSelectChange = (key, value) => {
    // Convert "all" back to empty string for the filter
    updateFilter(key, value === 'all' ? '' : value);
  };

  const getSelectValue = (value) => {
    // Convert empty string to "all" for the Select component
    return value || 'all';
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
            <Select value={getSelectValue(filters.state)} onValueChange={(v) => handleSelectChange('state', v)}>
              <SelectTrigger>
                <SelectValue placeholder="All States" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {options.states.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dealer */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Dealer</label>
            <Select value={getSelectValue(filters.dealer)} onValueChange={(v) => handleSelectChange('dealer', v)}>
              <SelectTrigger>
                <SelectValue placeholder="All Dealers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dealers</SelectItem>
                {options.dealers.map(d => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Employee */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Employee</label>
            <Select 
              value={getSelectValue(filters.employee)} 
              onValueChange={(v) => handleSelectChange('employee', v)}
              disabled={!filters.dealer && options.employees.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {options.employees.map(e => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Segment */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Segment</label>
            <Select value={getSelectValue(filters.segment)} onValueChange={(v) => handleSelectChange('segment', v)}>
              <SelectTrigger>
                <SelectValue placeholder="All Segments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Segments</SelectItem>
                {options.segments.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
        </div>
      )}
    </div>
  );
};
