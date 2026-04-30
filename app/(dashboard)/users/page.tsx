import { connectToDatabase } from "@/lib/db/connection"
import { User } from "@/lib/db/models/User"
import { UserLoginLog } from "@/lib/db/models/UserLoginLog"
import { redirect } from "next/navigation"
import { requireServerSession } from "@/lib/auth/server"
import { UsersManager } from "@/components/users/users-manager"

export default async function UsersPage() {
  const session = await requireServerSession()
  if (!session.isAdmin) {
    redirect("/dashboard")
  }
  await connectToDatabase()

  const [users, loginLogs] = await Promise.all([
    User.find().select("-password").lean(),
    UserLoginLog.find().sort({ loginAt: -1 }).limit(20).lean(),
  ])
  const serializedUsers = users.map((user) => ({
    _id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    stores: user.stores,
    isActive: user.isActive,
    isAdmin: user.isAdmin,
    createdAt: user.createdAt?.toISOString(),
    updatedAt: user.updatedAt?.toISOString(),
  }))
  const serializedLoginLogs = loginLogs.map((log) => ({
    _id: log._id.toString(),
    userId: log.userId.toString(),
    name: log.name,
    email: log.email,
    role: log.role,
    loginAt: log.loginAt?.toISOString(),
    logoutAt: log.logoutAt?.toISOString(),
  }))

  return (
    <UsersManager
      initialUsers={serializedUsers}
      loginLogs={serializedLoginLogs}
      currentUserId={session.userId}
    />
  )
}
