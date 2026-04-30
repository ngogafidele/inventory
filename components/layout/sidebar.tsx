import Link from "next/link"

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/users", label: "Users" },
  { href: "/products", label: "Products" },
  { href: "/categories", label: "Categories" },
  { href: "/sales", label: "Sales" },
  { href: "/invoices", label: "Invoices" },
  { href: "/alerts", label: "Alerts" },
  { href: "/stock-adjustments", label: "Stock Adjustments" },
]

export function Sidebar() {
  return (
    <aside className="w-64 shrink-0 border-r border-border bg-sidebar px-4 py-6">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Inventory Suite
        </p>
        <h2 className="text-xl font-semibold text-foreground">Control Center</h2>
      </div>
      <nav className="flex flex-col gap-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
