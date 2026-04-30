import { connectToDatabase } from "@/lib/db/connection"
import { Product } from "@/lib/db/models/Product"
import { getCurrentStore, requireServerSession } from "@/lib/auth/server"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default async function AlertsPage() {
  const session = await requireServerSession()
  const store = getCurrentStore(session)

  await connectToDatabase()
  const lowStockProducts = await Product.find({
    store,
    $expr: { $lte: ["$quantity", { $ifNull: ["$lowStockThreshold", 0] }] },
  })
    .sort({ quantity: 1, name: 1 })
    .lean()

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Monitoring
        </p>
        <h2 className="text-2xl font-semibold">Low Stock Alerts</h2>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Threshold</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lowStockProducts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                No low stock products right now.
              </TableCell>
            </TableRow>
          ) : (
            lowStockProducts.map((product) => (
              <TableRow key={product._id.toString()}>
                <TableCell>{product.name}</TableCell>
                <TableCell>{product.sku}</TableCell>
                <TableCell>
                  {product.quantity} {product.unit ?? "pcs"}
                </TableCell>
                <TableCell>
                  {product.lowStockThreshold ?? 0} {product.unit ?? "pcs"}
                </TableCell>
                <TableCell>
                  {product.quantity === 0 ? "Out of Stock" : "Low Stock"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
