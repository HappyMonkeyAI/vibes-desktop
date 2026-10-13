import React from 'react';
import { Button } from '@arco-design/web-react';
import type { ActivityPaginationResult } from './useActivityPagination';
import styles from './MissionControl.module.css';

/** T6 — page controls for the activity window. Hidden when everything fits one page. */
type Props = Omit<ActivityPaginationResult<unknown>, 'visibleItems' | 'nextPage' | 'previousPage' | 'visibleCount'> & {
  onNextPage: () => void;
  onPreviousPage: () => void;
};

export const PaginationControls: React.FC<Props> = ({
  totalCount,
  remainingCount,
  pageSize,
  firstVisibleIndex,
  lastVisibleIndex,
  hasPrevious,
  hasMore,
  onNextPage,
  onPreviousPage,
}) => {
  if (totalCount <= pageSize) return null;

  return (
    <div className={styles.pagination} aria-live="polite" aria-atomic="true">
      <span className={styles.paginationRange}>
        ({firstVisibleIndex}–{lastVisibleIndex} of {totalCount})
      </span>
      <div className={styles.paginationButtons}>
        <Button size="small" type="secondary" onClick={hasPrevious ? onPreviousPage : undefined} aria-disabled={!hasPrevious}>
          Back
        </Button>
        <Button size="small" type="secondary" onClick={hasMore ? onNextPage : undefined} aria-disabled={!hasMore}>
          {hasMore ? `Show more (${Math.min(pageSize, remainingCount)} of ${remainingCount})` : 'Next'}
        </Button>
      </div>
    </div>
  );
};
