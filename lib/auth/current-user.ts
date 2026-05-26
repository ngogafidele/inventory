// Resolves live user status and store access from a token-derived session.
import { connectToDatabase } from "@/lib/db/connection"
import { User } from "@/lib/db/models/User"
import mongoose from "mongoose"
import {
  isStoreKey,
  type AuthSession,
  type StoreKey,
} from "@/lib/auth/session"

type SessionUser = {
  _id: { toString(): string }
  name: string
  email: string
  isAdmin?: boolean
  isActive?: boolean
  role?: "admin" | "manager" | "staff"
  stores?: string[]
}

function getValidStores(stores: string[] | undefined): StoreKey[] {
  if (!Array.isArray(stores)) return []
  return stores.filter(isStoreKey)
}

export async function getCurrentUserSession(
  session: AuthSession
): Promise<AuthSession | null> {
  if (!mongoose.isValidObjectId(session.userId)) {
    return null
  }

  await connectToDatabase()

  const user = await User.findById(session.userId)
    .select("name email isAdmin isActive role stores")
    .lean<SessionUser | null>()

  if (!user || !user.isActive) {
    return null
  }

  const stores = getValidStores(user.stores)
  if (stores.length === 0) {
    return null
  }

  const currentStore =
    session.currentStore && stores.includes(session.currentStore)
      ? session.currentStore
      : stores[0]

  return {
    ...session,
    userId: user._id.toString(),
    name: user.name,
    email: user.email,
    isAdmin: user.isAdmin === true,
    role: user.role ?? "staff",
    stores,
    currentStore,
  }
}
