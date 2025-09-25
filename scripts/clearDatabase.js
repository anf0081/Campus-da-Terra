const mongoose = require('mongoose')
const config = require('../utils/config')

const User = require('../models/user')
const Student = require('../models/student')
const Book = require('../models/book')
const Document = require('../models/document')
const EventSignup = require('../models/eventSignup')
const Notification = require('../models/notification')
const Dashboard = require('../models/dashboard')

const clearDatabase = async () => {
  try {
    console.log('Connecting to MongoDB...')
    await mongoose.connect(config.MONGODB_URI)
    console.log('Connected to MongoDB')

    console.log('Clearing database...')

    await User.deleteMany({})
    console.log('✅ Cleared users collection')

    await Student.deleteMany({})
    console.log('✅ Cleared students collection')

    await Book.deleteMany({})
    console.log('✅ Cleared books collection')

    await Document.deleteMany({})
    console.log('✅ Cleared documents collection')

    await EventSignup.deleteMany({})
    console.log('✅ Cleared event signups collection')

    await Notification.deleteMany({})
    console.log('✅ Cleared notifications collection')

    await Dashboard.deleteMany({})
    console.log('✅ Cleared dashboards collection')

    console.log('🎉 Database cleared successfully!')

    await mongoose.connection.close()
    console.log('Disconnected from MongoDB')

  } catch (error) {
    console.error('❌ Error clearing database:', error)
    process.exit(1)
  }
}

clearDatabase()