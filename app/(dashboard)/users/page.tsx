import { connectToDatabase } from "@/lib/db/connection"
import { User } from "@/lib/db/models/User"
import { redirect } from "next/navigation"
import { requireServerSession } from "@/lib/auth/server"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default async function UsersPage() {
  const session = await requireServerSession()
  if (!session.isAdmin) {
    redirect("/dashboard")
  }
  await connectToDatabase()

  const users = await User.find().select("-password").lean()

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Access Control
        </p>
        <h2 className="text-2xl font-semibold">Users</h2>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Stores</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user._id.toString()}>
              <TableCell>{user.name}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell className="capitalize">{user.role}</TableCell>
              <TableCell>{user.stores.join(", ")}</TableCell>
              <TableCell>{user.isActive ? "Active" : "Inactive"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
