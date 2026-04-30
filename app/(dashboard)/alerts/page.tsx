import { connectToDatabase } from "@/lib/db/connection"
import { Alert } from "@/lib/db/models/Alert"
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
  const alerts = await Alert.find({ store }).sort({ createdAt: -1 }).lean()

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Monitoring
        </p>
        <h2 className="text-2xl font-semibold">Alerts</h2>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Message</TableHead>
            <TableHead>Severity</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {alerts.map((alert) => (
            <TableRow key={alert._id.toString()}>
              <TableCell>{alert.type}</TableCell>
              <TableCell>{alert.message}</TableCell>
              <TableCell className="capitalize">{alert.severity}</TableCell>
              <TableCell>
                {alert.isResolved ? "Resolved" : "Open"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
