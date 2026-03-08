/**
 * Domain: Page Model
 * Represents a single page in a book
 */

export interface Page {
  id: string;
  pageNumber: number;
  text: string;
  illustrationPrompt?: string;
  illustrationUrl?: string;
  readingLevel: 'simple' | 'intermediate' | 'advanced';
}

export function createPage(data: Omit<Page, 'id'>): Page {
  return {
    ...data,
    id: crypto.randomUUID(),
  };
}
