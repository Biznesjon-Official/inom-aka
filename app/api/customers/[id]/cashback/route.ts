import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import Customer from '@/models/Customer'
import Sale from '@/models/Sale'
import CashbackPayout from '@/models/CashbackPayout'
import { Types } from 'mongoose'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const customer = await Customer.findById(id)
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const customerId = new Types.ObjectId(id)

    const lastArchive = await CashbackPayout.findOne({ customer: customerId, type: 'archive' }).sort({ periodTo: -1 }).lean() as { periodTo: Date } | null
    let currentLastArchive = lastArchive
    let cEnd = customer.cashbackEndDate ? new Date(customer.cashbackEndDate) : null

    // Auto-archive passed periods
    let changed = false
    while (cEnd && new Date() > cEnd) {
      changed = true
      const pTo = new Date(cEnd)
      const pFrom = currentLastArchive && currentLastArchive.periodTo ? new Date(currentLastArchive.periodTo) : new Date('2000-01-01')

      const salesAggBefore = await Sale.aggregate([
        {
          $match: {
            $or: [{ customer: customerId }, { usta: customerId }],
            createdAt: { $gt: pFrom, $lte: pTo },
          },
        },
        { 
          $group: { 
            _id: null, 
            totalPaid: { $sum: { $max: [0, { $subtract: ['$paid', { $ifNull: ['$returnedTotal', 0] }] }] } },
            totalSales: { $sum: { $max: [0, { $subtract: ['$total', { $ifNull: ['$returnedTotal', 0] }] }] } }
          } 
        },
      ]).allowDiskUse(true)

      // Include personal debts in archive calculation
      const PersonalDebt = (await import('@/models/PersonalDebt')).default
      const personalDebtsAggBefore = await PersonalDebt.aggregate([
        {
          $match: {
            customer: customerId,
            direction: 'payable',
            createdAt: { $gt: pFrom, $lte: pTo },
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$totalAmount' },
          },
        },
      ])

      const salesTotal = salesAggBefore[0]?.totalSales || 0
      const personalDebtsTotal = personalDebtsAggBefore[0]?.totalAmount || 0
      const tSales = salesTotal + personalDebtsTotal
      const calcAmt = Math.round(tSales * (customer.cashbackPercent || 0) / 100)
      
      if (calcAmt > 0 || tSales > 0) {
        currentLastArchive = await CashbackPayout.create({
          customer: id,
          amount: calcAmt,
          periodFrom: pFrom,
          periodTo: pTo,
          totalSales: tSales,
          percent: customer.cashbackPercent || 0,
          type: 'archive',
          note: `Avtomatik arxiv`,
        }) as any
      } else {
        currentLastArchive = { periodTo: new Date(pTo) } as any
      }
      
      // Advance by 1 month
      cEnd.setMonth(cEnd.getMonth() + 1)
    }

    if (changed && cEnd) {
      await Customer.findByIdAndUpdate(id, { cashbackEndDate: cEnd })
      customer.cashbackEndDate = cEnd
    }

    let periodFrom: Date
    let periodTo: Date
    
    // Determine the calculation boundary for the CURRENT active period
    if (from && to) {
      periodFrom = new Date(from)
      periodTo = new Date(to)
    } else {
      periodFrom = currentLastArchive && currentLastArchive.periodTo ? new Date(currentLastArchive.periodTo) : new Date('2000-01-01')
      periodTo = customer.cashbackEndDate ? new Date(customer.cashbackEndDate) : new Date()
    }

    const salesAgg = await Sale.aggregate([
      {
        $match: {
          $or: [{ customer: customerId }, { usta: customerId }],
          createdAt: { $gt: periodFrom, $lte: periodTo },
        },
      },
      { 
        $group: { 
          _id: null, 
          totalPaid: { $sum: { $max: [0, { $subtract: ['$paid', { $ifNull: ['$returnedTotal', 0] }] }] } },
          totalSales: { $sum: { $max: [0, { $subtract: ['$total', { $ifNull: ['$returnedTotal', 0] }] }] } }
        } 
      },
    ]).allowDiskUse(true)
    
    // Also include personal debts where customer is linked
    const PersonalDebt = (await import('@/models/PersonalDebt')).default
    const personalDebtsAgg = await PersonalDebt.aggregate([
      {
        $match: {
          customer: customerId,
          direction: 'payable', // Only debts owed by the usta
          createdAt: { $gt: periodFrom, $lte: periodTo },
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$totalAmount' },
        },
      },
    ])
    
    const salesTotal = salesAgg[0]?.totalSales || 0
    const personalDebtsTotal = personalDebtsAgg[0]?.totalAmount || 0
    const calculatedSales = salesTotal + personalDebtsTotal
    const totalSales = customer.totalSalesOverride != null ? customer.totalSalesOverride : calculatedSales

    const payoutsAgg = await CashbackPayout.aggregate([
      {
        $match: {
          customer: customerId,
          periodFrom: { $gte: periodFrom },
          periodTo: { $lte: periodTo },
          type: { $ne: 'archive' } // other manual deductions? User said no inputs needed.
        },
      },
      { $group: { _id: null, totalPaid: { $sum: '$amount' } } },
    ]).allowDiskUse(true)
    const alreadyPaid = payoutsAgg[0]?.totalPaid || 0

    const payouts = await CashbackPayout.find({
      customer: customerId
    }).sort({ createdAt: -1 }).lean()

    const percent = customer.cashbackPercent || 0
    const calculatedAmount = Math.round(totalSales * percent / 100)
    const remaining = Math.max(0, calculatedAmount - alreadyPaid)

    return NextResponse.json({
      totalSales,
      percent,
      calculatedAmount,
      alreadyPaid,
      remaining,
      payouts,
      periodFrom,
      periodTo
    })
  } catch (err) { return errorResponse(err) }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    const body = await req.json()
    const { amount, periodFrom, periodTo, totalSales, percent, type, note } = body

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    const payout = await CashbackPayout.create({
      customer: id,
      amount,
      periodFrom: new Date(periodFrom),
      periodTo: new Date(periodTo),
      totalSales,
      percent,
      type: type || 'money',
      note,
    })

    return NextResponse.json(payout, { status: 201 })
  } catch (err) { return errorResponse(err) }
}
