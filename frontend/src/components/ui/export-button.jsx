import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, Image, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { exportToExcel, exportChartAsImage, exportTableToExcel } from '@/utils/exportUtils';

/**
 * ExportButton - Reusable component for exporting data and charts
 * 
 * @param {Object} props
 * @param {Array} props.data - Data array to export to Excel
 * @param {string} props.filename - Base filename for exports
 * @param {string} props.sheetName - Excel sheet name
 * @param {Array} props.columns - Column definitions for Excel export
 * @param {string|HTMLElement} props.chartRef - Chart element reference for image export
 * @param {string|HTMLElement} props.tableRef - Table element reference for table export
 * @param {boolean} props.showChartExport - Show chart image export option
 * @param {boolean} props.showDataExport - Show data Excel export option
 * @param {string} props.variant - Button variant
 * @param {string} props.size - Button size
 * @param {string} props.className - Additional classes
 * @param {boolean} props.disabled - Disable the button
 * @param {Function} props.onExport - Callback after successful export
 */
export const ExportButton = ({
  data = null,
  filename = 'export',
  sheetName = 'Data',
  columns = null,
  chartRef = null,
  tableRef = null,
  showChartExport = true,
  showDataExport = true,
  variant = 'outline',
  size = 'default',
  className = '',
  disabled = false,
  onExport = null,
  children = null
}) => {
  const [exporting, setExporting] = useState(false);

  const hasData = data && data.length > 0;
  const hasChart = chartRef !== null;
  const hasTable = tableRef !== null;
  const hasMultipleOptions = (showDataExport && hasData) && (showChartExport && (hasChart || hasTable));

  const handleExcelExport = async () => {
    setExporting(true);
    try {
      let success = false;
      
      if (tableRef) {
        success = exportTableToExcel(tableRef, filename, sheetName);
      } else if (hasData) {
        success = exportToExcel(data, filename, sheetName, columns);
      }

      if (success) {
        toast.success('Excel file downloaded successfully');
        onExport?.('excel');
      } else {
        toast.error('No data available to export');
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  const handleImageExport = async () => {
    if (!chartRef) {
      toast.error('No chart available to export');
      return;
    }

    setExporting(true);
    try {
      const success = await exportChartAsImage(chartRef, filename);
      if (success) {
        toast.success('Chart image downloaded successfully');
        onExport?.('image');
      } else {
        toast.error('Failed to capture chart');
      }
    } catch (error) {
      console.error('Image export error:', error);
      toast.error('Failed to export chart image');
    } finally {
      setExporting(false);
    }
  };

  // Simple single export (Excel only)
  if (!hasMultipleOptions) {
    return (
      <Button
        variant={variant}
        size={size}
        className={className}
        disabled={disabled || exporting || (!hasData && !hasTable && !hasChart)}
        onClick={hasChart && showChartExport ? handleImageExport : handleExcelExport}
        data-testid={`export-btn-${filename}`}
      >
        {exporting ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Download className="h-4 w-4 mr-2" />
        )}
        {children || (exporting ? 'Exporting...' : 'Export')}
      </Button>
    );
  }

  // Dropdown with multiple export options
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={className}
          disabled={disabled || exporting}
          data-testid={`export-dropdown-${filename}`}
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          {children || 'Export'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {showDataExport && (hasData || hasTable) && (
          <DropdownMenuItem onClick={handleExcelExport} data-testid={`export-excel-${filename}`}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export to Excel
          </DropdownMenuItem>
        )}
        {showChartExport && hasChart && (
          <>
            {showDataExport && (hasData || hasTable) && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={handleImageExport} data-testid={`export-image-${filename}`}>
              <Image className="h-4 w-4 mr-2" />
              Export Chart as Image
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

/**
 * SimpleExportButton - For pages that just need basic Excel export
 */
export const SimpleExportButton = ({ 
  data, 
  filename, 
  sheetName = 'Data',
  columns = null,
  ...props 
}) => (
  <ExportButton
    data={data}
    filename={filename}
    sheetName={sheetName}
    columns={columns}
    showChartExport={false}
    {...props}
  />
);

/**
 * ChartExportButton - For pages that need chart image export
 */
export const ChartExportButton = ({ 
  chartRef, 
  filename,
  data = null,
  columns = null,
  ...props 
}) => (
  <ExportButton
    chartRef={chartRef}
    filename={filename}
    data={data}
    columns={columns}
    showDataExport={!!data}
    {...props}
  />
);

export default ExportButton;
