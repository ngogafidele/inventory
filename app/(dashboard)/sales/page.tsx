import { connectToDatabase } from "@/lib/db/connection"
import { Sale } from "@/lib/db/models/Sale"
import { getCurrentStore, requireServerSession } from "@/lib/auth/server"
import { formatCurrency } from "@/lib/utils/format"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default async function SalesPage() {
  const session = requireServerSession()
  const store = getCurrentStore(session)

  await connectToDatabase()
  const sales = await Sale.find({ store }).sort({ createdAt: -1 }).lean()

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Transactions
        </p>
        <h2 className="text-2xl font-semibold">Sales</h2>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sales.map((sale) => (
            <TableRow key={sale._id.toString()}>
              <TableCell>
                {new Date(sale.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell>{sale.items.length}</TableCell>
              <TableCell>{formatCurrency(sale.totalAmount)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
