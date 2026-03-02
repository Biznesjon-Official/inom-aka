import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Product from '@/models/Product'

export async function GET(req: Request) {
  await connectDB()
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')
  const category = searchParams.get('category')
  const active = searchParams.get('active')

  const filter: Record<string, unknown> = {}
  if (search) filter.name = { $regex: search, $options: 'i' }
  if (category) filter.category = category
  if (active !== 'all') filter.isActive = true

  const products = await Product.find(filter).populate('category').sort({ createdAt: -1 })
  return NextResponse.json(products)
}

export async function POST(req: Request) {
  await connectDB()
  const body = await req.json()
  const product = await Product.create(body)
  return NextResponse.json(product, { status: 201 })
}
