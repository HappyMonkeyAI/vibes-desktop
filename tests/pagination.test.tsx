import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useActivityPagination, ACTIVITY_PAGE_SIZE } from '../src/renderer/useActivityPagination';

type Item = { id: string };
const items = (n: number): Item[] => Array.from({ length: n }, (_, i) => ({ id: `t${i}` }));

describe('useActivityPagination (T6)', () => {
  it('shows only the first page and reports the remainder', () => {
    const { result } = renderHook(() => useActivityPagination(items(120), 'key'));
    expect(result.current.visibleItems).toHaveLength(ACTIVITY_PAGE_SIZE);
    expect(result.current.totalCount).toBe(120);
    expect(result.current.remainingCount).toBe(120 - ACTIVITY_PAGE_SIZE);
    expect(result.current.hasMore).toBe(true);
    expect(result.current.hasPrevious).toBe(false);
  });

  it('hides controls when everything fits one page', () => {
    const { result } = renderHook(() => useActivityPagination(items(10), 'key'));
    expect(result.current.visibleItems).toHaveLength(10);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.remainingCount).toBe(0);
  });

  it('advances and rewinds a full page at a time', () => {
    const { result } = renderHook(() => useActivityPagination(items(120), 'key'));
    act(() => result.current.nextPage());
    expect(result.current.visibleItems[0].id).toBe(`t${ACTIVITY_PAGE_SIZE}`);
    expect(result.current.firstVisibleIndex).toBe(ACTIVITY_PAGE_SIZE + 1);
    expect(result.current.hasPrevious).toBe(true);

    act(() => result.current.previousPage());
    expect(result.current.visibleItems[0].id).toBe('t0');
    expect(result.current.hasPrevious).toBe(false);
  });

  it('clamps the start index to the last partial page', () => {
    const { result } = renderHook(() => useActivityPagination(items(120), 'key'));
    act(() => result.current.nextPage());
    act(() => result.current.nextPage()); // past the end — must clamp, not overflow
    expect(result.current.visibleItems).toHaveLength(120 - 2 * ACTIVITY_PAGE_SIZE);
    expect(result.current.hasMore).toBe(false);
  });

  it('resets to page 0 when the reset key changes', () => {
    const { result, rerender } = renderHook(({ k }: { k: string }) => useActivityPagination(items(120), k), { initialProps: { k: 'a' } });
    act(() => result.current.nextPage());
    expect(result.current.visibleItems[0].id).toBe(`t${ACTIVITY_PAGE_SIZE}`);

    // A new entry set (different id list) must snap back to the first page.
    rerender({ k: 'b' });
    expect(result.current.visibleItems[0].id).toBe('t0');
    expect(result.current.hasPrevious).toBe(false);
  });
});
