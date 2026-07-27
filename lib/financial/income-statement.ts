// Computes the income statement from sales, returns, and expenses.
//
// Formula parity: this replicates the exact revenue/COGS/profit math used by the
// Reports page (app/(dashboard)/reports/page.tsx):
//   - Revenue is net of returns (returns are contra-revenue).
//   - Gross profit nets returned-goods cost out of COGS (returns reduce COGS too).
//   - COGS is derived as Revenue - Gross Profit.
//   - Sales are dated by createdAt and exclude soft-deleted records.
//   - Returns are dated by saleDate falling back to createdAt, matching Reports.
//   - Expenses are dated by their own `date` field.
// If the Reports formula ever changes, update this module in lockstep.
//
// Source of record: these statements read LIVE sales and returns. A correction to
// an old record therefore also changes the statement for that past period. If
// issued statements ever need to stay fixed, the change belongs behind these two
// helpers — swap them for a snapshot ledger and the callers stay untouched.
import { Expense } from "@/lib/db/models/Expense"
import { ReturnModel } from "@/lib/db/models/Return"
import { Sale } from "@/lib/db/models/Sale"
import type { StoreKey } from "@/lib/auth/session"

export type IncomeStatement = {
  revenue: number
  costOfGoodsSold: number
  grossProfit: number
  operatingExpenses: number
  netProfit: number
}

export type IncomeStatementPeriod = {
  // Omit `from` for a cumulative statement (e.g. retained earnings to a year end).
  from?: Date
  endExclusive: Date
}

export type FinancialTotals = { revenue: number; grossProfit: number }

type TotalsAgg = { revenue: number; grossProfit: number }
type ExpenseAgg = { expenses: number }

function dateFilter(from: Date | undefined, endExclusive: Date) {
  return from ? { $gte: from, $lt: endExclusive } : { $lt: endExclusive }
}

export async function computeSaleTotals(
  store: StoreKey,
  from: Date | undefined,
  endExclusive: Date
): Promise<FinancialTotals> {
  const rows = await Sale.aggregate<TotalsAgg>([
    {
      $match: {
        store,
        deletedAt: null,
        createdAt: dateFilter(from, endExclusive),
      },
    },
    { $unwind: { path: "$items", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: null,
        revenue: { $sum: "$items.lineTotal" },
        grossProfit: {
          $sum: {
            $subtract: [
              "$items.lineTotal",
              { $multiply: ["$items.basePrice", "$items.quantity"] },
            ],
          },
        },
      },
    },
  ])

  return {
    revenue: rows[0]?.revenue ?? 0,
    grossProfit: rows[0]?.grossProfit ?? 0,
  }
}

export async function computeReturnTotals(
  store: StoreKey,
  from: Date | undefined,
  endExclusive: Date
): Promise<FinancialTotals> {
  const rows = await ReturnModel.aggregate<TotalsAgg>([
    { $match: { store } },
    { $addFields: { effectiveDate: { $ifNull: ["$saleDate", "$createdAt"] } } },
    { $match: { effectiveDate: dateFilter(from, endExclusive) } },
    { $unwind: "$returnItems" },
    // Older return lines may predate stored basePrice; fall back to the
    // product's current cost exactly as the Reports page does.
    {
      $lookup: {
        from: "products",
        localField: "returnItems.productId",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: null,
        revenue: { $sum: "$returnItems.lineTotal" },
        grossProfit: {
          $sum: {
            $subtract: [
              "$returnItems.lineTotal",
              {
                $multiply: [
                  {
                    $ifNull: [
                      "$returnItems.basePrice",
                      { $ifNull: ["$product.costPrice", 0] },
                    ],
                  },
                  "$returnItems.quantity",
                ],
              },
            ],
          },
        },
      },
    },
  ])

  return {
    revenue: rows[0]?.revenue ?? 0,
    grossProfit: rows[0]?.grossProfit ?? 0,
  }
}

export async function computeIncomeStatement(
  store: StoreKey,
  { from, endExclusive }: IncomeStatementPeriod
): Promise<IncomeStatement> {
  const [saleTotals, returnTotals, expenseTotals] = await Promise.all([
    computeSaleTotals(store, from, endExclusive),
    computeReturnTotals(store, from, endExclusive),
    Expense.aggregate<ExpenseAgg>([
      { $match: { store, date: dateFilter(from, endExclusive) } },
      { $group: { _id: null, expenses: { $sum: "$amount" } } },
    ]),
  ])

  const revenue = saleTotals.revenue - returnTotals.revenue
  const grossProfit = saleTotals.grossProfit - returnTotals.grossProfit
  const costOfGoodsSold = revenue - grossProfit
  const operatingExpenses = expenseTotals[0]?.expenses ?? 0
  const netProfit = grossProfit - operatingExpenses

  return {
    revenue,
    costOfGoodsSold,
    grossProfit,
    operatingExpenses,
    netProfit,
  }
}
