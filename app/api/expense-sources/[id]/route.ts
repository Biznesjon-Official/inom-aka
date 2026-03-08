import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import ExpenseSource from '@/models/ExpenseSource'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    const { name, description } = await req.json()
    if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })
    const source = await ExpenseSource.findByIdAndUpdate(id, { name: name.trim(), description }, { new: true })
    return NextResponse.json(source)
  } catch (err) { return errorResponse(err) }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    await ExpenseSource.findByIdAndDelete(id)
    return NextResponse.json({ ok: true })
  } catch (err) { return errorResponse(err) }
}
