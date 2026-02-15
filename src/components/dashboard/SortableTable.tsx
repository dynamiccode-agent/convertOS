"use client";

import { useState } from 'react';
import { ColumnConfig } from './ColumnManager';

interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

interface SortableTableProps {
  columns: ColumnConfig[];
  data: any[];
  onRowClick?: (row: any) => void;
  loading?: boolean;
  emptyMessage?: string;
}

export default function SortableTable({
  columns,
  data,
  onRowClick,
  loading = false,
  emptyMessage = 'No data found',
}: SortableTableProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  const visibleColumns = columns.filter(col => col.visible).sort((a, b) => a.order - b.order);

  const handleSort = (columnId: string) => {
    const column = columns.find(col => col.id === columnId);
    if (!column?.sortable) return;

    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig?.key === columnId && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key: columnId, direction });
  };

  const sortedData = [...data].sort((a, b) => {
    if (!sortConfig) return 0;

    const column = columns.find(col => col.id === sortConfig.key);
    if (!column) return 0;

    const aValue = getNestedValue(a, sortConfig.key);
    const bValue = getNestedValue(b, sortConfig.key);

    // Handle null/undefined
    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;

    let comparison = 0;

    switch (column.type) {
      case 'number':
      case 'currency':
      case 'percentage':
        const aNum = parseFloat(aValue) || 0;
        const bNum = parseFloat(bValue) || 0;
        comparison = aNum - bNum;
        break;
      case 'date':
        const aDate = new Date(aValue).getTime();
        const bDate = new Date(bValue).getTime();
        comparison = aDate - bDate;
        break;
      case 'text':
      default:
        comparison = String(aValue).localeCompare(String(bValue));
        break;
    }

    return sortConfig.direction === 'asc' ? comparison : -comparison;
  });

  const formatValue = (value: any, column: ColumnConfig) => {
    if (value === null || value === undefined) return '-';

    switch (column.type) {
      case 'currency':
        return `$${Number(value).toFixed(2)}`;
      case 'percentage':
        return `${Number(value).toFixed(2)}%`;
      case 'number':
        return Number(value).toLocaleString();
      case 'date':
        return new Date(value).toLocaleDateString();
      default:
        return String(value);
    }
  };

  const getSortIcon = (columnId: string) => {
    if (!sortConfig || sortConfig.key !== columnId) {
      return (
        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }

    return sortConfig.direction === 'asc' ? (
      <svg className="h-4 w-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="h-4 w-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700/50">
          <tr>
            {visibleColumns.map((column) => (
              <th
                key={column.id}
                onClick={() => column.sortable && handleSort(column.id)}
                className={`px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${
                  column.sortable ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{column.label}</span>
                  {column.sortable && getSortIcon(column.id)}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {loading ? (
            <tr>
              <td colSpan={visibleColumns.length} className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                <div className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading...
                </div>
              </td>
            </tr>
          ) : sortedData.length === 0 ? (
            <tr>
              <td colSpan={visibleColumns.length} className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sortedData.map((row, rowIndex) => (
              <tr
                key={row.id || rowIndex}
                onClick={() => onRowClick?.(row)}
                className={`${
                  onRowClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50' : ''
                } transition-colors`}
              >
                {visibleColumns.map((column) => (
                  <td
                    key={column.id}
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white"
                  >
                    {formatValue(getNestedValue(row, column.id), column)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// Helper to get nested object values (e.g., "metrics.spend")
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, prop) => current?.[prop], obj);
}
