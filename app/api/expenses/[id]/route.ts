import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Expense from '@/models/Expense'

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectDB()
  const { id } = await params
  await Expense.findByIdAndDelete(id)
  return NextResponse.json({ ok: true })
}
