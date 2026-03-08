/**
 * Domain: Book Model
 * Represents a single book in a series
 */

import type { Page } from './page';

export interface Book {
  id: string;
  seriesId: string;
  title: string;
  bookNumber: number;
  pages: Page[];
  status: 'draft' | 'approved' | 'published';
  createdAt: Date;
  updatedAt: Date;
}

export function createBook(data: Omit<Book, 'id' | 'createdAt' | 'updatedAt'>): Book {
  return {
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
