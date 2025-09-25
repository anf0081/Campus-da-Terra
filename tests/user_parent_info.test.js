require('dotenv').config()
process.env.NODE_ENV = 'test'
const { test, describe, after, beforeEach, before } = require('node:test')
const assert = require('node:assert')
const mongoose = require('mongoose')
const config = require('../utils/config')
const User = require('../models/user')
const bcrypt = require('bcrypt')

before(async () => {
  await mongoose.connect(config.MONGODB_URI)
})

describe('User model with parent information', () => {
  beforeEach(async () => {
    await User.deleteMany({ username: { $in: ['parenttest1', 'parenttest2'] } })
  })

  test('creates user without parent info (backwards compatibility)', async () => {
    const passwordHash = await bcrypt.hash('password', 10)
    const user = new User({
      username: 'parenttest1',
      name: 'Test User',
      passwordHash
    })

    const savedUser = await user.save()

    assert.strictEqual(savedUser.username, 'parenttest1')
    assert.strictEqual(savedUser.name, 'Test User')
    assert(!savedUser.parentFirstName)
    assert(!savedUser.contactNumber)
  })

  test('creates user with complete parent information', async () => {
    const passwordHash = await bcrypt.hash('password', 10)
    const userData = {
      username: 'parenttest2',
      name: 'Parent User',
      passwordHash,

      parentFirstName: 'Maria',
      parentMiddleName: 'Teresa',
      parentLastName: 'Silva',
      parentStreetAddress: 'Rua das Flores, 456',
      parentCity: 'Lisboa',
      parentPostalCode: '1200-195',
      parentCountry: 'Portugal',
      parentNationality: 'Portuguese',
      parentPassportNumber: 'PT123456789',
      parentPassportExpiryDate: new Date('2030-12-31'),
      parentNifNumber: '987654321',
      contactNumber: '+351 912 345 678',
      contactEmail: 'maria.silva@email.com',

      emergencyContactRelationship: 'Grandmother',
      emergencyContactName: 'Ana Teresa Santos',
      emergencyContactNumber: '+351 913 456 789'
    }

    const user = new User(userData)
    const savedUser = await user.save()

    assert.strictEqual(savedUser.parentFirstName, 'Maria')
    assert.strictEqual(savedUser.parentMiddleName, 'Teresa')
    assert.strictEqual(savedUser.parentLastName, 'Silva')
    assert.strictEqual(savedUser.parentCity, 'Lisboa')
    assert.strictEqual(savedUser.parentNationality, 'Portuguese')
    assert.strictEqual(savedUser.contactNumber, '+351 912 345 678')
    assert.strictEqual(savedUser.contactEmail, 'maria.silva@email.com')
    assert.strictEqual(savedUser.emergencyContactRelationship, 'Grandmother')
    assert.strictEqual(savedUser.emergencyContactName, 'Ana Teresa Santos')
    assert.strictEqual(savedUser.emergencyContactNumber, '+351 913 456 789')
  })

  test('parent address can be different from child address', async () => {
    const passwordHash = await bcrypt.hash('password', 10)
    const userData = {
      username: 'differentaddress',
      passwordHash,
      parentFirstName: 'João',
      parentLastName: 'Pereira',
      parentStreetAddress: 'Different Address, 123',
      parentCity: 'Porto',
      parentPostalCode: '4000-001',
      parentCountry: 'Portugal'
    }

    const user = new User(userData)
    const savedUser = await user.save()

    assert.strictEqual(savedUser.parentStreetAddress, 'Different Address, 123')
    assert.strictEqual(savedUser.parentCity, 'Porto')
    assert.strictEqual(savedUser.parentPostalCode, '4000-001')
  })

  test('user toJSON includes parent information', async () => {
    const passwordHash = await bcrypt.hash('password', 10)
    const user = new User({
      username: 'jsontest',
      passwordHash,
      parentFirstName: 'Test',
      parentLastName: 'Parent',
      contactEmail: 'test@parent.com'
    })

    const savedUser = await user.save()
    const userJSON = savedUser.toJSON()

    assert.strictEqual(userJSON.parentFirstName, 'Test')
    assert.strictEqual(userJSON.parentLastName, 'Parent')
    assert.strictEqual(userJSON.contactEmail, 'test@parent.com')
    assert(!userJSON.passwordHash)
    assert(!userJSON._id)
    assert(!userJSON.__v)
    assert(userJSON.id)
  })

  test('existing users without parent info still work', async () => {
    const passwordHash = await bcrypt.hash('password', 10)
    const existingUser = new User({
      username: 'existing',
      name: 'Existing User',
      passwordHash,
      books: []
    })

    const savedUser = await existingUser.save()

    assert.strictEqual(savedUser.username, 'existing')
    assert.strictEqual(savedUser.name, 'Existing User')
    assert(Array.isArray(savedUser.students))
    assert(Array.isArray(savedUser.books))
    assert.strictEqual(savedUser.students.length, 0)
  })
})

after(async () => {
  await mongoose.connection.close()
})