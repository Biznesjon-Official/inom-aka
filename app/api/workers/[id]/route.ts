import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import User from '@/models/User'
import Sale from '@/models/Sale'
import bcrypt from 'bcryptjs'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectDB()
  const { id } = await params
  const body = await req.json()

  if (body.password) {
    body.password = await bcrypt.hash(body.password, 10)
  } else {
    delete body.password
  }

  const worker = await User.findByIdAndUpdate(id, body, { new: true }).select('-password')
  return NextResponse.json(worker)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectDB()
  const { id } = await params
  await User.findByIdAndUpdate(id, { isActive: false })
  return NextResponse.json({ ok: true })
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectDB()
  const { id } = await params

  // Get worker sales stats
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [todaySales, monthSales, worker] = await Promise.all([
    Sale.find({ cashier: id, createdAt: { $gte: todayStart } }),
    Sale.find({ cashier: id, createdAt: { $gte: monthStart } }),
    User.findById(id).select('-password'),
  ])

  const calcStats = (sales: { items: { costPrice: number; salePrice: number; qty: number }[]; total: number; paid: number }[]) => ({
    count: sales.length,
    total: sales.reduce((s, x) => s + x.total, 0),
    profit: sales.reduce((s, x) => s + x.items.reduce((a, i) => a + (i.salePrice - i.costPrice) * i.qty, 0), 0),
  })

  return NextResponse.json({
    worker,
    today: calcStats(todaySales),
    month: calcStats(monthSales),
  })
}
