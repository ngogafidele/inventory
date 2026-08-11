// Computes the balance sheet as of a date: reconstructed auto lines plus manual items.
//
// Auto lines are reconstructed to the as-of date (no stored point-in-time balance
// exists):
//   - Cash & Bank: derived from recorded money flows — see lib/financial/cash-position.
//   - Inventory Value: each product's quantity is rewound from its current level by
//     removing stock movements dated after the as-of date (receipts, sales, returns,
//     replacements, adjustments), matching the reconstruction in
//     app/api/products/[id]/movements. On-hand units are valued at the weighted-average
//     purchase cost of receipts on/before the date, falling back to the latest sale
//     cost, then the product's current costPrice.
//   - Accounts Receivable: outstanding loan balances rewound from dated payments.
//   - Equity: Retained Earnings (net profit through the prior year-end) plus Current
//     Year Earnings (net profit for the as-of year to date), both via the income
//     statement formula.
//
// These read live records, so a later correction to an old sale also moves the
// figures for a past as-of date. See lib/financial/income-statement for the note on
// swapping in an immutable ledger if that ever needs to stop.
import { Product } from "@/lib/db/models/Product"
import { ProductReceipt } from "@/lib/db/models/ProductReceipt"
import { ReturnModel } from "@/lib/db/models/Return"
import { Sale } from "@/lib/db/models/Sale"
import { StockAdjustment } from "@/lib/db/models/StockAdjustment"
import {
  BalanceSheetItem,
  type BalanceSheetCategory,
} from "@/lib/db/models/BalanceSheetItem"
import type { StoreKey } from "@/lib/auth/session"
import { computeIncomeStatement } from "@/lib/financial/income-statement"
import { computeCashPosition } from "@/lib/financial/cash-position"
import { parseKigaliDateInput } from "@/lib/utils/time"

export type BalanceSheetLine = {
  label: string
  amount: number
  source: "auto" | "manual"
  id?: string
  note?: string
}

export type BalanceSheet = {
  asOf: string
  assets: {
    current: BalanceSheetLine[]
    fixed: BalanceSheetLine[]
    total: number
  }
  liabilities: {
    current: BalanceSheetLine[]
    longTerm: BalanceSheetLine[]
    total: number
  }
  equity: { lines: BalanceSheetLine[]; total: number }
  totalAssets: number
  totalLiabilitiesAndEquity: number
  // Positive => assets exceed liabilities + equity; shown plainly rather than
  // forced to zero, so a gap is visible instead of hidden.
  balanceDifference: number
  // Product names whose reconstructed as-of quantity went negative — a sign the
  // movement history is inconsistent; those are excluded from the valuation.
  inventoryWarnings: string[]
}

export type ManualLinesByCategory = Record<
  BalanceSheetCategory,
  BalanceSheetLine[]
>

export type ResolvedManualItem = {
  groupId: string
  category: BalanceSheetCategory
  name: string
  amount: number
  effectiveDate: string
  notes: string
}

function emptyManual(): ManualLinesByCategory {
  return {
    current_asset: [],
    fixed_asset: [],
    current_liability: [],
    long_term_liability: [],
    equity: [],
  }
}

type ManualVersionRow = {
  category: BalanceSheetCategory
  name: string
  amount: number
  effectiveDate: Date
  status: "active" | "deleted"
  notes?: string
}

// Resolves each item group to the latest version effective on/before the cutoff,
// dropping any group whose latest effective version is a delete tombstone.
export async function resolveManualItems(
  store: StoreKey,
  endExclusive: Date
): Promise<ResolvedManualItem[]> {
  const rows = await BalanceSheetItem.aggregate<{
    _id: unknown
    doc: ManualVersionRow
  }>([
    { $match: { store, effectiveDate: { $lt: endExclusive } } },
    { $sort: { effectiveDate: 1, createdAt: 1 } },
    { $group: { _id: "$groupId", doc: { $last: "$$ROOT" } } },
    { $match: { "doc.status": "active" } },
  ])

  return rows.map((row) => ({
    groupId: String(row._id),
    category: row.doc.category,
    name: row.doc.name,
    amount: row.doc.amount,
    effectiveDate: new Date(row.doc.effectiveDate).toISOString().slice(0, 10),
    notes: row.doc.notes ?? "",
  }))
}

