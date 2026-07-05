// Renders report charts from serialized branch report data.
"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { formatCurrency } from "@/lib/utils/format"

export type DailyTrendPoint = {
  date: string
  label: string
  revenue: number
  costOfSales: number
  profit: number
}

export type TopProductDatum = {
  sku: string
  name: string
  revenue: number
}

export type ProfitBridgeInput = {
  revenue: number
  costOfSales: number
  expenses: number
  profit: number
}

const SERIES = {
  revenue: { label: "Revenue", color: "var(--viz-revenue)" },
  costOfSales: { label: "Cost of Sales", color: "var(--viz-cost)" },
  profit: { label: "Profit", color: "var(--viz-profit)" },
} as const

const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 11 }

function compactCurrency(value: number) {
  return `${new Intl.NumberFormat("en-RW", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)} Rwf`
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
      {message}
    </div>
  )
}

function ChartLegend({
  items,
}: {
  items: Array<{ label: string; color: string }>
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((item) => (
        <span
          key={item.label}
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <span
            aria-hidden
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </span>
      ))}
    </div>
  )
}

type TooltipEntry = {
  name?: string | number
  value?: string | number
  color?: string
}

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string | number
}) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="min-w-44 rounded-lg border border-border bg-popover px-3 py-2 shadow-md">
      <p className="text-xs font-medium text-popover-foreground">{label}</p>
      <div className="mt-1 space-y-1">
        {payload.map((entry) => (
          <div
            key={String(entry.name)}
            className="flex items-center gap-2 text-xs"
          >
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="ml-auto font-medium tabular-nums text-popover-foreground">
              {formatCurrency(Number(entry.value ?? 0))}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function DailyTrendChart({ data }: { data: DailyTrendPoint[] }) {
  const hasActivity = data.some(
    (point) =>
      point.revenue !== 0 || point.costOfSales !== 0 || point.profit !== 0
  )
  if (!hasActivity) {
    return <EmptyChart message="No sales, returns, or expenses in this period." />
  }

  const hasNegative = data.some((point) => point.profit < 0)
  const showDots = data.length <= 31

  return (
    <div className="space-y-3">
      <ChartLegend
        items={[SERIES.revenue, SERIES.costOfSales, SERIES.profit]}
      />
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
            <CartesianGrid
              stroke="var(--border)"
              strokeWidth={1}
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              interval="preserveStartEnd"
              minTickGap={28}
            />
            <YAxis
              tick={AXIS_TICK}
              tickFormatter={compactCurrency}
              tickLine={false}
              axisLine={false}
              width={82}
            />
            <Tooltip
              content={<TrendTooltip />}
              cursor={{ stroke: "var(--border)" }}
            />
            {hasNegative ? (
              <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1} />
            ) : null}
            {(
              [
                ["revenue", SERIES.revenue],
                ["costOfSales", SERIES.costOfSales],
                ["profit", SERIES.profit],
              ] as const
            ).map(([key, series]) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                name={series.label}
                stroke={series.color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={
                  showDots
                    ? {
                        r: 4,
                        fill: series.color,
                        stroke: "var(--card)",
                        strokeWidth: 2,
                      }
                    : false
                }
                activeDot={{
                  r: 5,
                  fill: series.color,
                  stroke: "var(--card)",
                  strokeWidth: 2,
                }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function truncateLabel(value: string) {
  return value.length > 18 ? `${value.slice(0, 17)}…` : value
}

export function TopProductsChart({ data }: { data: TopProductDatum[] }) {
  if (data.length === 0) {
    return <EmptyChart message="No sales movement yet." />
  }

  // Row band per product plus the reserved x-axis band, so nothing scrolls or clips.
  const height = data.length * 42 + 16

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 72, bottom: 4, left: 4 }}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={132}
          tick={AXIS_TICK}
          tickFormatter={truncateLabel}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          content={<TrendTooltip />}
          cursor={{ fill: "var(--muted)" }}
        />
        <Bar
          dataKey="revenue"
          name="Revenue"
          fill="var(--viz-revenue)"
          barSize={18}
          radius={[0, 4, 4, 0]}
        >
          <LabelList
            dataKey="revenue"
            position="right"
            formatter={(value: number) => compactCurrency(value)}
            fill="var(--muted-foreground)"
            fontSize={11}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

type BridgeRow = {
  name: string
  offset: number
  size: number
  value: number
  color: string
}

function BridgeTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload?: BridgeRow }>
}) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-md">
      <p className="text-xs font-medium text-popover-foreground">{row.name}</p>
      <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
        {formatCurrency(row.value)}
      </p>
    </div>
  )
}

export function ProfitBridgeChart({ totals }: { totals: ProfitBridgeInput }) {
  if (
    totals.revenue === 0 &&
    totals.costOfSales === 0 &&
    totals.expenses === 0
  ) {
    return <EmptyChart message="No financial activity in this period." />
  }

  const steps = [
    { name: "Revenue", delta: totals.revenue, color: "var(--viz-revenue)" },
    {
      name: "Cost of Sales",
      delta: -totals.costOfSales,
      color: "var(--viz-cost)",
    },
    { name: "Expenses", delta: -totals.expenses, color: "var(--viz-cost)" },
  ]

  const rows: BridgeRow[] = []
  let running = 0
  for (const step of steps) {
    const end = running + step.delta
    rows.push({
      name: step.name,
      offset: Math.min(running, end),
      size: Math.abs(step.delta),
      value: step.delta,
      color: step.color,
    })
    running = end
  }
  rows.push({
    name: "Profit",
    offset: Math.min(0, totals.profit),
    size: Math.abs(totals.profit),
    value: totals.profit,
    color: totals.profit >= 0 ? "var(--viz-profit)" : "var(--viz-loss)",
  })

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 20, right: 8, bottom: 4, left: 4 }}>
          <XAxis
            dataKey="name"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
          />
          <YAxis
            tick={AXIS_TICK}
            tickFormatter={compactCurrency}
            tickLine={false}
            axisLine={false}
            width={82}
          />
          <Tooltip content={<BridgeTooltip />} cursor={{ fill: "var(--muted)" }} />
          <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1} />
          <Bar dataKey="offset" stackId="bridge" fill="transparent" isAnimationActive={false} />
          <Bar dataKey="size" stackId="bridge" barSize={24} radius={[4, 4, 0, 0]}>
            {rows.map((row) => (
              <Cell key={row.name} fill={row.color} />
            ))}
            <LabelList
              dataKey="value"
              position="top"
              formatter={(value: number) => compactCurrency(value)}
              fill="var(--muted-foreground)"
              fontSize={11}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
