import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Product from '@/models/Product'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectDB()
  const { id } = await params
  const product = await Product.findById(id).populate('category')
  return NextResponse.json(product)
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectDB()
  const { id } = await params
  const body = await req.json()
  const product = await Product.findByIdAndUpdate(id, { $set: body }, { new: true }).populate('category')
  return NextResponse.json(product)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectDB()
  const { id } = await params
  await Product.findByIdAndUpdate(id, { isActive: false })
  return NextResponse.json({ ok: true })
}
