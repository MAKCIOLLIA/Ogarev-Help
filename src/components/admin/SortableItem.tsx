import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

interface SortableItemProps {
  id: string;
  children: React.ReactNode;
}

export const SortableItem: React.FC<SortableItemProps> = ({ id, children }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition: isDragging ? transition : undefined,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`relative flex items-start bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md ${isDragging ? 'z-50 shadow-2xl ring-2 ring-blue-500' : 'transition-all duration-200'}`}
    >
      <div 
        {...attributes} 
        {...listeners} 
        className="p-3 cursor-grab active:cursor-grabbing text-gray-300 hover:text-blue-500 transition-colors flex-shrink-0 self-stretch flex items-center group/grip"
      >
        <GripVertical size={18} className="group-hover/grip:scale-110 transition-transform" />
      </div>
      <div className="flex-1 p-3 pl-0 min-h-[44px]">
        {children}
      </div>
    </div>
  );
};
