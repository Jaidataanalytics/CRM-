import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';

/**
 * Export data to Excel file
 * @param {Array} data - Array of objects to export
 * @param {string} filename - Name of the file (without extension)
 * @param {string} sheetName - Name of the Excel sheet
 * @param {Array} columns - Optional array of column definitions { key, header, width }
 */
export const exportToExcel = (data, filename, sheetName = 'Data', columns = null) => {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return false;
  }

  try {
    let worksheetData;
    let columnWidths = [];

    if (columns) {
      // Use custom column mapping
      const headers = columns.map(col => col.header || col.key);
      const rows = data.map(item => 
        columns.map(col => {
          const value = item[col.key];
          // Format numbers with proper locale
          if (typeof value === 'number') {
            return col.format === 'percent' ? `${(value * 100).toFixed(1)}%` : value;
          }
          return value ?? '';
        })
      );
      worksheetData = [headers, ...rows];
      columnWidths = columns.map(col => ({ wch: col.width || 15 }));
    } else {
      // Auto-generate from data keys
      const headers = Object.keys(data[0]);
      const rows = data.map(item => headers.map(key => item[key] ?? ''));
      worksheetData = [headers, ...rows];
      columnWidths = headers.map(h => ({ wch: Math.max(h.length + 2, 12) }));
    }

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    worksheet['!cols'] = columnWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    saveAs(blob, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    return true;
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    return false;
  }
};

/**
 * Export multiple sheets to a single Excel file
 * @param {Array} sheets - Array of { name, data, columns } objects
 * @param {string} filename - Name of the file (without extension)
 */
export const exportMultipleSheetsToExcel = (sheets, filename) => {
  if (!sheets || sheets.length === 0) {
    console.warn('No sheets to export');
    return false;
  }

  try {
    const workbook = XLSX.utils.book_new();

    sheets.forEach(({ name, data, columns }) => {
      if (!data || data.length === 0) return;

      let worksheetData;
      let columnWidths = [];

      if (columns) {
        const headers = columns.map(col => col.header || col.key);
        const rows = data.map(item =>
          columns.map(col => {
            const value = item[col.key];
            if (typeof value === 'number') {
              return col.format === 'percent' ? `${(value * 100).toFixed(1)}%` : value;
            }
            return value ?? '';
          })
        );
        worksheetData = [headers, ...rows];
        columnWidths = columns.map(col => ({ wch: col.width || 15 }));
      } else {
        const headers = Object.keys(data[0]);
        const rows = data.map(item => headers.map(key => item[key] ?? ''));
        worksheetData = [headers, ...rows];
        columnWidths = headers.map(h => ({ wch: Math.max(h.length + 2, 12) }));
      }

      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      worksheet['!cols'] = columnWidths;
      XLSX.utils.book_append_sheet(workbook, worksheet, name.slice(0, 31)); // Excel sheet name limit
    });

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    saveAs(blob, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    return true;
  } catch (error) {
    console.error('Error exporting multiple sheets to Excel:', error);
    return false;
  }
};

/**
 * Export a chart/element as PNG image
 * @param {HTMLElement|string} elementOrId - DOM element or element ID to capture
 * @param {string} filename - Name of the file (without extension)
 * @param {Object} options - html2canvas options
 */
export const exportChartAsImage = async (elementOrId, filename, options = {}) => {
  try {
    const element = typeof elementOrId === 'string' 
      ? document.getElementById(elementOrId) 
      : elementOrId;

    if (!element) {
      console.error('Element not found for chart export');
      return false;
    }

    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 2, // Higher quality
      logging: false,
      useCORS: true,
      ...options
    });

    canvas.toBlob((blob) => {
      if (blob) {
        saveAs(blob, `${filename}_${new Date().toISOString().slice(0, 10)}.png`);
      }
    }, 'image/png');

    return true;
  } catch (error) {
    console.error('Error exporting chart as image:', error);
    return false;
  }
};

