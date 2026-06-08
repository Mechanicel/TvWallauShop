import * as React from 'react';
import {
   type ColumnDef,
   type SortingState,
   flexRender,
   getCoreRowModel,
   getExpandedRowModel,
   getFilteredRowModel,
   getPaginationRowModel,
   getSortedRowModel,
   useReactTable,
} from '@tanstack/react-table';
import { ChevronDown, ChevronRight, ChevronsUpDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type DataTableProps<T> = {
   columns: ColumnDef<T, any>[];
   data: T[];
   globalFilter?: string;
   pageSize?: number;
   loading?: boolean;
   emptyMessage?: string;
   renderSubComponent?: (row: T) => React.ReactNode;
   getRowId?: (row: T, index: number) => string;
};

export function DataTable<T>({
   columns,
   data,
   globalFilter,
   pageSize = 10,
   loading = false,
   emptyMessage = 'Keine Einträge gefunden.',
   renderSubComponent,
   getRowId,
}: DataTableProps<T>) {
   const [sorting, setSorting] = React.useState<SortingState>([]);

   const table = useReactTable({
      data,
      columns,
      state: { sorting, globalFilter: globalFilter ?? '' },
      onSortingChange: setSorting,
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
      getPaginationRowModel: getPaginationRowModel(),
      getExpandedRowModel: renderSubComponent ? getExpandedRowModel() : undefined,
      getRowCanExpand: renderSubComponent ? () => true : undefined,
      initialState: { pagination: { pageSize } },
      getRowId,
   });

   const leafCount = table.getAllLeafColumns().length + (renderSubComponent ? 1 : 0);
   const rows = table.getRowModel().rows;

   return (
      <div className="space-y-4">
         <div className="overflow-hidden rounded-lg border border-solid border-border bg-surface">
            <Table>
               <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                     <TableRow key={headerGroup.id} className="hover:bg-transparent">
                        {renderSubComponent && <TableHead className="w-10" />}
                        {headerGroup.headers.map((header) => {
                           const canSort = header.column.getCanSort();
                           const sorted = header.column.getIsSorted();
                           return (
                              <TableHead key={header.id}>
                                 {header.isPlaceholder ? null : canSort ? (
                                    <button
                                       type="button"
                                       className="inline-flex items-center gap-1 border-0 bg-transparent p-0 font-medium text-muted-foreground transition-colors hover:text-foreground"
                                       onClick={header.column.getToggleSortingHandler()}
                                    >
                                       {flexRender(header.column.columnDef.header, header.getContext())}
                                       {sorted === 'asc' ? (
                                          <ChevronUp className="h-3.5 w-3.5" />
                                       ) : sorted === 'desc' ? (
                                          <ChevronDown className="h-3.5 w-3.5" />
                                       ) : (
                                          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
                                       )}
                                    </button>
                                 ) : (
                                    flexRender(header.column.columnDef.header, header.getContext())
                                 )}
                              </TableHead>
                           );
                        })}
                     </TableRow>
                  ))}
               </TableHeader>
               <TableBody>
                  {loading ? (
                     <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={leafCount} className="py-8 text-center text-muted-foreground">
                           Lädt…
                        </TableCell>
                     </TableRow>
                  ) : rows.length === 0 ? (
                     <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={leafCount} className="py-8 text-center text-muted-foreground">
                           {emptyMessage}
                        </TableCell>
                     </TableRow>
                  ) : (
                     rows.map((row) => (
                        <React.Fragment key={row.id}>
                           <TableRow>
                              {renderSubComponent && (
                                 <TableCell className="w-10">
                                    <button
                                       type="button"
                                       aria-label="Zeile aufklappen"
                                       onClick={() => row.toggleExpanded()}
                                       className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
                                    >
                                       {row.getIsExpanded() ? (
                                          <ChevronDown className="h-4 w-4" />
                                       ) : (
                                          <ChevronRight className="h-4 w-4" />
                                       )}
                                    </button>
                                 </TableCell>
                              )}
                              {row.getVisibleCells().map((cell) => (
                                 <TableCell key={cell.id}>
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                 </TableCell>
                              ))}
                           </TableRow>
                           {renderSubComponent && row.getIsExpanded() && (
                              <TableRow className="hover:bg-transparent">
                                 <TableCell colSpan={leafCount} className="bg-background">
                                    {renderSubComponent(row.original)}
                                 </TableCell>
                              </TableRow>
                           )}
                        </React.Fragment>
                     ))
                  )}
               </TableBody>
            </Table>
         </div>

         {table.getPageCount() > 1 && (
            <div className="flex items-center justify-between gap-2">
               <span className="text-sm text-muted-foreground">
                  Seite {table.getState().pagination.pageIndex + 1} von {table.getPageCount()}
               </span>
               <div className="flex gap-2">
                  <Button
                     variant="outline"
                     size="sm"
                     onClick={() => table.previousPage()}
                     disabled={!table.getCanPreviousPage()}
                  >
                     Zurück
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                     Weiter
                  </Button>
               </div>
            </div>
         )}
      </div>
   );
}
