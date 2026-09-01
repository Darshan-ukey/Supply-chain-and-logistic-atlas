/**
 * Reference example — malkom-runtime React page using the table engine.
 * (Documentation example; not part of the build.)
 */

import { useMemo, useRef } from 'react';
import { MalkomTable, MalkomTableEngine } from '@malkom/table-react';
import type { MalkomTableConfig, TableExporter } from '@malkom/table-react';

interface WorkItemRow {
  workItemId: string;
  queue: string;
  status: 'Open' | 'WIP' | 'Done';
  amount: number;
  createdAt: string;
  assignee: string;
  [key: string]: unknown;
}

declare function fetchWorkItems(): Promise<WorkItemRow[]>;
declare function toast(message: string, kind: string): void;

/** Future integration example: exporters are plain objects. */
const excelOnlineExporter: TableExporter<WorkItemRow> = {
  id: 'excel-online',
  label: 'Excel Online',
  icon: 'table_view',
  async run(ctx) {
    // create workbook via Graph API, write ctx.rows using ctx.valueOf(row, field)
    void ctx;
  }
};

export function WorklistPage() {
  const engineRef = useRef<MalkomTableEngine<WorkItemRow> | null>(null);

  const config = useMemo<MalkomTableConfig<WorkItemRow>>(
    () => ({
      title: 'HITL Worklist',
      index: 'workItemId',
      persistenceId: 'hitl_worklist',
      loadData: fetchWorkItems,
      features: { autoRefreshMs: 60_000, paginationSize: 15 },
      groupBy: 'queue',
      columns: [
        { field: 'workItemId', header: 'Work Item', locked: true, frozen: true },
        { field: 'queue', header: 'Queue' },
        {
          field: 'status',
          header: 'Status',
          formatter: ({ value }) =>
            `<span class="px-2 py-0.5 rounded-md text-xs font-bold ${
              value === 'Open'
                ? 'bg-rose-50 text-rose-700'
                : value === 'WIP'
                  ? 'bg-orange-50 text-orange-700'
                  : 'bg-emerald-50 text-emerald-700'
            }">${String(value)}</span>`
        },
        {
          field: 'amount',
          header: 'Amount',
          type: 'number',
          sorter: 'number',
          hozAlign: 'right',
          exportValue: (row) => row.amount.toFixed(2)
        },
        { field: 'createdAt', header: 'Created', type: 'date', sorter: 'date' },
        { field: 'assignee', header: 'Assignee' }
      ],
      exporters: [excelOnlineExporter],
      notify: toast,
      onRowClick: (row) => {
        console.log('open work item', row.workItemId);
      }
    }),
    []
  );

  return (
    <div className="h-full p-4">
      <MalkomTable<WorkItemRow>
        config={config}
        ref={engineRef}
        className="h-full"
        onReady={(engine) => {
          engine.on('dataLoaded', (rows) => console.log(`${rows.length} items`));
        }}
      />
    </div>
  );
}
