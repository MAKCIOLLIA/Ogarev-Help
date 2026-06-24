import React, { useState } from 'react';
import { BookText, ChevronDown, AlertTriangle, AlertCircle, Info, File, Download } from 'lucide-react';
import { ContentItem, SectionItem, AlertItem, FileItem, TableItem } from '../admin/editor-types';

const RecommendationSection: React.FC<{
    item: SectionItem;
    renderItem: (item: ContentItem) => React.ReactNode;
}> = ({ item, renderItem }) => {    const [isOpen, setIsOpen] = useState(item.isOpen || false);

    return (
        <details 
            open={isOpen}
            onToggle={(e) => setIsOpen(e.currentTarget.open)}
            className="mb-4 last:mb-0 border border-gray-100 rounded-xl bg-white shadow-sm overflow-hidden transition-all hover:shadow-md"
        >
            <summary className="p-5 cursor-pointer font-bold text-xl text-gray-800 bg-gray-50/50 hover:bg-gray-50 flex justify-between items-center list-none select-none">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg transition-colors ${isOpen ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-600'}`}>
                        <BookText size={20} />
                    </div>
                    <span>{item.title}</span>
                </div>
                <ChevronDown className={`w-6 h-6 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </summary>
            <div className="p-6 border-t border-gray-100 bg-white">
                {item.children.map(child => renderItem(child))}
            </div>
        </details>
    );
};

export const RecommendationsRenderer: React.FC<{ items: ContentItem[] }> = ({ items }) => {
    const renderItem = (item: ContentItem) => {
        switch (item.type) {
            case 'text':
                return (
                    <div key={item.id} className="mb-6 last:mb-0">
                        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-lg">
                            {item.content}
                        </p>
                    </div>
                );
            case 'image':
                return (
                    <div key={item.id} className="mb-8 last:mb-0">
                        <figure className="space-y-3">
                            <div className="rounded-xl overflow-hidden shadow-lg border border-gray-100 bg-gray-50 flex justify-center p-2">
                                <img 
                                    src={item.url} 
                                    alt={item.alt} 
                                    className="w-auto h-auto max-h-[500px] object-contain transition-transform duration-500" 
                                />
                            </div>
                            {item.caption && (
                                <figcaption className="text-center text-sm text-gray-500 italic font-medium">
                                    {item.caption}
                                </figcaption>
                            )}
                        </figure>
                    </div>
                );
            case 'alert': {
                const alertItem = item as AlertItem;
                return (
                    <div key={item.id} className={`mb-6 last:mb-0 p-5 rounded-xl border-2 flex gap-4 items-start ${
                        alertItem.level === 'error' ? 'bg-red-50 border-red-100 text-red-900' :
                        alertItem.level === 'warning' ? 'bg-amber-50 border-amber-100 text-amber-900' :
                        'bg-blue-50 border-blue-100 text-blue-900'
                    }`}>
                        <div className="flex-shrink-0 mt-1">
                            {alertItem.level === 'error' ? <AlertTriangle className="w-6 h-6 text-red-500" /> :
                             alertItem.level === 'warning' ? <AlertCircle className="w-6 h-6 text-amber-500" /> :
                             <Info className="w-6 h-6 text-blue-500" />}
                        </div>
                        <p className="font-bold text-lg leading-relaxed">
                            {alertItem.content}
                        </p>
                    </div>
                );
            }
            case 'file': {
                const fileItem = item as FileItem;
                return (
                    <div key={item.id} className="mb-6 last:mb-0">
                        <a 
                            href={fileItem.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-4 p-5 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md hover:border-amber-200 transition-all group"
                        >
                            <div className="w-14 h-14 bg-amber-50 rounded-xl flex items-center justify-center text-amber-500 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                                <File size={28} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-gray-800 truncate">{fileItem.name}</h4>
                                <p className="text-xs text-gray-400 font-bold uppercase mt-1">{fileItem.size || 'Загрузить файл'}</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-amber-50 group-hover:text-amber-500 transition-colors">
                                <Download size={20} />
                            </div>
                        </a>
                    </div>
                );
            }
            case 'table': {
                const tableItem = item as TableItem;
                return (
                    <div key={item.id} className="mb-8 last:mb-0 overflow-hidden border border-gray-100 rounded-xl shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/50">
                                        {tableItem.headers.map((header, i) => (
                                            <th key={i} className="px-6 py-4 text-xs font-black uppercase text-gray-400 border-b border-gray-100">
                                                {header}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {tableItem.rows.map((row, ri) => (
                                        <tr key={ri} className="hover:bg-gray-50/30 transition-colors">
                                            {row.map((cell, ci) => (
                                                <td key={ci} className="px-6 py-4 text-gray-600 text-sm font-medium">
                                                    {cell}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            }
            case 'section':
                return (
                    <RecommendationSection 
                        key={item.id} 
                        item={item as SectionItem} 
                        renderItem={renderItem} 
                    />
                );
            default:
                return null;
        }
    };

    return (
        <div className="space-y-6">
            {items.map(item => renderItem(item))}
        </div>
    );
};
