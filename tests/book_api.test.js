require('dotenv').config()
process.env.NODE_ENV = 'test'
const { test, describe, after, beforeEach } = require('node:test')
const assert = require('node:assert')
const mongoose = require('mongoose')
const supertest = require('supertest')
const app = require('../app')
const helper = require('./test_helper')
const Book = require('../models/book')
const User = require('../models/user')

const api = supertest(app)

beforeEach(async () => {
  await Book.deleteMany({})
  await User.deleteMany({})

  const insertedUsers = await User.insertMany(helper.initialUsers)

  const booksWithRealUserIds = helper.initialBooks.map((book) => {
    if (book.user) {
      const matchingUser = insertedUsers.find((insertedUser, index) =>
        helper.initialUsers[index].id === book.user
      )
      return {
        ...book,
        user: matchingUser ? matchingUser._id : insertedUsers[0]._id
      }
    }
    return { ...book, user: undefined }
  })

  const insertedBooks = await Book.insertMany(booksWithRealUserIds)

  for (const book of insertedBooks) {
    if (book.user) {
      await User.findByIdAndUpdate(
        book.user,
        { $push: { books: book._id } }
      )
    }
  }
})

describe('Testing of the initially saved books', () => {
  test('books are returned as json', async () => {
    await api
      .get('/api/books')
      .expect(200)
      .expect('Content-Type', /application\/json/)
  })

  test('all books are returned', async () => {
    const response = await api.get('/api/books')

    assert.strictEqual(response.body.length, helper.initialBooks.length)
  })

  test('a specific book is within the returned books', async () => {
    const response = await api.get('/api/books')

    const titles = response.body.map(e => e.title)
    assert.strictEqual(titles.includes('Book Title 2'), true)
  })

  test('unique identifier property of the book posts is named id', async () => {
    const books = await helper.booksInDb()
    for(const book of books) {
      assert(book.id !== undefined)
      assert(typeof book.id === 'string')
      assert(!book._id)
    }
  })
})

describe ('Testing of adding books', () => {
  test('A valid book can be added ', async () => {
    const usersAtStart = await helper.usersInDb()
    const user = usersAtStart[0]
    const token = await helper.getTokenForUser(user.username)

    const newBook = {
      title: 'Yes, I can be added',
      author: 'Annika',
      url: 'https://book-url-add.com'
    }

    await api
      .post('/api/books')
      .set('Authorization', `Bearer ${token}`)
      .send(newBook)
      .expect(201)
      .expect('Content-Type', /application\/json/)

    const booksAtEnd = await helper.booksInDb()
    const titles = booksAtEnd.map(b => b.title)

    assert.strictEqual(booksAtEnd.length, helper.initialBooks.length + 1)
    assert(titles.includes('Yes, I can be added'))
  })

  test('Empty book object is not added', async () => {
    const usersAtStart = await helper.usersInDb()
    const user = usersAtStart[0]
    const token = await helper.getTokenForUser(user.username)

    const newBook = {}

    await api
      .post('/api/books')
      .set('Authorization', `Bearer ${token}`)
      .send(newBook)
      .expect(400)

    const booksAtEnd = await helper.booksInDb()

    assert.strictEqual(booksAtEnd.length, helper.initialBooks.length)
  })

  test('Book without title is not added', async () => {
    const usersAtStart = await helper.usersInDb()
    const user = usersAtStart[0]
    const token = await helper.getTokenForUser(user.username)

    const newBook = {
      author: 'No Title Author',
      url: 'https//no-title.com'
    }

    await api
      .post('/api/books')
      .set('Authorization', `Bearer ${token}`)
      .send(newBook)
      .expect(400)

    const booksAtEnd = await helper.booksInDb()
    assert.strictEqual(booksAtEnd.length, helper.initialBooks.length)
  })

  test('Book without url is not added', async () => {
    const usersAtStart = await helper.usersInDb()
    const user = usersAtStart[0]
    const token = await helper.getTokenForUser(user.username)

    const newBook = {
      title: 'I have no URL',
      author: 'Annika is dumb'
    }

    await api
      .post('/api/books')
      .set('Authorization', `Bearer ${token}`)
      .send(newBook)
      .expect(400)

    const booksAtEnd = await helper.booksInDb()
    assert.strictEqual(booksAtEnd.length, helper.initialBooks.length)
  })


})

