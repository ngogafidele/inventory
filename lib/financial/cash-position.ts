// Derives the Cash & Bank position as of a date from recorded money flows.
//
//   In:  customer collections — money taken at the point of sale (dated by the
//        sale) plus loan installments (dated by their own paidAt).
//   Out: supplier purchases (product receipts), operating expenses, and net
//        customer refunds (returned value minus replacement goods issued).
//
// Dating: money flows use the date the money actually moved, so a return is dated
// by createdAt here rather than by the saleDate the income statement uses for
// contra-revenue. The two answer different questions and are usually the same day.
//
// Purchases and expenses carry no cash/bank/mobile split that spans every flow
// (receipts have no payment method), so this is a single combined figure. Owner
// capital injections and drawings are not tracked operationally — record them as
// manual balance sheet items; until then this figure can be negative and the
// balance check surfaces the gap.
import { Expense } from "@/lib/db/models/Expense"
import { ProductReceipt } from "@/lib/db/models/ProductReceipt"
import { ReturnModel } from "@/lib/db/models/Return"
import { Sale } from "@/lib/db/models/Sale"
import type { StoreKey } from "@/lib/auth/session"

type SumAgg = { total: number }

// Money taken at the point of sale, separated from instalments so a settled loan
// is not counted twice. For a sale paid outright this residual is the full
// amount; for a loan settled through payments it collapses to zero, because
// every settlement path records a dated payment.
async function computeCashCollected(
  store: StoreKey,
  endExclusive: Date
): Promise<number> {
  const rows = await Sale.aggregate<SumAgg>([
    { $match: { store, deletedAt: null, createdAt: { $lt: endExclusive } } },
    {
      $addFields: {
        paymentsAll: { $ifNull: ["$payments", []] },
      },
    },
    {
      $addFields: {
        // Instalments are credited on their own date, so only those already
        // collected by the cutoff count.
        instalmentsBefore: {
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
        instalmentsTotal: {
          $sum: {
            $map: {
              input: "$paymentsAll",
              as: "payment",
              in: "$$payment.amount",
            },
          },
        },
      },
    },
    {
      $addFields: {
        atSale: {
          $cond: [
            {
              $and: [
                { $eq: ["$paymentStatus", "paid"] },
                { $ne: ["$wasLoan", true] },
              ],
            },
            {
              $max: [0, { $subtract: ["$totalAmount", "$instalmentsTotal"] }],
            },
            0,
          ],
        },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: { $add: ["$atSale", "$instalmentsBefore"] } },
      },
    },
  ])

  return rows[0]?.total ?? 0
}

async function computeNetRefunds(
  store: StoreKey,
  endExclusive: Date
): Promise<number> {
  const rows = await ReturnModel.aggregate<SumAgg>([
    { $match: { store, createdAt: { $lt: endExclusive } } },
    {
      $addFields: {
        netReturn: {
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
    {
      $lookup: {
        from: "sales",
        localField: "saleId",
        foreignField: "_id",
        as: "sale",
      },
    },
    { $unwind: { path: "$sale", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: "$saleId",
        returnCredit: { $sum: "$netReturn" },
        sale: { $first: "$sale" },
      },
    },
    {
      $addFields: {
        paymentsAll: { $ifNull: ["$sale.payments", []] },
      },
    },
    {
      $addFields: {
        paymentsBefore: {
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
        isLoanSale: {
          $or: [
            { $eq: ["$sale.wasLoan", true] },
            { $eq: ["$sale.paymentStatus", "unpaid"] },
            { $ne: [{ $ifNull: ["$sale.outstanding", null] }, null] },
            { $gt: [{ $size: "$paymentsAll" }, 0] },
          ],
        },
      },
    },
    {
      $addFields: {
        cashRefund: {
          $cond: [
            "$isLoanSale",
            {
              $max: [
                0,
                {
                  $subtract: [
                    { $add: ["$paymentsBefore", "$returnCredit"] },
                    { $ifNull: ["$sale.totalAmount", 0] },
                  ],
                },
              ],
            },
            "$returnCredit",
          ],
        },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$cashRefund" },
      },
    },
  ])

  return rows[0]?.total ?? 0
}

export async function computeCashPosition(
  store: StoreKey,
  endExclusive: Date
): Promise<number> {
  const [collected, netRefunds, expenseAgg, purchaseAgg] = await Promise.all([
    computeCashCollected(store, endExclusive),
    computeNetRefunds(store, endExclusive),
    Expense.aggregate<SumAgg>([
      { $match: { store, date: { $lt: endExclusive } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    ProductReceipt.aggregate<SumAgg>([
      { $match: { store, receivedAt: { $lt: endExclusive } } },
      {
        $group: {
          _id: null,
          total: { $sum: { $multiply: ["$unitCost", "$quantity"] } },
        },
      },
    ]),
  ])

  return (
    collected -
    netRefunds -
    (expenseAgg[0]?.total ?? 0) -
    (purchaseAgg[0]?.total ?? 0)
  )
}
