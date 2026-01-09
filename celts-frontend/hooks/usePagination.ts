import { useState, useCallback } from "react";

interface Options {
  initialPage?: number;
  initialLimit?: number;
}

export function usePagination(options: Options = {}) {
  const {
    initialPage = 1,
    initialLimit = 50,
  } = options;

  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);
  const [total, setTotal] = useState(0);

  const hasNext = page * limit < total;
  const hasPrev = page > 1;

  const nextPage = useCallback(() => {
    if (hasNext) setPage((p) => p + 1);
  }, [hasNext]);

  const prevPage = useCallback(() => {
    if (hasPrev) setPage((p) => p - 1);
  }, [hasPrev]);

  const reset = useCallback(() => {
    setPage(1);
  }, []);

  return {
    page,
    limit,
    total,
    hasNext,
    hasPrev,
    setPage,
    setLimit,
    setTotal,
    nextPage,
    prevPage,
    reset,
  };
}
