import "@/lib/db/models/User"
import { connectToDatabase } from "@/lib/db/connection"
import { Expense } from "@/lib/db/models/Expense"
import { ExpensesManager } from "@/components/expenses/expenses-manager"
import { getCurrentStore, requireServerSession } from "@/lib/auth/server"
import { formatInKigali } from "@/lib/utils/time"

type PopulatedExpenseUser = {
  _id: { toString(): string }
  name?: string
  email?: string
}

type ExpensePageExpense = {
  _id: { toString(): string }
  description: string
  amount: number
  category?: string
  paymentMethod: "cash" | "mobile-money" | "bank"
  date: Date
  notes?: string
  createdBy?: PopulatedExpenseUser | { toString(): string }
  createdAt?: Date
}

function isPopulatedExpenseUser(
  value: ExpensePageExpense["createdBy"]
): value is PopulatedExpenseUser {
  return typeof value === "object" && value !== null && "_id" in value
}

export default async function ExpensesPage() {
  const session = await requireServerSession()
  const store = getCurrentStore(session)

  await connectToDatabase()
  const expenses = await Expense.find({ store })
    .populate("createdBy", "name email")
    .sort({ date: -1, createdAt: -1 })
    .lean<ExpensePageExpense[]>()

  const serializedExpenses = expenses.map((expense) => ({
    _id: expense._id.toString(),
    description: expense.description,
    amount: expense.amount,
    category: expense.category ?? "",
    paymentMethod: expense.paymentMethod,
    notes: expense.notes ?? "",
    date: expense.date?.toISOString(),
    createdAt: expense.createdAt?.toISOString(),
    createdByName: isPopulatedExpenseUser(expense.createdBy)
      ? expense.createdBy.name ?? expense.createdBy.email ?? "Unknown User"
      : "Unknown User",
    dateLabel: expense.date
      ? formatInKigali(expense.date, {
          year: "numeric",
          month: "short",
          day: "2-digit",
        })
      : "-",
  }))

  return <ExpensesManager initialExpenses={serializedExpenses} />
}
