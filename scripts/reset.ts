import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { readFileSync } from 'fs'
import { resolve } from 'path'

try {
  const envFile = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of envFile.split('\n')) {
    const [key, ...rest] = line.split('=')
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
  }
} catch {}

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/inomaka-crm'

async function main() {
  await mongoose.connect(MONGODB_URI)
  console.log('Connected to MongoDB')

  // Drop all collections
  const db = mongoose.connection.db!
  const collections = await db.listCollections().toArray()
  for (const col of collections) {
    await db.collection(col.name).deleteMany({})
    console.log(`Cleared: ${col.name}`)
  }

  // Create admin user
  const UserSchema = new mongoose.Schema({
    name: String, username: { type: String, unique: true }, password: String,
    role: { type: String, default: 'admin' }, salary: { fixed: Number, salesPercent: Number }, isActive: { type: Boolean, default: true }
  })
  const User = mongoose.models.User || mongoose.model('User', UserSchema)

  const hashed = await bcrypt.hash('admin123', 10)
  await User.create({ name: 'Admin', username: 'admin', password: hashed, role: 'admin', salary: { fixed: 0, salesPercent: 0 } })
  console.log('✅ DB tozalandi. Admin yaratildi: admin / admin123')
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
