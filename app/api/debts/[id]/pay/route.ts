import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Debt from '@/models/Debt'
import Customer from '@/models/Customer'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectDB()
  const { id } = await params
  const { amount, note } = await req.json()

  const debt = await Debt.findById(id)
  if (!debt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const payment = { amount, date: new Date(), note }
  debt.payments.push(payment)
  debt.paidAmount += amount
  debt.remainingAmount -= amount
  if (debt.remainingAmount <= 0) {
    debt.remainingAmount = 0
    debt.status = 'paid'
  }
  await debt.save()

  // Update customer total debt
  await Customer.findByIdAndUpdate(debt.customer, {
    $inc: { totalDebt: -amount },
  })

  return NextResponse.json(debt)
}
