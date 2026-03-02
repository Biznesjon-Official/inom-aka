import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Category from '@/models/Category'

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectDB()
  const { id } = await params
  await Category.findByIdAndDelete(id)
  return NextResponse.json({ ok: true })
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectDB()
  const { id } = await params
  const body = await req.json()
  const category = await Category.findByIdAndUpdate(id, body, { new: true })
  return NextResponse.json(category)
}
