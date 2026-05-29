// Renders product table rows for read-oriented product displays.
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export type ProductsTableRow = {
  id: string
  name: string
  sku: string
  unit?: string
  quantity: number
}

export function ProductsTable({ rows }: { rows: ProductsTableRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>SKU</TableHead>
          <TableHead>Quantity</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, rowIndex) => (
          <TableRow
            key={row.id}
            className={
              rowIndex % 2 === 1 ? "bg-muted/60 hover:bg-muted/70" : undefined
            }
          >
            <TableCell>{row.name}</TableCell>
            <TableCell>{row.sku}</TableCell>
            <TableCell>
              {row.quantity} {row.unit ?? "pcs"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
