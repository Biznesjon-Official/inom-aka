import mongoose from 'mongoose'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, join } from 'path'
import sharp from 'sharp'

// Load .env.local manually
try {
  const envFile = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of envFile.split('\n')) {
    const [key, ...rest] = line.split('=')
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
  }
} catch {}

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/inomaka-crm'

const ProductSchema = new mongoose.Schema({
  name: String, image: String,
}, { strict: false })

const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema)

async function main() {
  await mongoose.connect(MONGODB_URI, { socketTimeoutMS: 120000, serverSelectionTimeoutMS: 30000 })
  console.log('Connected to MongoDB')

  const dir = join(process.cwd(), 'public', 'uploads')
  mkdirSync(dir, { recursive: true })

  // Avval faqat ID va name olish (image katta, hammmasini bir vaqtda yuklamaslik kerak)
  const ids = await Product.find({}, { _id: 1, name: 1 }).lean()
  console.log(`Jami ${ids.length} ta mahsulot\n`)

  let migrated = 0
  let skipped = 0
  for (const { _id, name } of ids) {
    try {
      // Har bir productni alohida olish (memory tejash)
      const p = await Product.findById(_id, { image: 1, name: 1 }).lean()
      if (!p?.image || !p.image.startsWith('data:image/')) { skipped++; continue }

      const match = p.image.match(/^data:image\/(\w+);base64,(.+)$/)
      if (!match) { console.log(`Skip: ${name} — noto'g'ri format`); skipped++; continue }

      const raw = Buffer.from(match[2], 'base64')
      const buffer = await sharp(raw)
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer()
      const filename = `${Date.now()}-${_id.toString().slice(-8)}.webp`

      writeFileSync(join(dir, filename), buffer)
      await Product.updateOne({ _id }, { $set: { image: `/uploads/${filename}` } })

      migrated++
      console.log(`+ ${name} -> /uploads/${filename} (${(buffer.length / 1024).toFixed(0)} KB)`)
    } catch (err) {
      console.error(`x ${name}:`, err)
    }
  }

  console.log(`\nMigratsiya tugadi: ${migrated} ta saqlandi, ${skipped} ta o'tkazib yuborildi`)
  await mongoose.disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
