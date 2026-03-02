import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Sale from '@/models/Sale'
import Debt from '@/models/Debt'
import Customer from '@/models/Customer'
import Product from '@/models/Product'

export async function GET(req: Request) {
  await connectDB()
  const { searchParams } = new URL(req.url)
  const cashier = searchParams.get('cashier')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const today = searchParams.get('today')

  const filter: Record<string, unknown> = {}
  if (cashier) filter.cashier = cashier
  if (today === '1') {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    filter.createdAt = { $gte: start }
  } else if (from || to) {
    filter.createdAt = {}
    if (from) (filter.createdAt as Record<string, unknown>).$gte = new Date(from)
    if (to) (filter.createdAt as Record<string, unknown>).$lte = new Date(to)
  }

  const sales = await Sale.find(filter)
    .populate('cashier', 'name')
    .populate('customer', 'name phone')
    .sort({ createdAt: -1 })
    .limit(100)

  return NextResponse.json(sales)
}

export async function POST(req: Request) {
  await connectDB()
  const body = await req.json()

  const sale = await Sale.create(body)

  // Decrease stock for each sold item
  for (const item of body.items) {
    await Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.qty } })
  }

  // Create debt if partial or full debt
  if ((body.paymentType === 'partial' || body.paymentType === 'debt') && body.customer) {
    const remaining = body.total - (body.paid || 0)
    const debt = await Debt.create({
      customer: body.customer,
      sale: sale._id,
      totalAmount: body.total,
      paidAmount: body.paid || 0,
      remainingAmount: remaining,
      payments: body.paid > 0 ? [{ amount: body.paid, date: new Date() }] : [],
    })

    await Customer.findByIdAndUpdate(body.customer, {
      $inc: { totalDebt: remaining },
    })

    return NextResponse.json({ sale, debt }, { status: 201 })
  }

  return NextResponse.json({ sale }, { status: 201 })
}
