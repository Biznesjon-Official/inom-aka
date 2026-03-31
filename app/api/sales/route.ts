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
      .populate('usta', 'name')
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
    if (body.paid > body.total) {
      return NextResponse.json({ error: 'To\'lov summasi jami summadan ko\'p bo\'lishi mumkin emas' }, { status: 400 })
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
        const failIdx = body.items.indexOf(item)
        for (let i = 0; i < failIdx; i++) {
          await Product.findByIdAndUpdate(body.items[i].product, { $inc: { stock: body.items[i].qty } })
        }
        const p = await Product.findById(item.product).select('name stock unit').lean() as { name?: string; stock?: number; unit?: string } | null
        const name = p?.name || item.productName
        const stock = p?.stock ?? 0
        const unit = p?.unit || item.unit || 'ta'
        return NextResponse.json({ error: `${name}: stokda ${stock} ${unit}, lekin ${item.qty} ${unit} so'ralmoqda` }, { status: 400 })
      }
    }

    const sale = await Sale.create(body)

    // Qarzga sotuv — xuddi shu nomdagi aktiv qarzga qo'shish yoki yangi yaratish
    if ((body.paymentType === 'partial' || body.paymentType === 'debt') && body.debtorName) {
      const remaining = body.total - (body.paid || 0)
      const trimmedName = body.debtorName.trim()
      const trimmedPhone = body.debtorPhone?.trim() || ''

      const initialPayments = body.paid > 0 && Array.isArray(body.payments) && body.payments.length > 0
        ? body.payments.map((p: { method: string; amount: number }) => ({ amount: p.amount, method: p.method, date: new Date(), fromSale: true, saleRef: sale._id }))
        : body.paid > 0 ? [{ amount: body.paid, date: new Date(), fromSale: true, saleRef: sale._id }] : []

      const saleNote = `Sotuv #${sale.receiptNo || sale._id}: ${formatPrice(body.total)}`

      // Xuddi shu nomdagi aktiv qarzni topish
      const existingDebt = await Debt.findOne({ customerName: trimmedName, status: 'active', type: 'customer' })

      if (existingDebt) {
        existingDebt.totalAmount = Math.round(existingDebt.totalAmount * 100 + body.total * 100) / 100
        existingDebt.paidAmount = Math.round(existingDebt.paidAmount * 100 + (body.paid || 0) * 100) / 100
        existingDebt.remainingAmount = Math.round(existingDebt.remainingAmount * 100 + remaining * 100) / 100
        for (const p of initialPayments) existingDebt.payments.push(p)
        existingDebt.entries.push({ amount: body.total, paidAmount: body.paid || 0, note: saleNote, date: new Date(), sale: sale._id })
        if (trimmedPhone && !existingDebt.customerPhone) existingDebt.customerPhone = trimmedPhone
        await existingDebt.save()
        await Sale.findByIdAndUpdate(sale._id, { debt: existingDebt._id })
        return NextResponse.json({ sale, debt: existingDebt }, { status: 201 })
      }

      const debt = await Debt.create({
        customerName: trimmedName,
        customerPhone: trimmedPhone || undefined,
        totalAmount: body.total,
        paidAmount: body.paid || 0,
        remainingAmount: remaining,
        payments: initialPayments,
        entries: [{ amount: body.total, paidAmount: body.paid || 0, note: saleNote, date: new Date(), sale: sale._id }],
        type: 'customer',
        sale: sale._id,
      })
      await Sale.findByIdAndUpdate(sale._id, { debt: debt._id })
      return NextResponse.json({ sale, debt }, { status: 201 })
    }

    return NextResponse.json({ sale }, { status: 201 })
  } catch (err) { return errorResponse(err) }
}
