"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

export interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  order: number;
  sortable: boolean;
  type: 'text' | 'number' | 'currency' | 'percentage' | 'date';
}

interface DraggableColumnManagerProps {
  isOpen: boolean;
  onClose: () => void;
  columns: ColumnConfig[];
  onColumnsChange: (columns: ColumnConfig[]) => void;
}

interface DraggableColumnItemProps {
  column: ColumnConfig;
  index: number;
  moveColumn: (fromIndex: number, toIndex: number) => void;
  onToggle: (columnId: string) => void;
}

const ItemType = 'COLUMN';

function DraggableColumnItem({ column, index, moveColumn, onToggle }: DraggableColumnItemProps) {
  const isNameColumn = column.id === 'name';
  const dragDropRef = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag, preview] = useDrag({
    type: ItemType,
    item: { index },
    canDrag: !isNameColumn,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: ItemType,
    hover: (item: { index: number }) => {
      if (item.index !== index && !isNameColumn) {
        moveColumn(item.index, index);
        item.index = index;
      }
    },
  });

  // Connect drag and drop refs
  drag(drop(dragDropRef));

  return (
    <div
      ref={isNameColumn ? undefined : dragDropRef}
      className={`flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg ${
        isDragging ? 'opacity-50' : ''
      } ${isNameColumn ? 'opacity-75' : 'cursor-move'}`}
    >
      {/* Drag Handle */}
      {!isNameColumn && (
        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
        </svg>
      )}

      {/* Visibility Toggle */}
      <input
        type="checkbox"
        checked={column.visible}
        onChange={() => onToggle(column.id)}
        disabled={isNameColumn}
        className="h-4 w-4 text-violet-600 focus:ring-violet-500 border-gray-300 rounded disabled:opacity-50"
      />

      {/* Column Label */}
      <span className={`flex-1 text-sm ${
        column.visible
          ? 'text-gray-900 dark:text-white font-medium'
          : 'text-gray-500 dark:text-gray-400'
      }`}>
        {column.label} {isNameColumn && <span className="text-xs text-gray-400 ml-2">(Fixed)</span>}
      </span>
    </div>
  );
}

export default function DraggableColumnManager({
  isOpen,
  onClose,
  columns,
  onColumnsChange,
}: DraggableColumnManagerProps) {
  const [localColumns, setLocalColumns] = useState<ColumnConfig[]>(columns);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen) return null;
  if (!mounted) return null; // Don't render DnD on server

  const handleToggle = (columnId: string) => {
    setLocalColumns(prev =>
      prev.map(col =>
        col.id === columnId ? { ...col, visible: !col.visible } : col
      )
    );
  };

  const moveColumn = useCallback((fromIndex: number, toIndex: number) => {
    setLocalColumns(prev => {
      const newColumns = [...prev];
      const [movedColumn] = newColumns.splice(fromIndex, 1);
      newColumns.splice(toIndex, 0, movedColumn);
      // Update order values
      return newColumns.map((col, idx) => ({ ...col, order: idx }));
    });
  }, []);

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
              Drag and drop to reorder (except Name). Toggle visibility with checkboxes.
            </p>

            <DndProvider backend={HTML5Backend}>
              <div className="space-y-2">
                {localColumns.map((column, index) => (
                  <DraggableColumnItem
                    key={column.id}
                    column={column}
                    index={index}
                    moveColumn={moveColumn}
                    onToggle={handleToggle}
                  />
                ))}
              </div>
            </DndProvider>
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
