import { connectToDatabase } from "@/lib/db/connection"
import { User } from "@/lib/db/models/User"
import { redirect } from "next/navigation"
import { requireServerSession } from "@/lib/auth/server"
import { UsersManager } from "@/components/users/users-manager"

export default async function UsersPage() {
  const session = await requireServerSession()
  if (!session.isAdmin) {
    redirect("/dashboard")
  }
  await connectToDatabase()

  const users = await User.find().select("-password").lean()
  const serializedUsers = users.map((user) => ({
    ...user,
    _id: user._id.toString(),
    createdAt: user.createdAt?.toISOString(),
    updatedAt: user.updatedAt?.toISOString(),
  }))

  return (
    <UsersManager
      initialUsers={serializedUsers}
      currentUserId={session.userId}
    />
  )
}
