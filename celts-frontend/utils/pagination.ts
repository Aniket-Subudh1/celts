export interface PaginationState {
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
}

export interface PaginationResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
}

// Normalize backend paginated response
export function normalizePagination<T>(response: PaginationResponse<T>) {
  return {
    items: response.data,
    pagination: {
      page: response.page,
      limit: response.limit,
      total: response.total,
      hasNext: response.hasNext,
    },
  };
}

//  Builds QUERY STRING (not object)
export function buildPaginationQuery(
  page = 1,
  limit = 50,
  extra: Record<string, string | number | undefined> = {}
) {
  const params = new URLSearchParams();

  params.set("page", String(page));
  params.set("limit", String(limit));

  Object.entries(extra).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.set(key, String(value));
    }
  });

  return params.toString(); 
}

//  Calculate total pages safely
export function getTotalPages(total: number, limit: number) {
  if (!limit) return 1;
  return Math.max(Math.ceil(total / limit), 1);
}
