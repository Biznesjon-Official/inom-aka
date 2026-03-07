import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import Sale from '@/models/Sale'
import Debt from '@/models/Debt'
import Customer from '@/models/Customer'
import Product from '@/models/Product'

export async function GET(req: Request) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const cashier = searchParams.get('cashier')
    const customer = searchParams.get('customer')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const today = searchParams.get('today')

    const filter: Record<string, unknown> = {}
    if (cashier) filter.cashier = cashier
    if (customer) filter.customer = customer
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
      .lean()
      .allowDiskUse(true)

    return NextResponse.json(sales)
  } catch (err) { return errorResponse(err) }
}

export async function POST(req: Request) {
  try {
    await connectDB()
    const body = await req.json()

    // Validation
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'Items required' }, { status: 400 })
    }
    if (typeof body.total !== 'number' || body.total <= 0) {
      return NextResponse.json({ error: 'Invalid total' }, { status: 400 })
    }
    if (typeof body.paid !== 'number' || body.paid < 0) {
      return NextResponse.json({ error: 'Invalid paid amount' }, { status: 400 })
    }
    if (!body.cashier) {
      return NextResponse.json({ error: 'Cashier required' }, { status: 400 })
    }

    // Validate items
    for (const item of body.items) {
      if (!item.product || !item.qty || item.qty <= 0) {
        return NextResponse.json({ error: 'Invalid item data' }, { status: 400 })
      }
    }

    // Atomic stock decrease — prevents race condition (overselling)
    for (const item of body.items) {
      const result = await Product.findOneAndUpdate(
        { _id: item.product, stock: { $gte: item.qty } },
        { $inc: { stock: -item.qty } },
        { new: true }
      )
      if (!result) {
        // Rollback already decremented stocks
        for (const prev of body.items) {
          if (prev.product === item.product) break
          await Product.findByIdAndUpdate(prev.product, { $inc: { stock: prev.qty } })
        }
        const p = await Product.findById(item.product).select('name stock').lean()
        const name = p?.name || item.productName
        const stock = p?.stock ?? 0
        return NextResponse.json({ error: `${name}: stokda ${stock} ta, lekin ${item.qty} ta so'ralmoqda` }, { status: 400 })
      }
    }

    const sale = await Sale.create(body)

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
  } catch (err) { return errorResponse(err) }
}
