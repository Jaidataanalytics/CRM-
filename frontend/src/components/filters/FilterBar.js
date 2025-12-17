import { useState, useEffect } from 'react';
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
import { CalendarIcon, RotateCcw, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const FilterBar = () => {
  const { filters, updateFilter, resetFilters } = useFilters();
  const [options, setOptions] = useState({
    states: [],
    areas: [],
    dealers: [],
    employees: [],
    segments: []
  });
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadInitialOptions();
  }, []);

  useEffect(() => {
    if (filters.state) loadAreas();
  }, [filters.state]);

  useEffect(() => {
    if (filters.state || filters.area) loadDealers();
  }, [filters.state, filters.area]);

  useEffect(() => {
    if (filters.dealer) loadEmployees();
  }, [filters.dealer]);

  const loadInitialOptions = async () => {
    try {
      const [statesRes, segmentsRes] = await Promise.all([
        axios.get(`${API}/filters/states`, { withCredentials: true }),
        axios.get(`${API}/filters/segments`, { withCredentials: true })
      ]);
      setOptions(prev => ({
        ...prev,
        states: statesRes.data.states || [],
        segments: segmentsRes.data.segments || []
      }));
    } catch (error) {
      console.error('Error loading filter options:', error);
    }
  };

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
      const res = await axios.get(`${API}/filters/dealers`, {
        params: { state: filters.state, area: filters.area },
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

  return (
    <div className="backdrop-blur-md bg-background/80 border-b border-border/40 sticky top-0 z-20 p-4">
      <div className="flex items-center gap-4 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          Filters
        </Button>

        {/* Date Range */}
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {filters.startDate ? format(new Date(filters.startDate), 'MMM dd, yyyy') : 'Start'}
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
                {filters.endDate ? format(new Date(filters.endDate), 'MMM dd, yyyy') : 'End'}
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
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-4">
          {/* State */}
          <Select value={filters.state} onValueChange={(v) => updateFilter('state', v)}>
            <SelectTrigger>
              <SelectValue placeholder="State" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All States</SelectItem>
              {options.states.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Area */}
          <Select value={filters.area} onValueChange={(v) => updateFilter('area', v)} disabled={!filters.state}>
            <SelectTrigger>
              <SelectValue placeholder="Area" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Areas</SelectItem>
              {options.areas.map(a => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Dealer */}
          <Select value={filters.dealer} onValueChange={(v) => updateFilter('dealer', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Dealer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Dealers</SelectItem>
              {options.dealers.map(d => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Employee */}
          <Select value={filters.employee} onValueChange={(v) => updateFilter('employee', v)} disabled={!filters.dealer}>
            <SelectTrigger>
              <SelectValue placeholder="Employee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Employees</SelectItem>
              {options.employees.map(e => (
                <SelectItem key={e} value={e}>{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Segment */}
          <Select value={filters.segment} onValueChange={(v) => updateFilter('segment', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Segment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Segments</SelectItem>
              {options.segments.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* KVA Range */}
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Min KVA"
              value={filters.kvaMin}
              onChange={(e) => updateFilter('kvaMin', e.target.value)}
              className="w-full"
            />
            <Input
              type="number"
              placeholder="Max KVA"
              value={filters.kvaMax}
              onChange={(e) => updateFilter('kvaMax', e.target.value)}
              className="w-full"
            />
          </div>
        </div>
      )}
    </div>
  );
};
