"use client"

// Recharts visualizations for the product stock-movement monitor.
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { formatInKigali } from "@/lib/utils/time"

const IN_COLOR = "var(--chart-1)"
const OUT_COLOR = "var(--chart-2)"

const axisTick = { fontSize: 11, fill: "var(--muted-foreground)" }

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--popover)",
  color: "var(--popover-foreground)",
  fontSize: 12,
}

function formatAxisDate(value: string, granularity: "day" | "month") {
  return formatInKigali(
    value,
    granularity === "month"
      ? { month: "short", year: "2-digit" }
      : { month: "short", day: "2-digit" }
  )
}

export type BalancePoint = { date: string; balance: number }

export function StockBalanceChart({
  data,
  granularity,
  unit,
}: {
  data: BalancePoint[]
  granularity: "day" | "month"
  unit: string
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
        <defs>
          <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={IN_COLOR} stopOpacity={0.35} />
            <stop offset="100%" stopColor={IN_COLOR} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={axisTick}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
          minTickGap={24}
          tickFormatter={(value: string) => formatAxisDate(value, granularity)}
        />
        <YAxis
          tick={axisTick}
          tickLine={false}
          axisLine={false}
          width={44}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={(value: string) =>
            formatInKigali(value, {
              year: "numeric",
              month: "short",
              day: "2-digit",
            })
          }
          formatter={(value: number) => [`${value} ${unit}`, "In stock"]}
        />
        <Area
          type="stepAfter"
          dataKey="balance"
          stroke={IN_COLOR}
          strokeWidth={2}
          fill="url(#balanceFill)"
          dot={false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export type BreakdownBar = {
  label: string
  quantity: number
  direction: "in" | "out"
}

export function StockBreakdownChart({
  data,
  unit,
}: {
  data: BreakdownBar[]
  unit: string
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={axisTick}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
          interval={0}
        />
        <YAxis
          tick={axisTick}
          tickLine={false}
          axisLine={false}
          width={44}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)" }}
          contentStyle={tooltipStyle}
          formatter={(value: number, _name, item) => [
            `${value} ${unit}`,
            item?.payload?.direction === "in" ? "Added" : "Removed",
          ]}
        />
        <Bar dataKey="quantity" radius={[6, 6, 0, 0]} maxBarSize={64}>
          {data.map((entry) => (
            <Cell
              key={entry.label}
              fill={entry.direction === "in" ? IN_COLOR : OUT_COLOR}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
