"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, Bell, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils/format"

export type LoanNotification = {
  id: string
  customerName: string
  customerPhone?: string
  amount: number
  paymentDateLabel: string
  status: "due" | "overdue"
}

export function LoanNotifications({
  notifications,
}: {
  notifications: LoanNotification[]
}) {
  const [open, setOpen] = useState(false)

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
    <div className="relative">
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
        <div className="absolute right-0 top-11 z-40 w-[min(calc(100vw-1.5rem),24rem)] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl">
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
