import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import Debt from '@/models/Debt'
import Customer from '@/models/Customer'
import { escapeRegex } from '@/lib/utils'

export async function GET(req: Request) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const customer = searchParams.get('customer')

    const filter: Record<string, unknown> = {}
    if (status) filter.status = status
    if (customer) filter.customer = customer

    const debts = await Debt.find(filter)
      .populate('customer', 'name phone')
      .populate('sale', 'total paid createdAt paymentType')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()

    return NextResponse.json(debts)
  } catch (err) { return errorResponse(err) }
}

export async function POST(req: Request) {
  try {
    await connectDB()
    const { customerName, customerPhone, amount, note } = await req.json()

    if (!customerName || !amount) {
      return NextResponse.json({ error: 'customerName and amount required' }, { status: 400 })
    }

    // Find or create customer
    let customer = await Customer.findOne({ name: { $regex: `^${escapeRegex(customerName)}$`, $options: 'i' } })
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
  } catch (err) { return errorResponse(err) }
}
