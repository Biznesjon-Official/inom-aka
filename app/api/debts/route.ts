import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Debt from '@/models/Debt'
import Customer from '@/models/Customer'

export async function GET(req: Request) {
  await connectDB()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const customer = searchParams.get('customer')

  const filter: Record<string, unknown> = {}
  if (status) filter.status = status
  if (customer) filter.customer = customer

  const debts = await Debt.find(filter)
    .populate('customer', 'name phone')
    .populate('sale')
    .sort({ createdAt: -1 })

  return NextResponse.json(debts)
}

export async function POST(req: Request) {
  await connectDB()
  const { customerName, customerPhone, amount, note } = await req.json()

  if (!customerName || !amount) {
    return NextResponse.json({ error: 'customerName and amount required' }, { status: 400 })
  }

  // Find or create customer
  let customer = await Customer.findOne({ name: { $regex: `^${customerName}$`, $options: 'i' } })
  if (!customer) {
    customer = await Customer.create({ name: customerName, phone: customerPhone || undefined })
  }

  const debt = await Debt.create({
    customer: customer._id,
    totalAmount: amount,
    paidAmount: 0,
    remainingAmount: amount,
    note,
  })

  await Customer.findByIdAndUpdate(customer._id, { $inc: { totalDebt: amount } })

  const populated = await debt.populate('customer', 'name phone')
  return NextResponse.json(populated, { status: 201 })
}
