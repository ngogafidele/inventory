import { connectToDatabase } from "@/lib/db/connection"
import { Product } from "@/lib/db/models/Product"
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

export default async function ProductsPage() {
  const session = requireServerSession()
  const store = getCurrentStore(session)

  await connectToDatabase()
  const products = await Product.find({ store }).populate("categoryId").lean()

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Catalog
        </p>
        <h2 className="text-2xl font-semibold">Products</h2>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Base Price</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product._id.toString()}>
              <TableCell>{product.name}</TableCell>
              <TableCell>{product.sku}</TableCell>
              <TableCell>
                {typeof product.categoryId === "object" && product.categoryId
                  ? product.categoryId.name
                  : "Unassigned"}
              </TableCell>
              <TableCell>{product.quantity}</TableCell>
              <TableCell>{formatCurrency(product.price)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
