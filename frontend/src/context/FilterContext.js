import { createContext, useContext, useState, useCallback } from 'react';

const FilterContext = createContext(null);

// Get Indian Financial Year dates (April 1st to present date)
// Indian FY: April 1 to March 31 of next year
const getIndianFYDates = () => {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0-indexed (0 = January, 3 = April)
  
  // Indian Financial Year starts on April 1st
  // If current month is before April (0-2), FY started previous year
  // If current month is April or later (3-11), FY started this year
  const fyStartYear = currentMonth < 3 ? currentYear - 1 : currentYear;
  
  // Start from April 1st of current Indian Financial Year
  const startDate = `${fyStartYear}-04-01`;
  const endDate = today.toISOString().split('T')[0]; // Today's date in YYYY-MM-DD
  
  return {
    startDate,
    endDate
  };
};

const initialFilters = {
  zone: '',
  state: '',
  area: '',
  dealer: '',
  employee: '',
  segment: '',
  enquiryStatus: '',
  enquiryStage: '',
  enquiryType: '',
  kvaMin: '',
  kvaMax: '',
  ...getIndianFYDates()
};

export const FilterProvider = ({ children }) => {
  const [filters, setFilters] = useState(initialFilters);

  const updateFilter = useCallback((key, value) => {
    setFilters(prev => {
      const newFilters = { ...prev, [key]: value };
      
      // Clear dependent filters
      if (key === 'zone') {
        newFilters.state = '';
        newFilters.area = '';
        newFilters.dealer = '';
        newFilters.employee = '';
      } else if (key === 'state') {
        newFilters.area = '';
        newFilters.dealer = '';
        newFilters.employee = '';
      } else if (key === 'area') {
        newFilters.dealer = '';
        newFilters.employee = '';
      } else if (key === 'dealer') {
        newFilters.employee = '';
      }
      
      return newFilters;
    });
  }, []);

  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(initialFilters);
  }, []);

  const getActiveFilters = useCallback(() => {
    const active = {};
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== '') {
        active[key] = value;
      }
    });
    return active;
  }, [filters]);

  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();
    const active = getActiveFilters();
    
    if (active.state) params.append('state', active.state);
    if (active.dealer) params.append('dealer', active.dealer);
    if (active.employee) params.append('employee_name', active.employee);
    if (active.segment) params.append('segment', active.segment);
    if (active.enquiryStatus) params.append('enquiry_status', active.enquiryStatus);
    if (active.enquiryStage) params.append('enquiry_stage', active.enquiryStage);
    if (active.kvaMin) params.append('kva_min', active.kvaMin);
    if (active.kvaMax) params.append('kva_max', active.kvaMax);
    if (active.startDate) params.append('start_date', active.startDate);
    if (active.endDate) params.append('end_date', active.endDate);
    
    return params.toString();
  }, [getActiveFilters]);

  return (
    <FilterContext.Provider value={{
      filters,
      updateFilter,
      updateFilters,
      resetFilters,
      getActiveFilters,
      buildQueryParams
    }}>
      {children}
    </FilterContext.Provider>
  );
};

export const useFilters = () => {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
};
