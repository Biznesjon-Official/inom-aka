import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Product from '@/models/Product'
import { escapeRegex } from '@/lib/utils'

export async function GET(req: Request) {
  await connectDB()
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')
  const category = searchParams.get('category')
  const active = searchParams.get('active')

  const filter: Record<string, unknown> = {}
  if (search) filter.name = { $regex: escapeRegex(search), $options: 'i' }
  if (category) filter.category = category
  if (active !== 'all') filter.isActive = true

  const fields = searchParams.get('fields')
  let query = Product.find(filter).populate('category').sort({ createdAt: -1 }).limit(200)
  if (fields === 'list') {
    query = query.select('-image -description')
  }
  const products = await query.lean()
  return NextResponse.json(products)
}

export async function POST(req: Request) {
  await connectDB()
  const body = await req.json()
  const product = await Product.create(body)
  return NextResponse.json(product, { status: 201 })
}
