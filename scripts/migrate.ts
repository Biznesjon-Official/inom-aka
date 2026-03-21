import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { connectDB } from '../lib/db'
import Customer from '../models/Customer'

async function run() {
  await connectDB()
  const customers = await Customer.find({ seqNo: { $exists: false } })
  console.log(`Found ${customers.length} customers without seqNo.`)
  for (const c of customers) {
    c.seqNo = undefined
    await c.save()
    console.log(`Migrated ${c.name} -> #${c.seqNo}`)
  }
  console.log('Done!')
  process.exit(0)
}

run()
