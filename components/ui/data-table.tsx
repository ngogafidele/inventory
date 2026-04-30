"use client"

import * as React from "react"

export type DataTableColumn<T> = {
  header: string
  accessor: keyof T
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
}: {
  columns: Array<DataTableColumn<T>>
  data: T[]
}) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b">
          <tr>
            {columns.map((column) => (
              <th
                key={column.header}
                className="px-3 py-2 text-left font-medium text-foreground"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b last:border-0">
              {columns.map((column) => (
                <td key={column.header} className="px-3 py-2">
                  {String(row[column.accessor] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
