import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export type UsersTableRow = {
  id: string
  name: string
  email: string
  role: string
}

export function UsersTable({ rows }: { rows: UsersTableRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>{row.name}</TableCell>
            <TableCell>{row.email}</TableCell>
            <TableCell className="capitalize">{row.role}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
