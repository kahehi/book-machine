/**
 * Domain: Series Model
 * Pure business logic, no external calls
 */

export interface Series {
  id: string;
  title: string;
  targetAgeGroup: string;
  theme: string;
  booksCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export function createSeries(data: Omit<Series, 'id' | 'createdAt' | 'updatedAt'>): Series {
  return {
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
