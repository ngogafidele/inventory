import { connectToDatabase } from "@/lib/db/connection"
import { Category } from "@/lib/db/models/Category"
import { getCurrentStore, requireServerSession } from "@/lib/auth/server"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default async function CategoriesPage() {
  const session = requireServerSession()
  const store = getCurrentStore(session)

  await connectToDatabase()
  const categories = await Category.find({ store }).lean()

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Organization
        </p>
        <h2 className="text-2xl font-semibold">Categories</h2>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.map((category) => (
            <TableRow key={category._id.toString()}>
              <TableCell>{category.name}</TableCell>
              <TableCell>{category.description || "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
