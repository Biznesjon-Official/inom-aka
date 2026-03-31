import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import Category from '@/models/Category'

export async function GET() {
  try {
    await connectDB()
    const categories = await Category.find().sort({ name: 1 }).lean()
    return NextResponse.json(categories)
  } catch (err) { return errorResponse(err) }
}

export async function POST(req: Request) {
  try {
    await connectDB()
    const body = await req.json()
    const category = await Category.create(body)
    return NextResponse.json(category, { status: 201 })
  } catch (err) { return errorResponse(err) }
}
