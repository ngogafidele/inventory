"use client"

// Hosts the income-statement and balance-sheet views behind a two-tab toggle.
import { useState } from "react"
import { FileText, Scale } from "lucide-react"
import { IncomeStatementView } from "@/components/financial-statements/income-statement-view"
import { BalanceSheetView } from "@/components/financial-statements/balance-sheet-view"
import { cn } from "@/lib/utils"

type StatementTab = "income-statement" | "balance-sheet"

const TABS: Array<{
  value: StatementTab
  label: string
  icon: typeof FileText
}> = [
  { value: "income-statement", label: "Income Statement", icon: FileText },
  { value: "balance-sheet", label: "Balance Sheet", icon: Scale },
]

export function FinancialStatementsManager() {
  const [tab, setTab] = useState<StatementTab>("income-statement")

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition",
              tab === value
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border/80 bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "income-statement" ? (
        <IncomeStatementView />
      ) : (
        <BalanceSheetView />
      )}
    </div>
  )
}
