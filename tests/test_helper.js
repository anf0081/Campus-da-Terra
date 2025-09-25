const Book = require('../models/book')
const User = require('../models/user')
const Student = require('../models/student')
const jwt = require('jsonwebtoken')

const initialUsers = [
  {
    'username': 'user1',
    'name': 'User One',
    'passwordHash': 'hashedpassword1',
    'id': '68a85899a65fe6f0ed985f2a',
    books: []
  },
  {
    'username': 'user2',
    'name': 'User Two',
    'passwordHash': 'hashedpassword2',
    'id': '68a858bddb9a04ae143e0f01',
    books: []
  }
]

const initialBooks = [
  {
    'title': 'Book Title 1',
    'author': 'Author 1',
    'url': 'https://book-url1.com',
    'user': '68a85899a65fe6f0ed985f2a'
  },
  {
    'title': 'Book Title 2',
    'author': 'Author 2',
    'url': 'https://book-url3.com',
    'user': '68a858bddb9a04ae143e0f01'
  }
]

const booksInDb = async () => {
  const books = await Book.find({})
  return books.map(book => book.toJSON())
}

const usersInDb = async () => {
  const users = await User.find({})
  return users.map(user => user.toJSON())
}

const studentsInDb = async () => {
  const students = await Student.find({})
  return students.map(student => student.toJSON())
}

const getTokenForUser = async (username) => {
  const user = await User.findOne({ username })
  const userForToken = {
    username: user.username,
    id: user._id,
  }
  return jwt.sign(userForToken, process.env.SECRET)
}

const initialStudents = [
  {
    firstName: 'Test',
    lastName: 'Student',
    dateOfBirth: new Date('2010-01-01'),
    streetAddress: '123 Test St',
    city: 'Test City',
    postalCode: '1000-001',
    country: 'Portugal',
    nationality: 'Portuguese',
    passportNumber: 'PT000000',
    passportExpiryDate: new Date('2030-01-01'),
    approach: 'Core Education',
    curriculum: 'Online School'
  }
]

module.exports = {
  initialBooks, booksInDb, initialUsers, usersInDb, getTokenForUser,
  initialStudents, studentsInDb
}