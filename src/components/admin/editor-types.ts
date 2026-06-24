// src/components/admin/editor-types.ts

export type ItemType = 'section' | 'text' | 'image' | 'alert' | 'file' | 'table';

export interface VisibilitySettings {
  roles: ('student' | 'parent' | 'child')[];
  specialization_ids?: string[]; // Array of specialization IDs
}

export interface BaseItem {
  id: string;
  type: ItemType;
  visibility?: VisibilitySettings;
}

export interface TextItem extends BaseItem {
  type: 'text';
  content: string;
}

export interface SectionItem extends BaseItem {
  type: 'section';
  title: string;
  children: ContentItem[];
  isOpen: boolean;
}

export interface ImageItem extends BaseItem {
  type: 'image';
  url: string;
  alt?: string;
  caption?: string;
}

export interface AlertItem extends BaseItem {
  type: 'alert';
  content: string;
  level: 'info' | 'warning' | 'error';
}

export interface FileItem extends BaseItem {
  type: 'file';
  url: string;
  name: string;
  size?: string;
}

export interface TableItem extends BaseItem {
  type: 'table';
  headers: string[];
  rows: string[][];
}

export type ContentItem = TextItem | SectionItem | ImageItem | AlertItem | FileItem | TableItem;