export function manualItemsToLines(
  items: ResolvedManualItem[]
): ManualLinesByCategory {
  const grouped = emptyManual()
  for (const item of items) {
    grouped[item.category].push({
      label: item.name,
      amount: item.amount,
      source: "manual",
      id: item.groupId,
      note: item.notes || undefined,
    })
  }
  return grouped
}

type ProductRow = {
  _id: unknown
  name: string
  quantity: number
  costPrice: number
}
type IdQtyAgg = { _id: unknown; qty: number }
type IdWacAgg = { _id: unknown; totalQty: number; totalCost: number }

function keyOf(id: unknown) {
  return String(id)
}

type InventoryValuation = {
  total: number
  negativeStockProducts: string[]
}

// Reconstructs total inventory value at the cutoff. Movements dated on/after
// endExclusive happened "after" the snapshot and are rewound out of the current
// quantity. Stock movements are dated by when stock actually moved — createdAt for
// sales, returns and adjustments, receivedAt for receipts — matching the movements
// endpoint rather than the income statement's saleDate.
async function computeInventoryValue(
  store: StoreKey,
  endExclusive: Date
): Promise<InventoryValuation> {
  const [
    products,
    receiptsAfter,
    salesOutAfter,
    returnFlowsAfter,
    adjustmentsAfter,
    receiptWac,
    saleCosts,
  ] = await Promise.all([
    Product.find({ store })
      .select("_id name quantity costPrice")
      .lean<ProductRow[]>(),
    // Receipts after the date came IN after the snapshot -> subtract.
    ProductReceipt.aggregate<IdQtyAgg>([
      { $match: { store, receivedAt: { $gte: endExclusive } } },
      { $group: { _id: "$productId", qty: { $sum: "$quantity" } } },
    ]),
    // Sales after the date went OUT after the snapshot -> add back.
    Sale.aggregate<IdQtyAgg>([
      { $match: { store, deletedAt: null, createdAt: { $gte: endExclusive } } },
      { $unwind: "$items" },
      { $group: { _id: "$items.productId", qty: { $sum: "$items.quantity" } } },
    ]),
    // Returns after the date: returned goods came IN -> subtract; replacements
    // issued went OUT -> add back.
    ReturnModel.aggregate<{ _id: unknown; returnedIn: number; replacedOut: number }>(
      [
        { $match: { store, createdAt: { $gte: endExclusive } } },
        {
          $project: {
            flows: {
              $concatArrays: [
                {
                  $map: {
                    input: { $ifNull: ["$returnItems", []] },
                    as: "item",
                    in: {
                      productId: "$$item.productId",
                      returnedIn: "$$item.quantity",
                      replacedOut: 0,
                    },
                  },
                },
                {
                  $map: {
                    input: { $ifNull: ["$replacementItems", []] },
                    as: "item",
                    in: {
                      productId: "$$item.productId",
                      returnedIn: 0,
                      replacedOut: "$$item.quantity",
                    },
                  },
                },
              ],
            },
          },
        },
        { $unwind: "$flows" },
        {
          $group: {
            _id: "$flows.productId",
            returnedIn: { $sum: "$flows.returnedIn" },
            replacedOut: { $sum: "$flows.replacedOut" },
          },
        },
      ]
    ),
    // Adjustments after the date (signed) -> subtract their net change.
    StockAdjustment.aggregate<IdQtyAgg>([
      { $match: { store, createdAt: { $gte: endExclusive } } },
      { $group: { _id: "$productId", qty: { $sum: "$quantityChange" } } },
    ]),
    // Weighted-average purchase cost across all receipts on/before the date.
    ProductReceipt.aggregate<IdWacAgg>([
      { $match: { store, receivedAt: { $lt: endExclusive } } },
      {
        $group: {
          _id: "$productId",
          totalQty: { $sum: "$quantity" },
          totalCost: { $sum: { $multiply: ["$unitCost", "$quantity"] } },
        },
      },
    ]),
    // Latest cost actually charged on a sale on/before the date.
    Sale.aggregate<{ _id: unknown; basePrice: number }>([
      { $match: { store, deletedAt: null, createdAt: { $lt: endExclusive } } },
      { $sort: { createdAt: 1 } },
      { $unwind: "$items" },
      { $group: { _id: "$items.productId", basePrice: { $last: "$items.basePrice" } } },
    ]),
  ])

  const receiptsAfterMap = new Map(
    receiptsAfter.map((row) => [keyOf(row._id), row.qty])
  )
  const salesOutMap = new Map(salesOutAfter.map((row) => [keyOf(row._id), row.qty]))
  const returnsInMap = new Map(
    returnFlowsAfter.map((row) => [keyOf(row._id), row.returnedIn])
  )
  const replacementsOutMap = new Map(
    returnFlowsAfter.map((row) => [keyOf(row._id), row.replacedOut])
  )
  const adjustmentsMap = new Map(
    adjustmentsAfter.map((row) => [keyOf(row._id), row.qty])
  )
  const receiptCostMap = new Map(
    receiptWac
      .filter((row) => row.totalQty > 0)
      .map((row) => [keyOf(row._id), row.totalCost / row.totalQty])
  )
  const saleCostMap = new Map(
    saleCosts.map((row) => [keyOf(row._id), row.basePrice])
  )

  let total = 0
  const negativeStockProducts: string[] = []
  for (const product of products) {
    const id = keyOf(product._id)
    const inAfter =
      (receiptsAfterMap.get(id) ?? 0) + (returnsInMap.get(id) ?? 0)
    const outAfter =
      (salesOutMap.get(id) ?? 0) + (replacementsOutMap.get(id) ?? 0)
    const netAfter = inAfter - outAfter + (adjustmentsMap.get(id) ?? 0)
    const quantityAtDate = product.quantity - netAfter

    if (quantityAtDate < 0) {
      // Inconsistent movement history — surface it instead of silently skipping.
      negativeStockProducts.push(product.name)
      continue
    }
    if (quantityAtDate === 0) continue

    const unitCost =
      receiptCostMap.get(id) ?? saleCostMap.get(id) ?? product.costPrice ?? 0
    total += quantityAtDate * unitCost
  }

  return { total, negativeStockProducts }
}

