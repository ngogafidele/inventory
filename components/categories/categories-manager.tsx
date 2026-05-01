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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type CategoryClient = {
  _id: string
  name: string
  description: string
  createdAt?: string
  updatedAt?: string
}

export type CategoriesManagerProps = {
  initialCategories: CategoryClient[]
  isAdmin: boolean
}

type FormState = {
  name: string
  description: string
}

const emptyForm: FormState = {
  name: "",
  description: "",
}

export function CategoriesManager({
  initialCategories,
  isAdmin,
}: CategoriesManagerProps) {
  const [categories, setCategories] = useState(initialCategories)
  const [formState, setFormState] = useState<FormState>(emptyForm)
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetForm = () => {
    setFormState(emptyForm)
    setActiveCategoryId(null)
    setError(null)
  }

  const openCreate = () => {
    resetForm()
    setDialogOpen(true)
  }

  const openEdit = (category: CategoryClient) => {
    setFormState({
      name: category.name,
      description: category.description ?? "",
    })
    setActiveCategoryId(category._id)
    setError(null)
    setDialogOpen(true)
  }

  const submitForm = async () => {
    if (!formState.name.trim()) {
      setError("Please provide a name.")
      return
    }

    setSubmitting(true)
    setError(null)

    const payload = {
      name: formState.name.trim(),
      description: formState.description.trim() || undefined,
    }

    try {
      const response = await fetch(
        activeCategoryId
          ? `/api/categories/${activeCategoryId}`
          : "/api/categories",
        {
          method: activeCategoryId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      )

      const body = await response.json()
      if (!response.ok || !body?.success) {
        setError(body?.error ?? "Failed to save category.")
        return
      }

      const updated = body.data as CategoryClient

      setCategories((current) => {
        if (activeCategoryId) {
          return current.map((item) =>
            item._id === activeCategoryId ? updated : item
          )
        }
        return [updated, ...current]
      })

      setDialogOpen(false)
      resetForm()
    } catch (err) {
      setError("Failed to save category.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (categoryId: string) => {
    if (!confirm("Delete this category?")) {
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/categories/${categoryId}`, {
        method: "DELETE",
      })
      const body = await response.json()
      if (!response.ok || !body?.success) {
        setError(
          body?.error ??
            "Failed to delete category. Please remove products first."
        )
        return
      }

      setCategories((current) =>
        current.filter((category) => category._id !== categoryId)
      )
    } catch (err) {
      setError("Failed to delete category.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Organization
          </p>
          <h2 className="text-2xl font-semibold">Categories</h2>
        </div>
        {isAdmin ? (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>Add Category</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {activeCategoryId ? "Edit category" : "Add category"}
                </DialogTitle>
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
                  Description
                  <Input
                    value={formState.description}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        description: event.target.value,
                      }))
                    }
                  />
                </label>
                {error ? (
                  <p className="text-sm text-destructive">{error}</p>
                ) : null}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={submitForm} disabled={submitting}>
                  {submitting
                    ? "Saving..."
                    : activeCategoryId
                    ? "Save changes"
                    : "Create category"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            {isAdmin ? <TableHead className="text-right">Actions</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.map((category) => (
            <TableRow key={category._id.toString()}>
              <TableCell>{category.name}</TableCell>
              <TableCell>{category.description || "—"}</TableCell>
              {isAdmin ? (
                <TableCell className="text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(category)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(category._id)}
                      disabled={submitting}
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
