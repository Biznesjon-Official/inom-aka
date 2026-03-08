import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import Product from '@/models/Product'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    const product = await Product.findById(id).populate('category')
    if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(product)
  } catch (err) { return errorResponse(err) }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    const body = await req.json()
    const { name, costPrice, salePrice, wholesalePrice, category, unit, stock, image, description } = body
    const update: Record<string, unknown> = {}
    if (name !== undefined) update.name = name
    if (costPrice !== undefined) update.costPrice = costPrice
    if (salePrice !== undefined) update.salePrice = salePrice
    if (wholesalePrice !== undefined) update.wholesalePrice = wholesalePrice
    if (category !== undefined) update.category = category
    if (unit !== undefined) update.unit = unit
    if (stock !== undefined) update.stock = stock
    if (image !== undefined) update.image = image
    if (description !== undefined) update.description = description
    const product = await Product.findByIdAndUpdate(id, { $set: update }, { new: true }).populate('category')
    if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(product)
  } catch (err) { return errorResponse(err) }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    await Product.findByIdAndUpdate(id, { isActive: false })
    return NextResponse.json({ ok: true })
  } catch (err) { return errorResponse(err) }
}