// Sums outstanding loan balances as of the date.
//
// A sale counts as a receivable when it is still an open loan (`outstanding`
// present) or has recorded at least one dated instalment — the balance is rewound
// from those dated payments, so a loan collected after the as-of date still shows
// its historical balance. Every settlement path records a dated payment, so new
// settlements reconstruct correctly. Known gap: a loan settled before instalments
// were recorded carries no dated payment and is omitted for as-of dates preceding
// its (unknown) settlement.
async function computeAccountsReceivable(
  store: StoreKey,
  endExclusive: Date
): Promise<number> {
  const rows = await Sale.aggregate<{ total: number }>([
    { $match: { store, deletedAt: null, createdAt: { $lt: endExclusive } } },
    { $addFields: { paymentsAll: { $ifNull: ["$payments", []] } } },
    {
      $match: {
        $or: [
          { wasLoan: true },
          { paymentStatus: "unpaid" },
          { outstanding: { $ne: null, $exists: true } },
          { "paymentsAll.0": { $exists: true } },
        ],
      },
    },
    {
      $addFields: {
        collectedBefore: {
          $sum: {
            $map: {
              input: {
                $filter: {
                  input: "$paymentsAll",
                  as: "payment",
                  cond: { $lt: ["$$payment.paidAt", endExclusive] },
                },
              },
              as: "payment",
              in: "$$payment.amount",
            },
          },
        },
      },
    },
    {
      $lookup: {
        from: "returns",
        let: { saleId: "$_id" },
        pipeline: [
          {
            $match: {
              store,
              createdAt: { $lt: endExclusive },
              $expr: { $eq: ["$saleId", "$$saleId"] },
            },
          },
          {
            $group: {
              _id: null,
              total: {
                $sum: {
                  $max: [
                    0,
                    {
                      $subtract: [
                        { $ifNull: ["$totalReturnAmount", 0] },
                        { $ifNull: ["$totalReplacementAmount", 0] },
                      ],
                    },
                  ],
                },
              },
            },
          },
        ],
        as: "returnCreditRows",
      },
    },
    {
      $addFields: {
        returnCreditBefore: {
          $ifNull: [{ $first: "$returnCreditRows.total" }, 0],
        },
      },
    },
    {
      $group: {
        _id: null,
        total: {
          $sum: {
            $max: [
              0,
              {
                $subtract: [
                  "$totalAmount",
                  { $add: ["$collectedBefore", "$returnCreditBefore"] },
                ],
              },
            ],
          },
        },
      },
    },
  ])

  return rows[0]?.total ?? 0
}

