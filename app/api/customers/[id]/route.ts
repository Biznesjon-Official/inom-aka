import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Customer from '@/models/Customer'
import Debt from '@/models/Debt'
import Sale from '@/models/Sale'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectDB()
  const { id } = await params
  const customer = await Customer.findById(id)
  const debts = await Debt.find({ customer: id }).sort({ createdAt: -1 })
  const sales = await Sale.find({ customer: id }).sort({ createdAt: -1 }).limit(20)
  return NextResponse.json({ customer, debts, sales })
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectDB()
  const { id } = await params
  const body = await req.json()
  const customer = await Customer.findByIdAndUpdate(id, body, { new: true })
  return NextResponse.json(customer)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectDB()
  const { id } = await params
  await Customer.findByIdAndDelete(id)
  return NextResponse.json({ ok: true })
}
