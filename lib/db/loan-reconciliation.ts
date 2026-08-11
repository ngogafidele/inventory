import type { ClientSession } from "mongoose"
import { Invoice } from "@/lib/db/models/Invoice"
import { ReturnModel } from "@/lib/db/models/Return"
import { Sale } from "@/lib/db/models/Sale"

type LoanPayment = {
  amount?: number
}

type SaleForLoanReconciliation = {
  _id: { toString(): string }
  store: string
  totalAmount: number
  paymentStatus?: "paid" | "unpaid"
  outstanding?: unknown
  payments?: LoanPayment[]
  amountPaid?: number
  remainingBalance?: number
  wasLoan?: boolean
}

type LoanSaleDocument = SaleForLoanReconciliation & {
  paymentMethod?: "cash" | "bank" | "mobile"
  save(options?: { session?: ClientSession }): Promise<unknown>
}

type ReturnCreditTotal = {
  totalReturned?: number
  totalReplaced?: number
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

function sumPayments(payments: LoanPayment[] | undefined) {
  if (!Array.isArray(payments)) return 0
  return roundMoney(
    payments.reduce((sum, payment) => sum + (payment.amount ?? 0), 0)
  )
}

function isLoanSale(sale: SaleForLoanReconciliation) {
  return (
    sale.wasLoan === true ||
    sale.paymentStatus === "unpaid" ||
    Boolean(sale.outstanding) ||
    Boolean(sale.payments?.length)
  )
}

export async function getReturnCreditForSale(
  saleId: unknown,
  store: string,
  session?: ClientSession
) {
  const aggregate = ReturnModel.aggregate<ReturnCreditTotal>([
    { $match: { store, saleId } },
    {
      $group: {
        _id: null,
        totalReturned: { $sum: { $ifNull: ["$totalReturnAmount", 0] } },
        totalReplaced: { $sum: { $ifNull: ["$totalReplacementAmount", 0] } },
      },
    },
  ])
  if (session) aggregate.session(session)
  const totals = await aggregate

  return Math.max(
    0,
    roundMoney((totals[0]?.totalReturned ?? 0) - (totals[0]?.totalReplaced ?? 0))
  )
}

export async function reconcileLoanAfterReturn(
  saleId: unknown,
  store: string,
  session?: ClientSession
) {
  const saleQuery = Sale.findOne({ _id: saleId, store } as never)
  if (session) saleQuery.session(session)
  const sale = (await saleQuery) as LoanSaleDocument | null

  if (!sale || !isLoanSale(sale)) {
    return sale
  }

  const returnCredit = await getReturnCreditForSale(sale._id, store, session)
  const amountPaid = roundMoney(
    Math.max(
      typeof sale.amountPaid === "number" ? sale.amountPaid : 0,
      sumPayments(sale.payments)
    )
  )
  const remainingBalance = Math.max(
    0,
    roundMoney(sale.totalAmount - amountPaid - returnCredit)
  )
  const paymentStatus = remainingBalance === 0 ? "paid" : "unpaid"

  sale.wasLoan = true
  sale.amountPaid = amountPaid
  sale.remainingBalance = remainingBalance
  sale.paymentStatus = paymentStatus

  await sale.save({ session })
  await Invoice.updateOne(
    { saleId: sale._id, store } as never,
    { status: paymentStatus },
    { session }
  )

  return sale
}
