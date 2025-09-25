require('dotenv').config()
process.env.NODE_ENV = 'test'
const bcrypt = require('bcrypt')
const { test, describe, after, beforeEach, before } = require('node:test')
const assert = require('node:assert')
const mongoose = require('mongoose')
const config = require('../utils/config')
const supertest = require('supertest')
const app = require('../app')
const helper = require('./test_helper')
const User = require('../models/user')

before(async () => {
  await mongoose.connect(config.MONGODB_URI)
})

const api = supertest(app)

before(async () => {
  await User.deleteMany({
    username: { $in: ['root', 'new user', 'no', 'nopass'] }
  })
})

describe('User creation and validation', () => {
  beforeEach(async () => {
    await User.deleteMany({
      username: { $in: ['root', 'new user', 'no', 'nopass'] }
    })

    await new Promise(resolve => setTimeout(resolve, 50))

    const passwordHash = await bcrypt.hash('password', 10)
    const user = new User({ username: 'root', passwordHash })

    await user.save()
  })

  test('creation succeeds with a unique username', async () => {
    const usersAtStart = await helper.usersInDb()

    const newUser = {
      username: 'new user',
      name: 'Annika',
      password: 'dontgrabmyass',
    }

    await api
      .post('/api/users')
      .send(newUser)
      .expect(201)
      .expect('Content-Type', /application\/json/)

    const usersAtEnd = await helper.usersInDb()
    assert.strictEqual(usersAtEnd.length, usersAtStart.length + 1)

    const usernames = usersAtEnd.map(u => u.username)
    assert(usernames.includes(newUser.username))
  })

  test('Creation fails with proper statuscode and message if username already taken', async () => {
    const usersAtStart = await helper.usersInDb()

    const rootUser = await User.findOne({ username: 'root' })
    assert(rootUser, 'Root user should exist before testing duplicate username')

    const newUser = {
      username: 'root',
      name: 'Annika New',
      password: 'nowwetalkin',
    }

    const result = await api
      .post('/api/users')
      .send(newUser)
      .expect(400)
      .expect('Content-Type', /application\/json/)

    const usersAtEnd = await helper.usersInDb()
    assert(result.body.error.includes('username'))

    assert.strictEqual(usersAtEnd.length, usersAtStart.length)
  })

  test('Creation fails with proper statuscode and message if username is too short', async () => {
    const usersAtStart = await helper.usersInDb()

    const newUser = {
      username: 'no',
      name: 'Annika Oley',
      password: 'nowwenottalkin',
    }

    const result = await api
      .post('/api/users')
      .send(newUser)
      .expect(400)
      .expect('Content-Type', /application\/json/)

    const usersAtEnd = await helper.usersInDb()
    assert(result.body.error.includes('Username must be at least 3 characters long.'))
    assert.strictEqual(usersAtEnd.length, usersAtStart.length)
  })

  test('Creation fails with proper statuscode and message if password is too short', async () => {
    const usersAtStart = await helper.usersInDb()

    const newUser = {
      username: 'nopass',
      name: 'Annika Try',
      password: 'no',
    }

    const result = await api
      .post('/api/users')
      .send(newUser)
      .expect(400)
      .expect('Content-Type', /application\/json/)

    const usersAtEnd = await helper.usersInDb()
    assert(result.body.error.includes('Password must be at least 3 characters long.'))

    assert.strictEqual(usersAtEnd.length, usersAtStart.length)
  })
})

after(async () => {
  await mongoose.connection.close()
})