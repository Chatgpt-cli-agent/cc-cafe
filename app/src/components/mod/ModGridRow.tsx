/**
 * Grid Row Component for Virtualized Grid
 *
 * Displays a row of dense S4MM-style mod tiles.
 */

'use client';

import ModCard from '@/components/mod/ModCard';
import { CurseForgeMod } from '@/types/curseforge';
import type { ModWarningStatus } from '@/types/fakeDetection';

interface ModGridRowProps {
  /** Slice of mods to display in this row */
  mods: CurseForgeMod[];
  /** Index of the row (for keys) */
  index: number;
  /** Number of columns for this row */
  columns: number;
  /** Warning statuses for mods (indexed by mod ID) */
  warningStatuses?: Record<number, ModWarningStatus>;
}

const GRID_COLS_CLASS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
  7: 'grid-cols-7',
  8: 'grid-cols-8',
  9: 'grid-cols-9',
  10: 'grid-cols-10',
  11: 'grid-cols-11',
  12: 'grid-cols-12',
};

/**
 * Row of dense square mod tiles for the Menu browse grid.
 */
export default function ModGridRow({ mods, index, columns, warningStatuses = {} }: ModGridRowProps) {
  const gridColsClass = GRID_COLS_CLASS[columns] || 'grid-cols-8';

  return (
    <div className={`grid ${gridColsClass} gap-x-3 gap-y-4 px-4 lg:px-8 py-2`} data-row-index={index}>
      {mods.map((mod) => (
        <ModCard key={mod.id} mod={mod} warningStatus={warningStatuses[mod.id]} />
      ))}
    </div>
  );
}
