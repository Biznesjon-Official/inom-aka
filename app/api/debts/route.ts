import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import Debt from '@/models/Debt'

export async function GET(req: Request) {
  try {
    await connectDB()
    // Migrate: remove old string category values
    await Debt.updateMany({ category: { $type: 'string' } }, { $unset: { category: 1 } })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const customer = searchParams.get('customer')

    const category = searchParams.get('category')

    const filter: Record<string, unknown> = {}
    if (status) filter.status = status
    if (customer) filter.customer = customer
    if (category) filter.category = category
    filter.$or = [{ type: 'customer' }, { type: { $exists: false } }]

    const debts = await Debt.find(filter)
      .populate('category', 'name')
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
    const { customerName, customerPhone, amount, note, category } = await req.json()

    if (!customerName || !amount) {
      return NextResponse.json({ error: 'customerName and amount required' }, { status: 400 })
    }

    const debt = await Debt.create({
      customerName: customerName.trim(),
      customerPhone: customerPhone?.trim() || undefined,
      totalAmount: amount,
      paidAmount: 0,
      remainingAmount: amount,
      note,
      category: category || undefined,
      type: 'customer',
    })

    return NextResponse.json(debt, { status: 201 })
  } catch (err) { return errorResponse(err) }
}
