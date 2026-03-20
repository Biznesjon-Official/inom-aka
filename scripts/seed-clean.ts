import mongoose from 'mongoose'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load .env.local manually
try {
  const envFile = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of envFile.split('\n')) {
    const [key, ...rest] = line.split('=')
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
  }
} catch { /* ignore */ }

const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) { console.error('MONGODB_URI not found'); process.exit(1) }

// Collections to fully clear
const COLLECTIONS_TO_CLEAR = [
  'sales', 'debts', 'personaldebts', 'expenses', 'customers',
  'expensesources', 'cashbackpayouts', 'savedcarts',
  'counters', 'settings', 'debtcategories',
]

async function main() {
  console.log('Connecting to MongoDB...')
  await mongoose.connect(MONGODB_URI!)

  const db = mongoose.connection.db!
  const existing = (await db.listCollections().toArray()).map(c => c.name)

  console.log('\n--- Clearing collections ---')
  for (const name of COLLECTIONS_TO_CLEAR) {
    if (existing.includes(name)) {
      const { deletedCount } = await db.collection(name).deleteMany({})
      console.log(`  ${name}: ${deletedCount} document(s) deleted`)
    } else {
      console.log(`  ${name}: not found, skipping`)
    }
  }

  // Remove non-admin users
  console.log('\n--- Cleaning users ---')
  const { deletedCount } = await db.collection('users').deleteMany({ role: { $ne: 'admin' } })
  console.log(`  users: ${deletedCount} non-admin user(s) deleted`)

  console.log('\n✓ Kept: products, categories, admin user(s)')
  console.log('Done!')
  await mongoose.disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
