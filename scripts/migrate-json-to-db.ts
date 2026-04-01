import mongoose from 'mongoose'
import fs from 'fs'
import path from 'path'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })

// Import models
import '../models/Category'
import '../models/Customer'
import '../models/Product'
import '../models/Sale'
import '../models/Expense'
import '../models/ExpenseSource'
import '../models/Debt'
import '../models/DebtCategory'
import '../models/PersonalDebt'
import '../models/User'
import '../models/SavedCart'
import '../models/CashbackPayout'
import '../models/Settings'
import '../models/Counter'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/inomaka-crm'

interface MigrationResult {
  collection: string
  success: boolean
  count?: number
  error?: string
}

async function migrateCollection(
  modelName: string,
  jsonFile: string
): Promise<MigrationResult> {
  try {
    const filePath = path.join(process.cwd(), jsonFile)
    
    if (!fs.existsSync(filePath)) {
      return {
        collection: modelName,
        success: false,
        error: `File not found: ${jsonFile}`
      }
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    
    if (!Array.isArray(data) || data.length === 0) {
      return {
        collection: modelName,
        success: true,
        count: 0,
        error: 'No data to migrate'
      }
    }

    const Model = mongoose.model(modelName)
    
    // Clear existing data
    await Model.deleteMany({})
    
    // Insert new data
    const result = await Model.insertMany(data, { ordered: false })
    
    return {
      collection: modelName,
      success: true,
      count: result.length
    }
  } catch (error: any) {
    return {
      collection: modelName,
      success: false,
      error: error.message
    }
  }
}

async function migrate() {
  console.log('🚀 Starting JSON to MongoDB migration...\n')
  
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI)
    console.log('✅ Connected to MongoDB\n')

    const migrations = [
      { model: 'Category', file: 'categories.json' },
      { model: 'Customer', file: 'customers.json' },
      { model: 'Product', file: 'products.json' },
      { model: 'Sale', file: 'sales.json' },
      { model: 'Expense', file: 'expenses.json' },
      { model: 'ExpenseSource', file: 'expense_sources.json' },
      { model: 'Debt', file: 'debts.json' },
      { model: 'DebtCategory', file: 'debt_categories.json' },
      { model: 'PersonalDebt', file: 'personal_debts.json' },
      { model: 'User', file: 'users.json' },
      { model: 'SavedCart', file: 'saved_carts.json' },
      { model: 'CashbackPayout', file: 'cashback_payouts.json' },
      { model: 'Settings', file: 'settings.json' },
      { model: 'Counter', file: 'counters.json' },
    ]

    const results: MigrationResult[] = []

    for (const { model, file } of migrations) {
      console.log(`📦 Migrating ${model} from ${file}...`)
      const result = await migrateCollection(model, file)
      results.push(result)
      
      if (result.success) {
        console.log(`   ✅ ${result.count} records migrated`)
      } else {
        console.log(`   ❌ Error: ${result.error}`)
      }
    }

    console.log('\n📊 Migration Summary:')
    console.log('━'.repeat(50))
    
    const successful = results.filter(r => r.success && r.count && r.count > 0)
    const failed = results.filter(r => !r.success)
    const empty = results.filter(r => r.success && (!r.count || r.count === 0))
    
    console.log(`✅ Successful: ${successful.length}`)
    successful.forEach(r => {
      console.log(`   - ${r.collection}: ${r.count} records`)
    })
    
    if (empty.length > 0) {
      console.log(`\n⚠️  Empty/Skipped: ${empty.length}`)
      empty.forEach(r => {
        console.log(`   - ${r.collection}: ${r.error || 'No data'}`)
      })
    }
    
    if (failed.length > 0) {
      console.log(`\n❌ Failed: ${failed.length}`)
      failed.forEach(r => {
        console.log(`   - ${r.collection}: ${r.error}`)
      })
    }
    
    console.log('\n✨ Migration completed!')
    
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
    console.log('👋 Disconnected from MongoDB')
  }
}

migrate()