describe ('Testing of deleting a book', () => {
  test('Delete Book by ID', async () => {
    const booksAtStart = await helper.booksInDb()
    const bookToDelete = booksAtStart[0]
    const user = await User.findById(bookToDelete.user)
    const token = await helper.getTokenForUser(user.username)

    await api
      .delete(`/api/books/${bookToDelete.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204)

    const booksAtEnd = await helper.booksInDb()

    const titles = booksAtEnd.map(b => b.title)

    assert(!titles.includes(bookToDelete.title))
    assert.strictEqual(booksAtEnd.length, helper.initialBooks.length - 1)
  })
})


describe('Testing book lending functionality', () => {
  test('anyone can borrow a book successfully', async () => {
    const usersAtStart = await helper.usersInDb()
    const booksAtStart = await helper.booksInDb()

    const borrower = usersAtStart.find(u => u.id !== booksAtStart[0].user)
    const token = await helper.getTokenForUser(borrower.username)

    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 14)

    const response = await api
      .put(`/api/books/${booksAtStart[0].id}/lend`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        dueDate: dueDate.toISOString()
      })
      .expect(200)
      .expect('Content-Type', /application\/json/)

    assert.strictEqual(response.body.lending.isLent, true)
    assert.strictEqual(response.body.lending.borrower, borrower.id)
    assert(response.body.lending.lentDate)
    assert(response.body.lending.dueDate)

    const booksAtEnd = await helper.booksInDb()
    const lentBook = booksAtEnd.find(b => b.id === booksAtStart[0].id)
    assert.strictEqual(lentBook.lending.isLent, true)
    assert.strictEqual(lentBook.lending.borrower.toString(), borrower.id)
  })

  test('cannot lend already lent book', async () => {
    const usersAtStart = await helper.usersInDb()
    const booksAtStart = await helper.booksInDb()
    const firstBorrower = usersAtStart[0]
    const secondBorrower = usersAtStart[1]
    const firstToken = await helper.getTokenForUser(firstBorrower.username)
    const secondToken = await helper.getTokenForUser(secondBorrower.username)
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 14)

    await api
      .put(`/api/books/${booksAtStart[0].id}/lend`)
      .set('Authorization', `Bearer ${firstToken}`)
      .send({
        dueDate: dueDate.toISOString()
      })
      .expect(200)

    await api
      .put(`/api/books/${booksAtStart[0].id}/lend`)
      .set('Authorization', `Bearer ${secondToken}`)
      .send({
        dueDate: dueDate.toISOString()
      })
      .expect(400)
  })

  test('borrower can return a lent book successfully', async () => {
    const usersAtStart = await helper.usersInDb()
    const booksAtStart = await helper.booksInDb()
    const borrower = usersAtStart.find(u => u.id !== booksAtStart[0].user)
    const token = await helper.getTokenForUser(borrower.username)
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 14)

    await api
      .put(`/api/books/${booksAtStart[0].id}/lend`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        dueDate: dueDate.toISOString()
      })
      .expect(200)

    const response = await api
      .put(`/api/books/${booksAtStart[0].id}/return`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect('Content-Type', /application\/json/)

    assert.strictEqual(response.body.lending.isLent, false)
    assert.strictEqual(response.body.lending.borrower, null)
    assert.strictEqual(response.body.lending.lentDate, null)
    assert.strictEqual(response.body.lending.dueDate, null)

    const booksAtEnd = await helper.booksInDb()
    const returnedBook = booksAtEnd.find(b => b.id === booksAtStart[0].id)
    assert.strictEqual(returnedBook.lending.isLent, false)
  })

  test('cannot return non-lent book', async () => {
    const usersAtStart = await helper.usersInDb()
    const booksAtStart = await helper.booksInDb()

    const anyUser = usersAtStart[0]
    const token = await helper.getTokenForUser(anyUser.username)

    await api
      .put(`/api/books/${booksAtStart[0].id}/return`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400)
  })

  test('only borrower can return the book', async () => {
    const usersAtStart = await helper.usersInDb()
    const booksAtStart = await helper.booksInDb()

    const borrower = usersAtStart[0]
    const otherUser = usersAtStart[1]
    const borrowerToken = await helper.getTokenForUser(borrower.username)
    const otherUserToken = await helper.getTokenForUser(otherUser.username)

    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 14)

    await api
      .put(`/api/books/${booksAtStart[0].id}/lend`)
      .set('Authorization', `Bearer ${borrowerToken}`)
      .send({
        dueDate: dueDate.toISOString()
      })
      .expect(200)

    await api
      .put(`/api/books/${booksAtStart[0].id}/return`)
      .set('Authorization', `Bearer ${otherUserToken}`)
      .expect(403)
  })

  test('lending requires dueDate', async () => {
    const usersAtStart = await helper.usersInDb()
    const booksAtStart = await helper.booksInDb()
    const anyUser = usersAtStart[0]
    const token = await helper.getTokenForUser(anyUser.username)

    await api
      .put(`/api/books/${booksAtStart[0].id}/lend`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400)
  })

  test('check lending fields are populated correctly', async () => {
    const usersAtStart = await helper.usersInDb()
    const booksAtStart = await helper.booksInDb()

    const borrower = usersAtStart.find(u => u.id !== booksAtStart[0].user)
    const token = await helper.getTokenForUser(borrower.username)

    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 14)
    const lentDateBefore = new Date()

    const response = await api
      .put(`/api/books/${booksAtStart[0].id}/lend`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        dueDate: dueDate.toISOString()
      })
      .expect(200)

    const lentDateAfter = new Date()

    assert.strictEqual(response.body.lending.isLent, true)
    assert.strictEqual(response.body.lending.borrower, borrower.id)

    const actualLentDate = new Date(response.body.lending.lentDate)
    assert(actualLentDate >= lentDateBefore && actualLentDate <= lentDateAfter)

    const actualDueDate = new Date(response.body.lending.dueDate)
    assert.strictEqual(actualDueDate.getTime(), dueDate.getTime())
  })

  test('lending creates history entry', async () => {
    const usersAtStart = await helper.usersInDb()
    const booksAtStart = await helper.booksInDb()

    const borrower = usersAtStart.find(u => u.id !== booksAtStart[0].user)
    const token = await helper.getTokenForUser(borrower.username)

    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 14)

    const response = await api
      .put(`/api/books/${booksAtStart[0].id}/lend`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        dueDate: dueDate.toISOString()
      })
      .expect(200)

    assert(response.body.lendingHistory)
    assert.strictEqual(response.body.lendingHistory.length, 1)

    const historyEntry = response.body.lendingHistory[0]
    assert.strictEqual(historyEntry.borrower, borrower.id)
    assert.strictEqual(historyEntry.isReturned, false)
    assert.strictEqual(historyEntry.returnedDate, null)
    assert(historyEntry.lentDate)
    assert(historyEntry.dueDate)
  })

  test('returning completes history entry', async () => {
    const usersAtStart = await helper.usersInDb()
    const booksAtStart = await helper.booksInDb()

    const borrower = usersAtStart.find(u => u.id !== booksAtStart[0].user)
    const token = await helper.getTokenForUser(borrower.username)

    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 14)

    await api
      .put(`/api/books/${booksAtStart[0].id}/lend`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        dueDate: dueDate.toISOString()
      })
      .expect(200)

    const response = await api
      .put(`/api/books/${booksAtStart[0].id}/return`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    assert.strictEqual(response.body.lendingHistory.length, 1)

    const historyEntry = response.body.lendingHistory[0]
    assert.strictEqual(historyEntry.borrower, borrower.id)
    assert.strictEqual(historyEntry.isReturned, true)
    assert(historyEntry.returnedDate)
    assert(historyEntry.lentDate)
    assert(historyEntry.dueDate)
  })

  test('multiple lending cycles create separate history entries', async () => {
    const usersAtStart = await helper.usersInDb()
    const booksAtStart = await helper.booksInDb()

    const firstBorrower = usersAtStart[0]
    const secondBorrower = usersAtStart[1]
    const firstToken = await helper.getTokenForUser(firstBorrower.username)
    const secondToken = await helper.getTokenForUser(secondBorrower.username)

    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 14)

    await api
      .put(`/api/books/${booksAtStart[0].id}/lend`)
      .set('Authorization', `Bearer ${firstToken}`)
      .send({
        dueDate: dueDate.toISOString()
      })
      .expect(200)

    await api
      .put(`/api/books/${booksAtStart[0].id}/return`)
      .set('Authorization', `Bearer ${firstToken}`)
      .expect(200)

    await api
      .put(`/api/books/${booksAtStart[0].id}/lend`)
      .set('Authorization', `Bearer ${secondToken}`)
      .send({
        dueDate: dueDate.toISOString()
      })
      .expect(200)

    const response = await api
      .put(`/api/books/${booksAtStart[0].id}/return`)
      .set('Authorization', `Bearer ${secondToken}`)
      .expect(200)

    assert.strictEqual(response.body.lendingHistory.length, 2)

    const firstEntry = response.body.lendingHistory[0]
    const secondEntry = response.body.lendingHistory[1]

    assert.strictEqual(firstEntry.borrower, firstBorrower.id)
    assert.strictEqual(firstEntry.isReturned, true)
    assert(firstEntry.returnedDate)

    assert.strictEqual(secondEntry.borrower, secondBorrower.id)
    assert.strictEqual(secondEntry.isReturned, true)
    assert(secondEntry.returnedDate)
  })

  test('history tracks unreturned books', async () => {
    const usersAtStart = await helper.usersInDb()
    const booksAtStart = await helper.booksInDb()

    const borrower = usersAtStart.find(u => u.id !== booksAtStart[0].user)
    const token = await helper.getTokenForUser(borrower.username)

    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 14)

    const response = await api
      .put(`/api/books/${booksAtStart[0].id}/lend`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        dueDate: dueDate.toISOString()
      })
      .expect(200)

    const historyEntry = response.body.lendingHistory[0]
    assert.strictEqual(historyEntry.borrower, borrower.id)
    assert.strictEqual(historyEntry.isReturned, false)
    assert.strictEqual(historyEntry.returnedDate, null)

    const booksAtEnd = await helper.booksInDb()
    const bookWithHistory = booksAtEnd.find(b => b.id === booksAtStart[0].id)
    const unreturnedEntries = bookWithHistory.lendingHistory.filter(entry => !entry.isReturned)

    assert.strictEqual(unreturnedEntries.length, 1)
    assert.strictEqual(unreturnedEntries[0].borrower.toString(), borrower.id)
  })
})

after(async () => {
  await mongoose.connection.close()
})