export type UserRole = "admin" | "manager" | "staff"

export type User = {
  id: string
  name: string
  email: string
  role: UserRole
  stores: Array<"store1" | "store2">
  isActive: boolean
}
