import mongoose from 'mongoose'
import fs from 'fs'
import path from 'path'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })

// Import PersonalDebt model
import '../models/PersonalDebt'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/inomaka-crm'

async function migratePersonalDebts() {
  console.log('🚀 Starting PersonalDebt migration...\n')
  
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI)
    console.log('✅ Connected to MongoDB\n')

    const filePath = path.join(process.cwd(), 'personal_debts.json')
    
    if (!fs.existsSync(filePath)) {
      console.log('❌ File not found: personal_debts.json')
      console.log('   Please create personal_debts.json in the root directory')
      process.exit(1)
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    
    if (!Array.isArray(data)) {
      console.log('❌ Invalid JSON format. Expected an array.')
      process.exit(1)
    }

    const PersonalDebt = mongoose.model('PersonalDebt')
    
    // Clear existing PersonalDebt data
    console.log('🗑️  Clearing existing PersonalDebt data...')
    await PersonalDebt.deleteMany({})
    console.log('   ✅ Cleared\n')
    
    if (data.length === 0) {
      console.log('⚠️  No data to migrate (empty array)')
    } else {
      // Insert new data
      console.log(`📦 Inserting ${data.length} PersonalDebt records...`)
      const result = await PersonalDebt.insertMany(data, { ordered: false })
      console.log(`   ✅ ${result.length} records migrated\n`)
    }

    console.log('✨ PersonalDebt migration completed!')
    
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
    console.log('👋 Disconnected from MongoDB')
  }
}

migratePersonalDebts()
