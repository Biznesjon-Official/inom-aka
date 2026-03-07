import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load .env.local manually
try {
  const envFile = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of envFile.split('\n')) {
    const [key, ...rest] = line.split('=')
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
  }
} catch {}

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/inomaka-crm'

// Schemas (inline to avoid import issues with tsx)
const UserSchema = new mongoose.Schema({
  name: String, username: { type: String, unique: true }, password: String,
  role: { type: String, default: 'admin' }, salary: { fixed: Number, salesPercent: Number }, isActive: { type: Boolean, default: true }
})
const User = mongoose.models.User || mongoose.model('User', UserSchema)

const allCollections = [
  'users', 'products', 'categories', 'sales', 'debts', 'expenses',
  'expensesources', 'customers', 'savedcarts', 'settings', 'cashbackpayouts',
]

async function main() {
  const args = process.argv.slice(2)
  const shouldClean = args.includes('--clean')

  await mongoose.connect(MONGODB_URI)
  console.log('Connected to MongoDB')

  if (shouldClean) {
    console.log('\n--- Cleaning database ---')
    for (const col of allCollections) {
      try {
        await mongoose.connection.db!.collection(col).drop()
        console.log(`  Dropped: ${col}`)
      } catch {
        // Collection doesn't exist, skip
      }
    }
    console.log('Database cleaned!\n')
  }

  // Create admin user
  const existing = await User.findOne({ username: 'admin' })
  if (existing) {
    console.log('Admin already exists, skipping...')
  } else {
    const hashed = await bcrypt.hash('admin123', 10)
    await User.create({ name: 'Admin', username: 'admin', password: hashed, role: 'admin', salary: { fixed: 0, salesPercent: 0 } })
    console.log('Admin created: username=admin, password=admin123')
  }

  console.log('\nDone!')
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
