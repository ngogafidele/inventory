import { connectToDatabase } from "@/lib/db/connection"
import { StockAdjustment } from "@/lib/db/models/StockAdjustment"
import { getCurrentStore, requireServerSession } from "@/lib/auth/server"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default async function StockAdjustmentsPage() {
  const session = await requireServerSession()
  const store = getCurrentStore(session)

  await connectToDatabase()
  const adjustments = await StockAdjustment.find({ store })
    .sort({ createdAt: -1 })
    .lean()

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Inventory Control
        </p>
        <h2 className="text-2xl font-semibold">Stock Adjustments</h2>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Change</TableHead>
            <TableHead>Reason</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {adjustments.map((adjustment) => (
            <TableRow key={adjustment._id.toString()}>
              <TableCell>
                {new Date(adjustment.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell>{adjustment.sku}</TableCell>
              <TableCell>{adjustment.quantityChange}</TableCell>
              <TableCell>{adjustment.reason}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
