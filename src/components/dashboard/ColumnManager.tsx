"use client";

import { useState } from 'react';

export interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  order: number;
  sortable: boolean;
  type: 'text' | 'number' | 'currency' | 'percentage' | 'date';
}

interface ColumnManagerProps {
  isOpen: boolean;
  onClose: () => void;
  columns: ColumnConfig[];
  onColumnsChange: (columns: ColumnConfig[]) => void;
}

export default function ColumnManager({
  isOpen,
  onClose,
  columns,
  onColumnsChange,
}: ColumnManagerProps) {
  const [localColumns, setLocalColumns] = useState<ColumnConfig[]>(columns);

  if (!isOpen) return null;

  const handleToggle = (columnId: string) => {
    setLocalColumns(prev =>
      prev.map(col =>
        col.id === columnId ? { ...col, visible: !col.visible } : col
      )
    );
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newColumns = [...localColumns];
    [newColumns[index - 1], newColumns[index]] = [newColumns[index], newColumns[index - 1]];
    newColumns.forEach((col, idx) => col.order = idx);
    setLocalColumns(newColumns);
  };

  const handleMoveDown = (index: number) => {
    if (index === localColumns.length - 1) return;
    const newColumns = [...localColumns];
    [newColumns[index], newColumns[index + 1]] = [newColumns[index + 1], newColumns[index]];
    newColumns.forEach((col, idx) => col.order = idx);
    setLocalColumns(newColumns);
  };

  const handleApply = () => {
    onColumnsChange(localColumns);
    onClose();
  };

  const handleReset = () => {
    const resetColumns = columns.map((col, idx) => ({
      ...col,
      visible: true,
      order: idx,
    }));
    setLocalColumns(resetColumns);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-md w-full max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Manage Columns
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Show, hide, and reorder columns. Changes apply to current view.
            </p>

            <div className="space-y-2">
              {localColumns.map((column, index) => (
                <div
                  key={column.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  {/* Visibility Toggle */}
                  <input
                    type="checkbox"
                    checked={column.visible}
                    onChange={() => handleToggle(column.id)}
                    className="h-4 w-4 text-violet-600 focus:ring-violet-500 border-gray-300 rounded"
                  />

                  {/* Column Label */}
                  <span className={`flex-1 text-sm ${
                    column.visible
                      ? 'text-gray-900 dark:text-white font-medium'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {column.label}
                  </span>

                  {/* Reorder Buttons */}
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Move up"
                    >
                      <svg className="h-4 w-4 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleMoveDown(index)}
                      disabled={index === localColumns.length - 1}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Move down"
                    >
                      <svg className="h-4 w-4 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Reset to Default
            </button>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                className="px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
