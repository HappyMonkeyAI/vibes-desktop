import { useCallback, useMemo, useState } from 'react';

/**
 * T6 — windowed pagination for the activity list. Ported from the fork's
 * useCatalogPagination (wayland-fork src/renderer/components/layout/library),
 * self-contained: no i18n, no shared-library dependency. Bounded DOM growth —
 * only a page of rows renders at a time; changing resetKey returns to page 0.
 */

export const ACTIVITY_PAGE_SIZE = 48;

export type ActivityPaginationResult<Item> = {
  visibleItems: Item[];
  visibleCount: number;
  totalCount: number;
  remainingCount: number;
  pageSize: number;
  firstVisibleIndex: number;
  lastVisibleIndex: number;
  hasPrevious: boolean;
  hasMore: boolean;
  nextPage: () => void;
  previousPage: () => void;
};

type WindowState = { resetKey: string; startIndex: number };

export function useActivityPagination<Item>(
  items: readonly Item[],
  resetKey: string,
  pageSize = ACTIVITY_PAGE_SIZE,
): ActivityPaginationResult<Item> {
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const [windowState, setWindowState] = useState<WindowState>({ resetKey, startIndex: 0 });

  const maximumStart = items.length === 0 ? 0 : Math.floor((items.length - 1) / safePageSize) * safePageSize;
  const requestedStart = windowState.resetKey === resetKey ? windowState.startIndex : 0;
  const startIndex = Math.min(requestedStart, maximumStart);
  const endIndex = Math.min(items.length, startIndex + safePageSize);
  const visibleCount = endIndex - startIndex;
  const visibleItems = useMemo(() => items.slice(startIndex, endIndex), [endIndex, items, startIndex]);
  const remainingCount = Math.max(0, items.length - endIndex);
  const hasPrevious = startIndex > 0;
  const hasMore = remainingCount > 0;

  const nextPage = useCallback(() => {
    setWindowState((current) => {
      const currentStart = current.resetKey === resetKey ? current.startIndex : 0;
      return { resetKey, startIndex: Math.min(maximumStart, currentStart + safePageSize) };
    });
  }, [maximumStart, resetKey, safePageSize]);

  const previousPage = useCallback(() => {
    setWindowState((current) => {
      const currentStart = current.resetKey === resetKey ? current.startIndex : 0;
      return { resetKey, startIndex: Math.max(0, currentStart - safePageSize) };
    });
  }, [resetKey, safePageSize]);

  return {
    visibleItems,
    visibleCount,
    totalCount: items.length,
    remainingCount,
    pageSize: safePageSize,
    firstVisibleIndex: visibleCount === 0 ? 0 : startIndex + 1,
    lastVisibleIndex: endIndex,
    hasPrevious,
    hasMore,
    nextPage,
    previousPage,
  };
}
