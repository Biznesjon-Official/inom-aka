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

    // Find last archive payout to define the start of the current period
    const lastArchive = await CashbackPayout.findOne({ customer: customerId, type: 'archive' }).sort({ periodTo: -1 }).lean() as { periodTo: Date } | null
    
    let periodFrom: Date
    let periodTo: Date
    
    // Determine the calculation boundary based on whether a target date ('to') is provided
    // For Usta Detail view, 'to' will be passed as the cashbackEndDate or current time.
    if (from && to) {
      // Legacy or forced bounds
      periodFrom = new Date(from)
      periodTo = new Date(to)
    } else {
      periodFrom = lastArchive && lastArchive.periodTo ? new Date(lastArchive.periodTo) : new Date('2000-01-01')
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
          totalPaid: { $sum: { $subtract: ['$total', { $ifNull: ['$returnedTotal', 0] }] } } 
        } 
      },
    ])
    const totalSales = salesAgg[0]?.totalPaid || 0

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
    ])
    const alreadyPaid = payoutsAgg[0]?.totalPaid || 0

    const payouts = await CashbackPayout.find({
      customer: customerId,
      type: 'archive'
    }).sort({ periodTo: -1 }).lean()

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