/**
 * Export table data from HTML table element
 * @param {HTMLElement|string} tableOrId - Table element or ID
 * @param {string} filename - Name of the file (without extension)
 * @param {string} sheetName - Name of the Excel sheet
 */
export const exportTableToExcel = (tableOrId, filename, sheetName = 'Data') => {
  try {
    const table = typeof tableOrId === 'string'
      ? document.getElementById(tableOrId)
      : tableOrId;

    if (!table) {
      console.error('Table not found for export');
      return false;
    }

    const workbook = XLSX.utils.table_to_book(table, { sheet: sheetName });
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    saveAs(blob, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    return true;
  } catch (error) {
    console.error('Error exporting table to Excel:', error);
    return false;
  }
};

/**
 * Format data for common export scenarios
 */
export const formatters = {
  // Format number with locale
  number: (value) => {
    if (value === null || value === undefined) return '';
    return typeof value === 'number' ? value.toLocaleString() : value;
  },

  // Format percentage
  percent: (value) => {
    if (value === null || value === undefined) return '';
    return typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : value;
  },

  // Format currency (INR)
  currency: (value) => {
    if (value === null || value === undefined) return '';
    return typeof value === 'number' 
      ? `₹${value.toLocaleString('en-IN')}` 
      : value;
  },

  // Format date
  date: (value) => {
    if (!value) return '';
    try {
      return new Date(value).toLocaleDateString('en-IN');
    } catch {
      return value;
    }
  },

  // Format datetime
  datetime: (value) => {
    if (!value) return '';
    try {
      return new Date(value).toLocaleString('en-IN');
    } catch {
      return value;
    }
  }
};

/**
 * Common column definitions for reuse
 */
export const commonColumns = {
  leads: [
    { key: 'enquiry_no', header: 'Enquiry No', width: 15 },
    { key: 'name', header: 'Customer Name', width: 20 },
    { key: 'phone_number', header: 'Phone', width: 15 },
    { key: 'email_address', header: 'Email', width: 25 },
    { key: 'state', header: 'State', width: 15 },
    { key: 'district', header: 'District', width: 15 },
    { key: 'dealer', header: 'Dealer', width: 20 },
    { key: 'employee_name', header: 'Employee', width: 20 },
    { key: 'segment', header: 'Segment', width: 15 },
    { key: 'kva', header: 'KVA', width: 10 },
    { key: 'enquiry_status', header: 'Status', width: 15 },
    { key: 'enquiry_type', header: 'Type', width: 12 },
    { key: 'enquiry_stage', header: 'Stage', width: 15 },
    { key: 'source', header: 'Source', width: 15 },
    { key: 'enquiry_date', header: 'Enquiry Date', width: 15 },
    { key: 'planned_followup_date', header: 'Follow-up Date', width: 15 },
    { key: 'remarks', header: 'Remarks', width: 30 }
  ],

  kpis: [
    { key: 'name', header: 'Name', width: 25 },
    { key: 'total_leads', header: 'Total Leads', width: 12 },
    { key: 'won_leads', header: 'Won', width: 10 },
    { key: 'lost_leads', header: 'Lost', width: 10 },
    { key: 'open_leads', header: 'Open', width: 10 },
    { key: 'conversion_rate', header: 'Conv. Rate', width: 12, format: 'percent' }
  ],

  analytics: [
    { key: 'dimension', header: 'Dimension', width: 20 },
    { key: 'total', header: 'Total', width: 12 },
    { key: 'won', header: 'Won', width: 10 },
    { key: 'lost', header: 'Lost', width: 10 },
    { key: 'open', header: 'Open', width: 10 },
    { key: 'yoy_change', header: 'YoY Change', width: 12 }
  ]
};

export default {
  exportToExcel,
  exportMultipleSheetsToExcel,
  exportChartAsImage,
  exportTableToExcel,
  formatters,
  commonColumns
};
