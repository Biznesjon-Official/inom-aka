import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import User from '@/models/User'
import bcrypt from 'bcryptjs'

export async function GET() {
  try {
    await connectDB()
    const workers = await User.find({ role: 'worker' }).select('-password').sort({ name: 1 }).lean()
    return NextResponse.json(workers)
  } catch (err) { return errorResponse(err) }
}

export async function POST(req: Request) {
  try {
    await connectDB()
    const body = await req.json()
    const hashed = await bcrypt.hash(body.password, 10)
    const worker = await User.create({ ...body, password: hashed, role: 'worker' })
    const { password: _, ...rest } = worker.toObject()
    return NextResponse.json(rest, { status: 201 })
  } catch (err) { return errorResponse(err) }
}
