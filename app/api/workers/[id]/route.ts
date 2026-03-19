import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import User from '@/models/User'
import Sale from '@/models/Sale'
import bcrypt from 'bcryptjs'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    const body = await req.json()

    // Only allow safe fields to be updated
    const allowedFields: Record<string, unknown> = {}
    if (body.name) allowedFields.name = body.name
    if (body.phone !== undefined) allowedFields.phone = body.phone
    if (body.salary !== undefined) allowedFields.salary = body.salary
    if (body.isActive !== undefined) allowedFields.isActive = body.isActive
    if (body.password) {
      allowedFields.password = await bcrypt.hash(body.password, 10)
    }

    const worker = await User.findByIdAndUpdate(id, allowedFields, { new: true }).select('-password')
    if (!worker) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(worker)
  } catch (err) { return errorResponse(err) }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    await User.findByIdAndUpdate(id, { isActive: false })
    return NextResponse.json({ ok: true })
  } catch (err) { return errorResponse(err) }
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [todaySales, monthSales, worker] = await Promise.all([
      Sale.find({ cashier: id, createdAt: { $gte: todayStart } }).lean(),
      Sale.find({ cashier: id, createdAt: { $gte: monthStart } }).lean(),
      User.findById(id).select('-password').lean(),
    ])

    if (!worker) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const calcStats = (sales: { items: { costPrice: number; qty: number }[]; total: number; paid: number; returnedTotal?: number; returnedCostTotal?: number }[]) => ({
      count: sales.length,
      total: sales.reduce((s, x) => s + x.total - (x.returnedTotal || 0), 0),
      profit: sales.reduce((s: number, x) => {
        const grossCost = x.items.reduce((a: number, i: { costPrice: number; qty: number }) => a + i.costPrice * i.qty, 0)
        return s + (x.total - (x.returnedTotal || 0)) - (grossCost - (x.returnedCostTotal || 0))
      }, 0),
    })

    return NextResponse.json({
      worker,
      today: calcStats(todaySales),
      month: calcStats(monthSales),
    })
  } catch (err) { return errorResponse(err) }
}
