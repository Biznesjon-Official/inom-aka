import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import { formatPrice } from '@/lib/utils'
import Sale from '@/models/Sale'
import Debt from '@/models/Debt'
import Product from '@/models/Product'
import mongoose, { Types } from 'mongoose'

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
    const ids = searchParams.get('ids')

    // Specific sale IDs mode (for debt archive view)
    if (ids) {
      const idList = ids.split(',').filter(Boolean).map(id => new Types.ObjectId(id))
      const sales = await Sale.aggregate([
        { $match: { _id: { $in: idList } } },
        {
          $lookup: {
            from: 'users',
            localField: 'cashier',
            foreignField: '_id',
            as: 'cashier',
            pipeline: [{ $project: { name: 1 } }]
          }
        },
        {
          $lookup: {
            from: 'customers',
            localField: 'customer',
            foreignField: '_id',
            as: 'customer',
            pipeline: [{ $project: { name: 1, phone: 1 } }]
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'usta',
            foreignField: '_id',
            as: 'usta',
            pipeline: [{ $project: { name: 1 } }]
          }
        },
        { $unwind: { path: '$cashier', preserveNullAndEmptyArrays: true } },
        { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
        { $unwind: { path: '$usta', preserveNullAndEmptyArrays: true } },
        { $sort: { createdAt: -1 } }
      ]).allowDiskUse(true)
      
      return NextResponse.json(sales)
    }

    const search = searchParams.get('search')

    const matchStage: Record<string, unknown> = {}
    
    if (search) {
      // Search mode: search across all sales, no date/limit restriction
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const searchNum = Number(search)
      if (!isNaN(searchNum) && search.trim() !== '') {
        // Receipt number exact match
        matchStage.receiptNo = searchNum
      } else {
        // Name search: registered customers + debt customers (customerName on Debt)
        const regex = new RegExp(escapedSearch, 'i')
        const Customer = (await import('@/models/Customer')).default
        const [matchingCustomers, matchingDebts] = await Promise.all([
          Customer.find({ name: regex }).select('_id').lean() as Promise<{ _id: unknown }[]>,
          Debt.find({ customerName: regex }).select('sale entries.sale').lean() as Promise<{ sale?: unknown; entries?: { sale?: unknown }[] }[]>,
        ])
        // Collect sale IDs from debts (debt customers don't have Customer record)
        const debtSaleIds: unknown[] = []
        for (const d of matchingDebts) {
          if (d.sale) debtSaleIds.push(d.sale)
          if (d.entries) for (const e of d.entries) if (e.sale) debtSaleIds.push(e.sale)
        }
        matchStage.$or = [
          { customer: { $in: matchingCustomers.map(c => c._id) } },
          ...(debtSaleIds.length > 0 ? [{ _id: { $in: debtSaleIds } }] : [{ _id: null }]),
        ]
      }
    } else {
      if (cashier) matchStage.cashier = new Types.ObjectId(cashier)
      if (customer) matchStage.customer = new Types.ObjectId(customer)
      if (usta) matchStage.usta = new Types.ObjectId(usta)
      if (today === '1') {
        const start = new Date()
        start.setHours(0, 0, 0, 0)
        matchStage.createdAt = { $gte: start }
      } else if (from || to) {
        matchStage.createdAt = {}
        if (from) (matchStage.createdAt as Record<string, unknown>).$gte = new Date(from)
        if (to) (matchStage.createdAt as Record<string, unknown>).$lte = new Date(to)
      }
    }

    // Period totals for the FULL match (no limit) — aggregation mirror of
    // calcSaleRevenue/calcSaleDebt/calcSaleProfit in lib/utils.ts
    if (searchParams.get('stats') === '1') {
      const [s] = await Sale.aggregate([
        { $match: matchStage },
        { $project: {
          _cost: { $sum: { $map: { input: { $ifNull: ['$items', []] }, as: 'i', in: { $multiply: [{ $ifNull: ['$$i.costPrice', 0] }, '$$i.qty'] } } } },
          _retCost: { $sum: { $map: { input: { $ifNull: ['$returnedItems', []] }, as: 'i', in: { $multiply: [{ $ifNull: ['$$i.costPrice', 0] }, '$$i.qty'] } } } },
          _revenue: { $subtract: ['$paid', { $max: [0, { $subtract: [{ $ifNull: ['$returnedTotal', 0] }, { $subtract: ['$total', '$paid'] }] }] }] },
          _debt: { $max: [0, { $subtract: [{ $subtract: ['$total', '$paid'] }, { $ifNull: ['$returnedTotal', 0] }] }] },
          _net: { $subtract: ['$total', { $ifNull: ['$returnedTotal', 0] }] },
        } },
        // profit is clamped per sale BEFORE summing (matches calcSaleProfit semantics)
        { $project: { _revenue: 1, _debt: 1, _net: 1,
          _profit: { $max: [0, { $subtract: ['$_revenue', { $subtract: ['$_cost', '$_retCost'] }] }] } } },
        { $group: { _id: null,
          totalRevenue: { $sum: '$_revenue' }, totalDebt: { $sum: '$_debt' },
          totalSales: { $sum: '$_net' }, totalProfit: { $sum: '$_profit' }, count: { $sum: 1 } } },
        { $project: { _id: 0 } },
      ]).allowDiskUse(true)
      return NextResponse.json(s ?? { totalRevenue: 0, totalDebt: 0, totalSales: 0, totalProfit: 0, count: 0 })
    }

    const page = Math.max(0, parseInt(searchParams.get('page') || '0', 10) || 0)
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '30', 10) || 30)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pipeline: any[] = [
      { $match: matchStage },
      { $sort: { createdAt: -1, _id: -1 } },
    ]

    if (page > 0) {
      // Paginated mode: skip/limit before lookups, fetch one extra doc for hasMore
      pipeline.push({ $skip: (page - 1) * limit }, { $limit: limit + 1 })
    } else {
      // Legacy mode (SalesLog, ustalar): cap result set — unbounded search
      // returned 1000+ rows and froze the UI.
      pipeline.push({ $limit: search ? 200 : 100 })
    }

    // Add lookups for related data
    pipeline.push(
      {
        $lookup: {
          from: 'users',
          localField: 'cashier',
          foreignField: '_id',
          as: 'cashier',
          pipeline: [{ $project: { name: 1 } }]
        }
      },
      {
        $lookup: {
          from: 'customers',
          localField: 'customer',
          foreignField: '_id',
          as: 'customer',
          pipeline: [{ $project: { name: 1, phone: 1 } }]
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'usta',
          foreignField: '_id',
          as: 'usta',
          pipeline: [{ $project: { name: 1 } }]
        }
      },
      { $unwind: { path: '$cashier', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$usta', preserveNullAndEmptyArrays: true } }
    )

    const sales = await Sale.aggregate(pipeline).allowDiskUse(true)

    if (page > 0) {
      const hasMore = sales.length > limit
      return NextResponse.json({ items: hasMore ? sales.slice(0, limit) : sales, hasMore })
    }
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

    // All-or-nothing: stock decrement + sale + debt are committed atomically.
    const session = await mongoose.startSession()
    let result: { sale: unknown; debt?: unknown }
    try {
      await session.withTransaction(async () => {
        // Atomic stock decrease — prevents overselling; transaction rolls back on any failure
        for (const item of body.items) {
          const dec = await Product.findOneAndUpdate(
            { _id: item.product, stock: { $gte: item.qty } },
            { $inc: { stock: -item.qty } },
            { returnDocument: 'after', session }
          )
          if (!dec) {
            const p = await Product.findById(item.product).select('name stock unit').session(session).lean() as { name?: string; stock?: number; unit?: string } | null
            const msg = `${p?.name || item.productName}: stokda ${p?.stock ?? 0} ${p?.unit || item.unit || 'ta'}, lekin ${item.qty} ${p?.unit || item.unit || 'ta'} so'ralmoqda`
            throw Object.assign(new Error(msg), { statusCode: 400 })
          }
        }

        const [sale] = await Sale.create([body], { session })

        // Qarzga sotuv — xuddi shu nomdagi aktiv qarzga atomik qo'shish/yaratish (race'siz)
        if ((body.paymentType === 'partial' || body.paymentType === 'debt') && body.debtorName) {
          const remaining = body.total - (body.paid || 0)
          const trimmedName = body.debtorName.trim()
          const trimmedPhone = body.debtorPhone?.trim() || ''

          const initialPayments = body.paid > 0 && Array.isArray(body.payments) && body.payments.length > 0
            ? body.payments.map((p: { method: string; amount: number }) => ({ amount: p.amount, method: p.method, date: new Date(), fromSale: true, saleRef: sale._id }))
            : body.paid > 0 ? [{ amount: body.paid, date: new Date(), fromSale: true, saleRef: sale._id }] : []

          const saleNote = `Sotuv #${sale.receiptNo || sale._id}: ${formatPrice(body.total)}`

          // Atomic find-or-create: upsert eliminates the duplicate-debt race
          const debt = await Debt.findOneAndUpdate(
            { customerName: trimmedName, status: 'active', type: 'customer' },
            {
              $inc: { totalAmount: body.total, paidAmount: body.paid || 0, remainingAmount: remaining },
              $push: {
                entries: { amount: body.total, paidAmount: body.paid || 0, note: saleNote, date: new Date(), sale: sale._id },
                payments: { $each: initialPayments },
              },
              $setOnInsert: { customerPhone: trimmedPhone || undefined, sale: sale._id },
            },
            { upsert: true, new: true, session }
          )
          await Sale.findByIdAndUpdate(sale._id, { debt: debt._id }, { session })
          result = { sale, debt }
        } else {
          result = { sale }
        }
      })
    } finally {
      await session.endSession()
    }
    return NextResponse.json(result!, { status: 201 })
  } catch (err) {
    const e = err as { statusCode?: number; message?: string }
    if (e?.statusCode === 400) return NextResponse.json({ error: e.message }, { status: 400 })
    return errorResponse(err)
  }
}
