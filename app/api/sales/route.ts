import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import { formatPrice } from '@/lib/utils'
import Sale from '@/models/Sale'
import Debt from '@/models/Debt'
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
    const usta = searchParams.get('usta')

    const filter: Record<string, unknown> = {}
    if (cashier) filter.cashier = cashier
    if (customer) filter.customer = customer
    if (usta) filter.usta = usta
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
        const p = await Product.findById(item.product).select('name stock unit').lean() as { name?: string; stock?: number; unit?: string } | null
        const name = p?.name || item.productName
        const stock = p?.stock ?? 0
        const unit = p?.unit || item.unit || 'ta'
        return NextResponse.json({ error: `${name}: stokda ${stock} ${unit}, lekin ${item.qty} ${unit} so'ralmoqda` }, { status: 400 })
      }
    }

    const sale = await Sale.create(body)

    // Create or update debt if partial or full debt
    if ((body.paymentType === 'partial' || body.paymentType === 'debt') && body.debtorName) {
      const remaining = body.total - (body.paid || 0)
      const trimmedName = body.debtorName.trim()
      const trimmedPhone = body.debtorPhone?.trim() || ''

      // Check if there's an existing active debt for this customer (by name and phone)
      // If phone is empty, match by name only; otherwise match by both name and phone
      let query: Record<string, unknown>

      if (trimmedPhone) {
        // If phone provided, match by both name and phone
        query = {
          customerName: trimmedName,
          customerPhone: trimmedPhone,
          status: 'active',
          type: 'customer',
        }
      } else {
        // If no phone provided, match by name and (no phone OR empty phone OR null phone)
        query = {
          $and: [
            { customerName: trimmedName },
            { status: 'active' },
            { type: 'customer' },
            {
              $or: [
                { customerPhone: { $exists: false } },
                { customerPhone: '' },
                { customerPhone: null }
              ]
            }
          ]
        }
      }

      const existingDebt = await Debt.findOne(query)

      if (existingDebt) {
        // Add to existing debt
        existingDebt.totalAmount += body.total
        existingDebt.paidAmount += (body.paid || 0)
        existingDebt.remainingAmount += remaining
        
        // Add initial payment if any
        if (body.paid > 0 && Array.isArray(body.payments) && body.payments.length > 0) {
          body.payments.forEach((p: { method: string; amount: number }) => {
            existingDebt.payments.push({ amount: p.amount, method: p.method, date: new Date(), fromSale: true })
          })
        } else if (body.paid > 0) {
          existingDebt.payments.push({ amount: body.paid, date: new Date(), fromSale: true })
        }

        // Add note about this sale
        const saleNote = `Sotuv #${sale.receiptNo || sale._id}: ${formatPrice(body.total)}`
        existingDebt.note = existingDebt.note 
          ? `${existingDebt.note}\n${saleNote}` 
          : saleNote

        await existingDebt.save()
        return NextResponse.json({ sale, debt: existingDebt }, { status: 201 })
      }

      // Create new debt if no existing active debt found
      const debt = await Debt.create({
        customerName: trimmedName,
        customerPhone: trimmedPhone || undefined,
        sale: sale._id,
        totalAmount: body.total,
        paidAmount: body.paid || 0,
        remainingAmount: remaining,
        payments: body.paid > 0 && Array.isArray(body.payments) && body.payments.length > 0
          ? body.payments.map((p: { method: string; amount: number }) => ({ amount: p.amount, method: p.method, date: new Date(), fromSale: true }))
          : body.paid > 0 ? [{ amount: body.paid, date: new Date(), fromSale: true }] : [],
      })
      return NextResponse.json({ sale, debt }, { status: 201 })
    }

    return NextResponse.json({ sale }, { status: 201 })
  } catch (err) { return errorResponse(err) }
}
