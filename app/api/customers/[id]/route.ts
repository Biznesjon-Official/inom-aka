import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import Customer from '@/models/Customer'
import Debt from '@/models/Debt'
import Sale from '@/models/Sale'
import CashbackPayout from '@/models/CashbackPayout'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    const customer = await Customer.findById(id).lean()
    if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const debts = await Debt.find({ customer: id }).sort({ createdAt: -1 }).limit(50).lean()
    const sales = await Sale.find({ customer: id }).sort({ createdAt: -1 }).limit(20).lean()
    const cashbackPayouts = await CashbackPayout.find({ customer: id }).sort({ createdAt: -1 }).limit(10).lean()
    return NextResponse.json({ customer, debts, sales, cashbackPayouts })
  } catch (err) { return errorResponse(err) }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    const body = await req.json()
    const customer = await Customer.findByIdAndUpdate(id, body, { new: true })
    if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(customer)
  } catch (err) { return errorResponse(err) }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    const activeDebts = await Debt.countDocuments({ customer: id, status: 'active' })
    if (activeDebts > 0) {
      return NextResponse.json({ error: `Mijozda ${activeDebts} ta aktiv qarz bor, o'chirib bo'lmaydi` }, { status: 400 })
    }
    await Customer.findByIdAndDelete(id)
    return NextResponse.json({ ok: true })
  } catch (err) { return errorResponse(err) }
}
