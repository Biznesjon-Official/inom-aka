import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import Debt from '@/models/Debt'
import Customer from '@/models/Customer'
import Expense from '@/models/Expense'
import ExpenseSource from '@/models/ExpenseSource'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    const { amount, note } = await req.json()

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 })
    }

    const debt = await Debt.findById(id)
    if (!debt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (amount > debt.remainingAmount) {
      return NextResponse.json({ error: 'Amount exceeds remaining debt' }, { status: 400 })
    }

    const payment = { amount, date: new Date(), note }
    debt.payments.push(payment)
    debt.paidAmount = Math.round((debt.paidAmount + amount) * 100) / 100
    debt.remainingAmount = Math.round((debt.remainingAmount - amount) * 100) / 100
    if (debt.remainingAmount <= 0.01) {
      debt.remainingAmount = 0
      debt.status = 'paid'
    }
    await debt.save()

    // Update customer total debt
    await Customer.findByIdAndUpdate(debt.customer, {
      $inc: { totalDebt: -amount },
    })

    // If personal payable debt — create expense
    if (debt.type === 'personal' && debt.direction === 'payable') {
      let source = await ExpenseSource.findOne({ name: 'Shaxsiy qarz to\'lovi' })
      if (!source) {
        source = await ExpenseSource.create({ name: 'Shaxsiy qarz to\'lovi', description: 'Shaxsiy qarz to\'lovlari uchun avtomatik manba' })
      }
      await Expense.create({
        source: source._id,
        amount,
        description: note || `Shaxsiy qarz to'lovi`,
        date: new Date(),
      })
    }

    return NextResponse.json(debt)
  } catch (err) { return errorResponse(err) }
}
