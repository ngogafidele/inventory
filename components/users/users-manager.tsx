"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatInKigali } from "@/lib/utils/time"

type StoreKey = "store1" | "store2"
type UserRole = "admin" | "manager" | "staff"

type UserClient = {
  _id: string
  name: string
  email: string
  role: UserRole
  stores: StoreKey[]
  isActive: boolean
  isAdmin: boolean
  createdAt?: string
  updatedAt?: string
}

type LoginLogClient = {
  _id: string
  userId: string
  name: string
  email: string
  role: UserRole
  loginAt?: string
  logoutAt?: string
}

export type UsersManagerProps = {
  initialUsers: UserClient[]
  loginLogs: LoginLogClient[]
  currentUserId: string
}

type FormState = {
  name: string
  email: string
  password: string
  role: "manager" | "staff"
  stores: StoreKey[]
  isActive: boolean
}

const emptyForm: FormState = {
  name: "",
  email: "",
  password: "",
  role: "staff",
  stores: ["store1"],
  isActive: true,
}

function formatActivityDate(date: string | Date | undefined) {
  if (!date) return "Never"

  return formatInKigali(date, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  })
}

export function UsersManager({
  initialUsers,
  loginLogs,
  currentUserId,
}: UsersManagerProps) {
  const [users, setUsers] = useState(initialUsers)
  const [formState, setFormState] = useState<FormState>(emptyForm)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetForm = () => {
    setFormState(emptyForm)
    setError(null)
  }

  const toggleStore = (store: "store1" | "store2") => {
    setFormState((prev) => {
      if (prev.stores.includes(store)) {
        return { ...prev, stores: prev.stores.filter((s) => s !== store) }
      }
      return { ...prev, stores: [...prev.stores, store] }
    })
  }

  const submitForm = async () => {
    if (!formState.name.trim() || !formState.email.trim()) {
      setError("Please provide name and email.")
      return
    }

    if (formState.password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }

    if (formState.stores.length === 0) {
      setError("Select at least one store.")
      return
    }

    setSubmitting(true)
    setError(null)

    const payload = {
      name: formState.name.trim(),
      email: formState.email.trim(),
      password: formState.password,
      role: formState.role,
      stores: formState.stores,
      isActive: formState.isActive,
    }

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const body = await response.json()
      if (!response.ok || !body?.success) {
        setError(body?.error ?? "Failed to create user.")
        return
      }

      const created = body.data as {
        id: string
        name: string
        email: string
        role: "manager" | "staff"
        stores: StoreKey[]
        isActive: boolean
        isAdmin?: boolean
      }

      setUsers((current) => [
        {
          _id: created.id,
          name: created.name,
          email: created.email,
          role: created.role,
          stores: created.stores,
          isActive: created.isActive,
          isAdmin: created.isAdmin ?? false,
        },
        ...current,
      ])

      setDialogOpen(false)
      resetForm()
    } catch (err) {
      setError("Failed to create user.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (userId: string) => {
    if (!confirm("Delete this user?")) {
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
      })
      const body = await response.json()
      if (!response.ok || !body?.success) {
        setError(body?.error ?? "Failed to delete user.")
        return
      }

      setUsers((current) => current.filter((user) => user._id !== userId))
    } catch (err) {
      setError("Failed to delete user.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Access Control
          </p>
          <h2 className="text-2xl font-semibold">Users</h2>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>Add User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add user</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              <label className="grid gap-1 text-sm">
                Name
                <Input
                  value={formState.name}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="grid gap-1 text-sm">
                Email
                <Input
                  type="email"
                  value={formState.email}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      email: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="grid gap-1 text-sm">
                Password
                <Input
                  type="password"
                  value={formState.password}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      password: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="grid gap-1 text-sm">
                Role
                <Select
                  value={formState.role}
                  onValueChange={(value) =>
                    setFormState((prev) => ({
                      ...prev,
                      role: value as "manager" | "staff",
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <div className="grid gap-2 text-sm">
                Stores
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formState.stores.includes("store1")}
                    onChange={() => toggleStore("store1")}
                  />
                  Store 1
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formState.stores.includes("store2")}
                    onChange={() => toggleStore("store2")}
                  />
                  Store 2
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formState.isActive}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      isActive: event.target.checked,
                    }))
                  }
                />
                Active
              </label>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={submitForm} disabled={submitting}>
                {submitting ? "Saving..." : "Create user"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Stores</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user._id}>
              <TableCell>{user.name}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell className="capitalize">{user.role}</TableCell>
              <TableCell>{user.stores.join(", ")}</TableCell>
              <TableCell>{user.isActive ? "Active" : "Inactive"}</TableCell>
              <TableCell className="text-right">
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(user._id)}
                    disabled={submitting || user.isAdmin || user._id === currentUserId}
                  >
                    Delete
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <section className="space-y-3 pt-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Activity
          </p>
          <h3 className="text-xl font-semibold">Logs</h3>
          <p className="text-sm text-muted-foreground">
            20 most recent logins.
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Logged In</TableHead>
              <TableHead>Logged Out</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loginLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  No login logs yet.
                </TableCell>
              </TableRow>
            ) : (
              loginLogs.map((log) => (
                <TableRow key={log._id}>
                  <TableCell>{log.name}</TableCell>
                  <TableCell>{log.email}</TableCell>
                  <TableCell className="capitalize">{log.role}</TableCell>
                  <TableCell>{formatActivityDate(log.loginAt)}</TableCell>
                  <TableCell>
                    {log.logoutAt ? formatActivityDate(log.logoutAt) : "Still logged in"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  )
}
