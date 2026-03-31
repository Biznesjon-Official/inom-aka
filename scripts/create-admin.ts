import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })

// Import User model
import '../models/User'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/inomaka-crm'

async function createAdmin() {
  console.log('🔐 Creating admin user...\n')
  
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI)
    console.log('✅ Connected to MongoDB\n')

    const User = mongoose.model('User')
    
    // Check if admin already exists
    const existingAdmin = await User.findOne({ username: 'admin' })
    
    if (existingAdmin) {
      console.log('⚠️  Admin user already exists!')
      console.log('   Username: admin')
      console.log('\n🔄 Updating password...')
      
      // Update password
      const hashedPassword = await bcrypt.hash('admin123', 10)
      await User.updateOne(
        { username: 'admin' },
        { 
          password: hashedPassword,
          role: 'admin',
          isActive: true
        }
      )
      
      console.log('✅ Admin password updated successfully!')
    } else {
      console.log('📝 Creating new admin user...')
      
      // Create new admin
      const hashedPassword = await bcrypt.hash('admin123', 10)
      await User.create({
        name: 'Admin',
        username: 'admin',
        password: hashedPassword,
        role: 'admin',
        salary: {
          fixed: 0,
          salesPercent: 0
        },
        isActive: true
      })
      
      console.log('✅ Admin user created successfully!')
    }
    
    console.log('\n📋 Login credentials:')
    console.log('━'.repeat(40))
    console.log('   Username: admin')
    console.log('   Password: admin123')
    console.log('━'.repeat(40))
    console.log('\n⚠️  IMPORTANT: Change the password after first login!')
    
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
    console.log('\n👋 Disconnected from MongoDB')
  }
}

createAdmin()
