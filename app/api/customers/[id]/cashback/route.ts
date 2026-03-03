import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Customer from '@/models/Customer'
import Sale from '@/models/Sale'
import CashbackPayout from '@/models/CashbackPayout'
import { Types } from 'mongoose'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectDB()
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!from || !to) {
    return NextResponse.json({ error: 'from and to required' }, { status: 400 })
  }

  const customer = await Customer.findById(id)
  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  const periodFrom = new Date(from)
  const periodTo = new Date(to)
  const customerId = new Types.ObjectId(id)

  // Total paid amount in period
  const salesAgg = await Sale.aggregate([
    {
      $match: {
        customer: customerId,
        createdAt: { $gte: periodFrom, $lte: periodTo },
      },
    },
    { $group: { _id: null, totalPaid: { $sum: '$paid' } } },
  ])
  const totalSales = salesAgg[0]?.totalPaid || 0

  // Already paid cashback for this period
  const payoutsAgg = await CashbackPayout.aggregate([
    {
      $match: {
        customer: customerId,
        periodFrom: { $gte: periodFrom },
        periodTo: { $lte: periodTo },
      },
    },
    { $group: { _id: null, totalPaid: { $sum: '$amount' } } },
  ])
  const alreadyPaid = payoutsAgg[0]?.totalPaid || 0

  // Payout history for this period
  const payouts = await CashbackPayout.find({
    customer: customerId,
    periodFrom: { $gte: periodFrom },
    periodTo: { $lte: periodTo },
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
  })
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
}
