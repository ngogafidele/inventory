// Aggregates money actually collected per payment method for a period.
import { Sale } from "@/lib/db/models/Sale"

export type PaymentMethodTotals = {
  cash: number
  bank: number
  mobile: number
}

type MethodBucket = {
  _id: "cash" | "bank" | "mobile" | null
  total: number
}

// A payment is collected either at the point of sale (a paid sale with no
// installment history) or as a loan installment. Counting paid sales without
// installments alongside every installment payment avoids double counting a
// loan that was settled through installments.
export async function getPaymentMethodTotals(
  store: string,
  dateFilter: Record<string, Date>
): Promise<PaymentMethodTotals> {
  const [result] = await Sale.aggregate<{
    pointOfSale: MethodBucket[]
    installments: MethodBucket[]
  }>([
    { $match: { store, deletedAt: null } },
    {
      $facet: {
        pointOfSale: [
          {
            $match: {
              paymentStatus: "paid",
              createdAt: dateFilter,
              $expr: {
                $eq: [{ $size: { $ifNull: ["$payments", []] } }, 0],
              },
            },
          },
          {
            $group: { _id: "$paymentMethod", total: { $sum: "$totalAmount" } },
          },
        ],
        installments: [
          { $unwind: "$payments" },
          { $match: { "payments.paidAt": dateFilter } },
          {
            $group: {
              _id: "$payments.paymentMethod",
              total: { $sum: "$payments.amount" },
            },
          },
        ],
      },
    },
  ])

  const totals: PaymentMethodTotals = { cash: 0, bank: 0, mobile: 0 }
  const add = (buckets: MethodBucket[] | undefined) => {
    ;(buckets ?? []).forEach((bucket) => {
      if (
        bucket._id === "cash" ||
        bucket._id === "bank" ||
        bucket._id === "mobile"
      ) {
        totals[bucket._id] += bucket.total
      }
    })
  }

  add(result?.pointOfSale)
  add(result?.installments)

  return totals
}
