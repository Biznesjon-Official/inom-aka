import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import ExpenseSource from '@/models/ExpenseSource'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectDB()
  const { id } = await params
  const body = await req.json()
  const source = await ExpenseSource.findByIdAndUpdate(id, body, { new: true })
  return NextResponse.json(source)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectDB()
  const { id } = await params
  await ExpenseSource.findByIdAndDelete(id)
  return NextResponse.json({ ok: true })
}
