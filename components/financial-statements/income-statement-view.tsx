"use client"

// Presents the income statement for a chosen date range.
import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatCurrency } from "@/lib/utils/format"
import { formatKigaliDateInput } from "@/lib/utils/time"
import { cn } from "@/lib/utils"

type IncomeStatement = {
  revenue: number
  costOfGoodsSold: number
  grossProfit: number
  operatingExpenses: number
  netProfit: number
}

type Preset = "this-month" | "last-month" | "this-year"

function presetRange(preset: Preset) {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()

  if (preset === "this-year") {
    return {
      start: formatKigaliDateInput(new Date(year, 0, 1)),
      end: formatKigaliDateInput(today),
    }
  }

  if (preset === "last-month") {
    return {
      start: formatKigaliDateInput(new Date(year, month - 1, 1)),
      end: formatKigaliDateInput(new Date(year, month, 0)),
    }
  }

  return {
    start: formatKigaliDateInput(new Date(year, month, 1)),
    end: formatKigaliDateInput(today),
  }
}

type Row = {
  label: string
  value: number
  kind: "line" | "subtotal" | "total"
  hint?: string
}

type FetchResult =
  | { statement: IncomeStatement; range: { from: string; to: string } }
  | { error: string }

async function fetchIncomeStatement(
  from: string,
  to: string
): Promise<FetchResult> {
  try {
    const params = new URLSearchParams({ start: from, end: to })
    const response = await fetch(
      `/api/financial-statements/income-statement?${params.toString()}`
    )
    const body = await response.json().catch(() => null)

    if (!response.ok || !body?.success) {
      return { error: body?.error ?? "Failed to load the income statement." }
    }

    return { statement: body.data.statement, range: body.data.range }
  } catch {
    return { error: "Failed to load the income statement." }
  }
}

export function IncomeStatementView() {
  const [initial] = useState(() => presetRange("this-month"))
  const [start, setStart] = useState(initial.start)
  const [end, setEnd] = useState(initial.end)
  const [statement, setStatement] = useState<IncomeStatement | null>(null)
  const [range, setRange] = useState<{ from: string; to: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const apply = useCallback((result: FetchResult) => {
    if ("error" in result) {
      setError(result.error)
      setStatement(null)
    } else {
      setError(null)
      setStatement(result.statement)
      setRange(result.range)
    }
    setLoading(false)
  }, [])

  const load = useCallback(
    async (from: string, to: string) => {
      setLoading(true)
      setError(null)
      apply(await fetchIncomeStatement(from, to))
    },
    [apply]
  )

  // The effect only starts the request; every state update happens after the
  // await, so no render is triggered synchronously from the effect body.
  useEffect(() => {
    let cancelled = false
    void fetchIncomeStatement(initial.start, initial.end).then((result) => {
      if (!cancelled) apply(result)
    })
    return () => {
      cancelled = true
    }
  }, [initial.start, initial.end, apply])

  const applyPreset = (preset: Preset) => {
    const next = presetRange(preset)
    setStart(next.start)
    setEnd(next.end)
    void load(next.start, next.end)
  }

  const rows: Row[] = statement
    ? [
        { label: "Revenue", value: statement.revenue, kind: "line", hint: "Net of returns" },
        {
          label: "Cost of Goods Sold",
          value: -statement.costOfGoodsSold,
          kind: "line",
        },
        { label: "Gross Profit", value: statement.grossProfit, kind: "subtotal" },
        {
          label: "Operating Expenses",
          value: -statement.operatingExpenses,
          kind: "line",
        },
        { label: "Net Profit", value: statement.netProfit, kind: "total" },
      ]
    : []

  const margin =
    statement && statement.revenue !== 0
      ? (statement.netProfit / statement.revenue) * 100
      : null

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-2xl border border-border/80 bg-card p-4 shadow-sm md:grid-cols-[1fr_1fr_auto]">
        <label className="space-y-1 text-sm font-medium text-foreground">
          From
          <Input
            type="date"
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm font-medium text-foreground">
          To
          <Input
            type="date"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
          />
        </label>
        <div className="flex items-end">
          <Button
            type="button"
            className="w-full md:w-auto"
            onClick={() => void load(start, end)}
            disabled={loading}
          >
            {loading ? "Loading..." : "Apply"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["this-month", "This month"],
            ["last-month", "Last month"],
            ["this-year", "This year"],
          ] as Array<[Preset, string]>
        ).map(([preset, label]) => (
          <Button
            key={preset}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => applyPreset(preset)}
            disabled={loading}
          >
            {label}
          </Button>
        ))}
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <section className="space-y-3 rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-lg font-semibold">Income Statement</h3>
          {range ? (
            <p className="text-sm text-muted-foreground">
              {range.from} to {range.to}
            </p>
          ) : null}
        </div>

        {loading && !statement ? (
          <p className="py-6 text-sm text-muted-foreground">
            Loading the statement...
          </p>
        ) : !statement ? (
          <p className="py-6 text-sm text-muted-foreground">
            No statement to show.
          </p>
        ) : (
          <>
            <dl className="divide-y divide-border">
              {rows.map((row) => (
                <div
                  key={row.label}
                  className={cn(
                    "flex items-baseline justify-between gap-4 py-2.5",
                    row.kind === "total" && "border-t-2 border-border pt-3"
                  )}
                >
                  <dt
                    className={cn(
                      "text-sm",
                      row.kind === "line"
                        ? "text-muted-foreground"
                        : "font-semibold text-foreground",
                      row.kind === "total" && "text-base"
                    )}
                  >
                    {row.label}
                    {row.hint ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {row.hint}
                      </span>
                    ) : null}
                  </dt>
                  <dd
                    className={cn(
                      "shrink-0 text-right tabular-nums",
                      row.kind === "line"
                        ? "text-sm text-foreground"
                        : "font-semibold",
                      row.kind === "total" && "text-base",
                      row.kind === "total" &&
                        (row.value < 0 ? "text-destructive" : "text-foreground")
                    )}
                  >
                    {formatCurrency(row.value)}
                  </dd>
                </div>
              ))}
            </dl>

            {margin !== null ? (
              <p className="text-sm text-muted-foreground">
                Net margin {margin.toFixed(1)}% of revenue.
              </p>
            ) : null}
          </>
        )}
      </section>
    </div>
  )
}
