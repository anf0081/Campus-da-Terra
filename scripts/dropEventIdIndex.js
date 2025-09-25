const mongoose = require('mongoose')
const config = require('../utils/config')

const dropEventIdIndex = async () => {
  try {
    console.log('Connecting to MongoDB...')
    await mongoose.connect(config.MONGODB_URI)

    const db = mongoose.connection.db
    const collection = db.collection('eventsignups')

    console.log('Checking existing indexes...')
    const indexes = await collection.indexes()
    console.log('Current indexes:', indexes.map(idx => ({ name: idx.name, key: idx.key })))

    const eventIdIndex = indexes.find(idx => idx.key && idx.key.eventId)

    if (eventIdIndex) {
      console.log('Found eventId index:', eventIdIndex.name)
      console.log('Dropping eventId index...')
      await collection.dropIndex(eventIdIndex.name)
      console.log('✅ Successfully dropped eventId index')
    } else {
      console.log('No eventId index found - nothing to drop')
    }

    console.log('Checking indexes after cleanup...')
    const indexesAfter = await collection.indexes()
    console.log('Remaining indexes:', indexesAfter.map(idx => ({ name: idx.name, key: idx.key })))

  } catch (error) {
    console.error('Error dropping index:', error)
  } finally {
    await mongoose.connection.close()
    console.log('Database connection closed')
  }
}

dropEventIdIndex()