function sumLines(lines: BalanceSheetLine[]) {
  return lines.reduce((total, line) => total + line.amount, 0)
}

export type BalanceSheetInput = {
  asOf: Date
  endExclusive: Date
  asOfInput: string
  // Optional override; when omitted, manual items resolve from the versioned history.
  manual?: ManualLinesByCategory
}

export async function computeBalanceSheet(
  store: StoreKey,
  { endExclusive, asOfInput, manual }: BalanceSheetInput
): Promise<BalanceSheet> {
  // Fiscal year = calendar year in business time; split equity into prior-year
  // retained earnings and current-year earnings at the year boundary.
  const asOfYear = Number(asOfInput.slice(0, 4))
  const yearStart = Number.isFinite(asOfYear)
    ? parseKigaliDateInput(`${asOfInput.slice(0, 4)}-01-01`)
    : null

  const [
    inventory,
    accountsReceivable,
    cashPosition,
    retainedIncome,
    currentYearIncome,
    resolvedManual,
  ] = await Promise.all([
    computeInventoryValue(store, endExclusive),
    computeAccountsReceivable(store, endExclusive),
    computeCashPosition(store, endExclusive),
    // Net profit through the prior year-end (cumulative when the split is absent).
    computeIncomeStatement(store, { endExclusive: yearStart ?? endExclusive }),
    // Net profit for the as-of year to date (null yearStart folds into retained).
    yearStart
      ? computeIncomeStatement(store, { from: yearStart, endExclusive })
      : Promise.resolve(null),
    manual
      ? Promise.resolve(manual)
      : resolveManualItems(store, endExclusive).then(manualItemsToLines),
  ])

  const currentAssets: BalanceSheetLine[] = [
    {
      label: "Cash & Bank",
      amount: cashPosition,
      source: "auto",
      note: "Collections minus purchases, expenses, and refunds; record owner capital as manual items",
    },
    {
      label: "Inventory",
      amount: inventory.total,
      source: "auto",
      note: "Reconstructed on-hand stock at weighted-average purchase cost",
    },
    {
      label: "Accounts Receivable",
      amount: accountsReceivable,
      source: "auto",
      note: "Outstanding loan balances as of date",
    },
    ...resolvedManual.current_asset,
  ]
  const fixedAssets = [...resolvedManual.fixed_asset]
  const currentLiabilities = [...resolvedManual.current_liability]
  const longTermLiabilities = [...resolvedManual.long_term_liability]

  const equityLines: BalanceSheetLine[] = [
    {
      label: "Retained Earnings",
      amount: retainedIncome.netProfit,
      source: "auto",
      note: yearStart
        ? `Net profit through ${asOfYear - 1}-12-31`
        : "Cumulative net profit through date",
    },
    ...(currentYearIncome
      ? [
          {
            label: "Current Year Earnings",
            amount: currentYearIncome.netProfit,
            source: "auto" as const,
            note: `Net profit for ${asOfYear} through date`,
          },
        ]
      : []),
    ...resolvedManual.equity,
  ]

  const assetsTotal = sumLines(currentAssets) + sumLines(fixedAssets)
  const liabilitiesTotal =
    sumLines(currentLiabilities) + sumLines(longTermLiabilities)
  const equityTotal = sumLines(equityLines)
  const totalLiabilitiesAndEquity = liabilitiesTotal + equityTotal

  return {
    asOf: asOfInput,
    assets: { current: currentAssets, fixed: fixedAssets, total: assetsTotal },
    liabilities: {
      current: currentLiabilities,
      longTerm: longTermLiabilities,
      total: liabilitiesTotal,
    },
    equity: { lines: equityLines, total: equityTotal },
    totalAssets: assetsTotal,
    totalLiabilitiesAndEquity,
    balanceDifference: assetsTotal - totalLiabilitiesAndEquity,
    inventoryWarnings: inventory.negativeStockProducts,
  }
}
