import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import Debt from '@/models/Debt'
import '@/models/Sale' // ensure Sale model is registered for populate

export async function GET(req: Request) {
  try {
    await connectDB()

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const customer = searchParams.get('customer')

    const category = searchParams.get('category')

    // Bugungi qarz to'lovlarini olish
    const todayPayments = searchParams.get('todayPayments')
    if (todayPayments === '1') {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const results = await Debt.aggregate([
        { $match: { $or: [{ type: 'customer' }, { type: { $exists: false } }] } },
        { $unwind: '$payments' },
        { $match: { 'payments.date': { $gte: todayStart }, 'payments.fromSale': { $ne: true }, 'payments.refunded': { $ne: true } } },
        { $group: {
          _id: '$_id',
          customerName: { $first: '$customerName' },
          totalAmount: { $first: '$totalAmount' },
          paidAmount: { $first: '$paidAmount' },
          remainingAmount: { $first: '$remainingAmount' },
          todayPaid: { $sum: '$payments.amount' },
          todayPayments: { $push: { amount: '$payments.amount', method: '$payments.method', date: '$payments.date', note: '$payments.note' } },
        }},
        { $sort: { 'todayPayments.date': -1 } },
      ]).allowDiskUse(true)
      return NextResponse.json(results)
    }

    const search = searchParams.get('search')

    const filter: Record<string, unknown> = {}
    filter.$or = [{ type: 'customer' }, { type: { $exists: false } }]
    if (status) filter.status = status
    if (customer) filter.customer = customer
    if (category) filter.category = category
    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(escapedSearch, 'i')
      filter.$and = [
        { $or: filter.$or as unknown[] },
        { $or: [{ customerName: regex }, { customerPhone: regex }] },
      ]
      delete filter.$or
    }

    const debts = await Debt.find(filter)
      .populate('category', 'name')
      .populate({ path: 'sale', select: 'total paid createdAt paymentType items receiptNo' })
      .populate({ path: 'entries.sale', select: 'items receiptNo', model: 'Sale' })
      .sort({ createdAt: -1 })
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

    const trimmedName = customerName.trim()
    const trimmedPhone = customerPhone?.trim() || ''

    // Manual qarzlar uchun: xuddi shu NOMDAGI sotuvsiz aktiv qarzga qo'shish (telefon farqi bo'lsa ham)
    const existingDebt = await Debt.findOne({
      customerName: trimmedName, status: 'active', type: 'customer', sale: { $exists: false },
    })

    if (existingDebt) {
      existingDebt.totalAmount = Math.round(existingDebt.totalAmount * 100 + amount * 100) / 100
      existingDebt.remainingAmount = Math.round(existingDebt.remainingAmount * 100 + amount * 100) / 100
      existingDebt.entries.push({ amount, note: note || undefined, date: new Date() })
      if (trimmedPhone && !existingDebt.customerPhone) existingDebt.customerPhone = trimmedPhone
      if (category && !existingDebt.category) existingDebt.category = category
      await existingDebt.save()
      return NextResponse.json(existingDebt, { status: 200 })
    }

    const debt = await Debt.create({
      customerName: trimmedName,
      customerPhone: trimmedPhone || undefined,
      totalAmount: amount,
      paidAmount: 0,
      remainingAmount: amount,
      entries: [{ amount, note: note || undefined, date: new Date() }],
      category: category || undefined,
      type: 'customer',
    })

    return NextResponse.json(debt, { status: 201 })
  } catch (err) { return errorResponse(err) }
}
