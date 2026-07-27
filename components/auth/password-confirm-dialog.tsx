"use client"

// Confirms a destructive action by re-checking the acting user's password.
// Replaces a plain yes/no confirmation, so the prompt cannot be dismissed by
// reflex the way a native confirm() can.
import { Eye, EyeOff, LockKeyhole } from "lucide-react"
import { type FormEvent, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type ConfirmProps = {
  title: string
  description: string
  confirmLabel: string
  pendingLabel: string
  pending: boolean
  // Restoring is gated the same way as deleting, but it is not destructive
  // and should not be dressed as though it were.
  confirmVariant?: React.ComponentProps<typeof Button>["variant"]
  error?: string | null
  onCancel: () => void
  onConfirm: (password: string) => void
}

// Lives inside DialogContent, which unmounts on close. That is what discards
// the typed password — no effect resetting state on the way out.
function ConfirmForm({
  title,
  description,
  confirmLabel,
  pendingLabel,
  pending,
  confirmVariant = "destructive",
  error,
  onCancel,
  onConfirm,
}: ConfirmProps) {
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onConfirm(password)
  }

  return (
    <form onSubmit={handleSubmit} autoComplete="off">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      {error ? (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <label className="mt-4 block space-y-2 text-sm font-medium text-foreground">
        Confirm your password to continue
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-11 pl-9 pr-11"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            name="inventory-action-passcode"
            disabled={pending}
            required
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center text-muted-foreground transition hover:text-foreground"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </div>
      </label>

      <DialogFooter className="mt-6">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant={confirmVariant}
          disabled={pending || password.length === 0}
        >
          {pending ? pendingLabel : confirmLabel}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function PasswordConfirmDialog({
  open,
  onOpenChange,
  ...props
}: Omit<ConfirmProps, "onCancel" | "pending"> & {
  open: boolean
  onOpenChange: (open: boolean) => void
  pending?: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <ConfirmForm
          {...props}
          pending={props.pending ?? false}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
