"use client"

// Displays due and overdue loan alerts in the authenticated header.
import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { AlertTriangle, Bell, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils/format"
import type { LoanNotification } from "@/types/loan-notification"

export function LoanNotifications() {
  const [notifications, setNotifications] = useState<LoanNotification[]>([])
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let isMounted = true

    const fetchNotifications = async () => {
      try {
        const response = await fetch("/api/loans/notifications", {
          cache: "no-store",
        })
        const body = await response.json().catch(() => null)

        if (isMounted && response.ok && body?.success) {
          setNotifications(body.data ?? [])
        }
      } catch {
        if (isMounted) {
          setNotifications([])
        }
      }
    }

    fetchNotifications()
    window.addEventListener("loan-notifications:refresh", fetchNotifications)

    return () => {
      isMounted = false
      window.removeEventListener("loan-notifications:refresh", fetchNotifications)
    }
  }, [])

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
    }
  }, [open])

  const counts = useMemo(
    () =>
      notifications.reduce(
        (total, notification) => ({
          due: total.due + (notification.status === "due" ? 1 : 0),
          overdue: total.overdue + (notification.status === "overdue" ? 1 : 0),
        }),
        { due: 0, overdue: 0 }
      ),
    [notifications]
  )

  const totalCount = notifications.length
  const visibleNotifications = notifications.slice(0, 8)

  return (
    <div ref={rootRef} className="relative">
      <Button
        type="button"
        variant="outline"
        size="icon-lg"
        className="relative bg-background"
        aria-label={`${totalCount} loan notifications`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Bell className="size-4" />
        {totalCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[0.65rem] font-bold leading-5 text-white">
            {totalCount > 99 ? "99+" : totalCount}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div className="absolute left-0 top-11 z-40 w-[min(calc(100vw-1.5rem),24rem)] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl md:left-auto md:right-0">
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Loan notifications</p>
                <p className="text-xs text-muted-foreground">
                  {counts.overdue} overdue, {counts.due} due today
                </p>
              </div>
              <Link
                href="/outstanding"
                className="text-xs font-semibold text-primary hover:underline"
                onClick={() => setOpen(false)}
              >
                View all
              </Link>
            </div>
          </div>

          {totalCount === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">
              No due or overdue loans.
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {visibleNotifications.map((notification) => {
                const isOverdue = notification.status === "overdue"
                const Icon = isOverdue ? AlertTriangle : Clock

                return (
                  <Link
                    key={notification.id}
                    href="/outstanding"
                    className="flex gap-3 border-b border-border/70 px-4 py-3 text-sm transition last:border-b-0 hover:bg-muted/60"
                    onClick={() => setOpen(false)}
                  >
                    <span
                      className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${
                        isOverdue
                          ? "bg-destructive/10 text-destructive"
                          : "bg-amber-500/10 text-amber-700"
                      }`}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold">
                          {notification.customerName}
                        </span>
                        <span
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold ${
                            isOverdue
                              ? "border-destructive/30 bg-destructive/10 text-destructive"
                              : "border-amber-500/30 bg-amber-500/10 text-amber-700"
                          }`}
                        >
                          {isOverdue ? "Overdue" : "Due"}
                        </span>
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {notification.paymentDateLabel}
                        {notification.customerPhone
                          ? ` - ${notification.customerPhone}`
                          : ""}
                      </span>
                      <span className="mt-1 block text-xs font-semibold">
                        {formatCurrency(notification.amount)}
                      </span>
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
