import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import { requireAuth, requireAdmin } from '@/lib/auth-utils'
import User from '@/models/User'
import Sale from '@/models/Sale'
import bcrypt from 'bcryptjs'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireAdmin()
  if (response) return response

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

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireAdmin()
  if (response) return response

  try {
    await connectDB()
    const { id } = await params
    await User.findByIdAndUpdate(id, { isActive: false })
    return NextResponse.json({ ok: true })
  } catch (err) { return errorResponse(err) }
}

type SaleDoc = {
  _id: unknown
  receiptNo?: number
  createdAt: Date
  total: number
  paid: number
  paymentType: string
  returnedTotal?: number
  returnedCostTotal?: number
  items: { costPrice: number; qty: number }[]
  cashier?: { _id: unknown; name: string } | unknown
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireAuth()
  if (response) return response

  try {
    await connectDB()
    const { id } = await params

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [todaySales, monthSales, ustaTodaySales, ustaMonthSales, worker] = await Promise.all([
      Sale.find({ cashier: id, createdAt: { $gte: todayStart } }).lean() as Promise<SaleDoc[]>,
      Sale.find({ cashier: id, createdAt: { $gte: monthStart } }).lean() as Promise<SaleDoc[]>,
      Sale.find({ usta: id, createdAt: { $gte: todayStart } })
        .populate('cashier', 'name').lean() as Promise<SaleDoc[]>,
      Sale.find({ usta: id, createdAt: { $gte: monthStart } })
        .populate('cashier', 'name').sort({ createdAt: -1 }).lean() as Promise<SaleDoc[]>,
      User.findById(id).select('-password').lean(),
    ])

    if (!worker) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const calcStats = (sales: SaleDoc[]) => ({
      count: sales.length,
      total: sales.reduce((s, x) => s + x.total - (x.returnedTotal || 0), 0),
      profit: sales.reduce((s: number, x) => {
        const grossCost = x.items.reduce((a: number, i) => a + i.costPrice * i.qty, 0)
        return s + (x.total - (x.returnedTotal || 0)) - (grossCost - (x.returnedCostTotal || 0))
      }, 0),
    })

    const salesPercent = (worker as { salary?: { salesPercent?: number } }).salary?.salesPercent || 0

    const calcUstaSales = (sales: SaleDoc[]) => sales.map(s => {
      const costTotal = s.items.reduce((a, i) => a + i.costPrice * i.qty, 0)
      const netTotal = s.total - (s.returnedTotal || 0)
      const netCost = costTotal - (s.returnedCostTotal || 0)
      const profit = netTotal - netCost
      const cashback = Math.round(Math.max(0, profit) * salesPercent / 100)
      return {
        _id: s._id,
        receiptNo: s.receiptNo,
        createdAt: s.createdAt,
        total: netTotal,
        profit,
        cashback,
        paymentType: s.paymentType,
        cashier: s.cashier,
        hasReturn: (s.returnedTotal || 0) > 0,
      }
    })

    const ustaMonthData = calcUstaSales(ustaMonthSales)
    const ustaTodayData = calcUstaSales(ustaTodaySales)

    return NextResponse.json({
      worker,
      today: calcStats(todaySales),
      month: calcStats(monthSales),
      ustaToday: {
        count: ustaTodayData.length,
        totalCashback: ustaTodayData.reduce((s, x) => s + x.cashback, 0),
      },
      ustaMonth: {
        count: ustaMonthData.length,
        totalCashback: ustaMonthData.reduce((s, x) => s + x.cashback, 0),
        sales: ustaMonthData,
      },
    })
  } catch (err) { return errorResponse(err) }
}
