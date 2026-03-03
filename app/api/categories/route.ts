import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Category from '@/models/Category'

export async function GET() {
  await connectDB()
  const categories = await Category.find().sort({ name: 1 }).lean()
  return NextResponse.json(categories)
}

export async function POST(req: Request) {
  await connectDB()
  const body = await req.json()
  const category = await Category.create(body)
  return NextResponse.json(category, { status: 201 })
}
