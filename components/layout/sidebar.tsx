"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { AuthSession } from "@/lib/auth/session"
import {
  Bell,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  PackageSearch,
  ReceiptText,
  Users,
  Wrench,
} from "lucide-react"
import { cn } from "@/lib/utils"

const adminOnlyNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/users", label: "Users", icon: Users },
  { href: "/stock-adjustments", label: "Stock Adjustments", icon: Wrench },
]

const commonNavItems = [
  { href: "/products", label: "Products", icon: PackageSearch },
  { href: "/categories", label: "Categories", icon: Boxes },
  { href: "/sales", label: "Sales", icon: ReceiptText },
  { href: "/invoices", label: "Invoices", icon: ClipboardList },
  { href: "/alerts", label: "Low Stock Alerts", icon: Bell },
]

export function Sidebar({ session }: { session: AuthSession }) {
  const pathname = usePathname()
  const navItems = session.isAdmin
    ? [...adminOnlyNavItems, ...commonNavItems]
    : commonNavItems

  return (
    <aside className="w-full shrink-0 rounded-2xl border border-sidebar-border bg-sidebar/90 p-3 backdrop-blur-sm md:sticky md:top-6 md:h-fit md:w-64">
      <div className="mb-4 border-b border-sidebar-border px-2 pb-3">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Inventory Suite
        </p>
        <h2 className="text-lg font-semibold text-foreground">Control Center</h2>
      </div>
      <nav className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:flex md:flex-col">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition",
              pathname === item.href
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <item.icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
