export interface Paginated<T> {
  results: T[];
  total: number;
  page: number;
  limit: number;
}

export function pageWindow(page = 1, limit = 20) {
  return { skip: (page - 1) * limit, limit };
}
