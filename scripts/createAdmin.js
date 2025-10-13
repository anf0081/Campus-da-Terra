const mongoose = require('mongoose')
const bcrypt = require('bcrypt')
const config = require('../utils/config')
const User = require('../models/user')

const createAdmin = async () => {
  try {
    console.log('Connecting to MongoDB...')
    await mongoose.connect(config.MONGODB_URI)
    console.log('Connected to MongoDB')

    const existingAdmin = await User.findOne({ role: 'admin' })
    if (existingAdmin) {
      console.log('❌ Admin user already exists:', existingAdmin.username)
      console.log('If you want to create a new admin, please delete the existing one first.')
      await mongoose.connection.close()
      return
    }

    const adminData = {
      username: 'admin',
      name: 'Administrator',
      email: 'admin@campusdaterra.com',
      role: 'admin'
    }

    const password = 'admin123'
    const saltRounds = 10
    const passwordHash = await bcrypt.hash(password, saltRounds)

    const admin = new User({
      ...adminData,
      passwordHash
    })

    const savedAdmin = await admin.save()

    console.log('🎉 Admin user created successfully!')
    console.log('👤 Username:', savedAdmin.username)
    console.log('📧 Email:', savedAdmin.email)
    console.log('🔑 Password:', password)
    console.log('⚠️  IMPORTANT: Please change the password after first login!')

    await mongoose.connection.close()
    console.log('Disconnected from MongoDB')

  } catch (error) {
    console.error('❌ Error creating admin user:', error)
    process.exit(1)
  }
}

createAdmin()