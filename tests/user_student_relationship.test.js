require('dotenv').config()
process.env.NODE_ENV = 'test'
const { test, describe, after, beforeEach, before } = require('node:test')
const assert = require('node:assert')
const mongoose = require('mongoose')
const config = require('../utils/config')
const Student = require('../models/student')
const User = require('../models/user')
const bcrypt = require('bcrypt')

before(async () => {
  await mongoose.connect(config.MONGODB_URI)
})

describe('User-Student relationship', () => {
  let testUser1, testUser2

  beforeEach(async () => {
    await Student.deleteMany({})
    await User.deleteMany({
      username: { $in: ['testuser1', 'testuser2'] }
    })

    const passwordHash = await bcrypt.hash('password', 10)
    testUser1 = new User({ username: 'testuser1', passwordHash })
    testUser2 = new User({ username: 'testuser2', passwordHash })

    await testUser1.save()
    await testUser2.save()
  })

  test('user can have multiple students', async () => {
    const student1Data = {
      userId: testUser1._id,
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: new Date('2010-01-01'),
      streetAddress: '123 Main St',
      city: 'Lisbon',
      postalCode: '1000-001',
      country: 'Portugal',
      nationality: 'Portuguese',
      passportNumber: 'PT123456',
      passportExpiryDate: new Date('2030-01-01'),
      approach: 'Core Education',
      curriculum: 'Online School'
    }

    const student2Data = {
      userId: testUser1._id,
      firstName: 'Jane',
      lastName: 'Doe',
      dateOfBirth: new Date('2012-01-01'),
      streetAddress: '123 Main St',
      city: 'Lisbon',
      postalCode: '1000-001',
      country: 'Portugal',
      nationality: 'Portuguese',
      passportNumber: 'PT654321',
      passportExpiryDate: new Date('2030-01-01'),
      approach: 'Unschooling',
      curriculum: 'Mix and Match'
    }

    const student1 = new Student(student1Data)
    const student2 = new Student(student2Data)

    const savedStudent1 = await student1.save()
    const savedStudent2 = await student2.save()

    await User.findByIdAndUpdate(testUser1._id,
      { $push: { students: { $each: [savedStudent1._id, savedStudent2._id] } } },
      { new: true }
    )

    const userWithStudents = await User.findById(testUser1._id).populate('students')
    assert(userWithStudents, 'User should exist after adding students')

    assert.strictEqual(userWithStudents.students.length, 2)
    assert.strictEqual(userWithStudents.students[0].firstName, 'John')
    assert.strictEqual(userWithStudents.students[1].firstName, 'Jane')
  })

  test('student belongs to exactly one user', async () => {
    const studentData = {
      userId: testUser1._id,
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: new Date('2010-01-01'),
      streetAddress: '123 Main St',
      city: 'Lisbon',
      postalCode: '1000-001',
      country: 'Portugal',
      nationality: 'Portuguese',
      passportNumber: 'PT123456',
      passportExpiryDate: new Date('2030-01-01'),
      approach: 'Core Education',
      curriculum: 'Online School'
    }

    const student = new Student(studentData)
    const savedStudent = await student.save()

    const studentWithUser = await Student.findById(savedStudent._id).populate('userId')

    assert(studentWithUser, 'Student should exist')
    assert(studentWithUser.userId, 'Student should have a userId reference')

    const userStillExists = await User.findById(testUser1._id)
    assert(userStillExists, 'User should still exist when checking student reference')
    assert.strictEqual(studentWithUser.userId.username, 'testuser1')
    assert.strictEqual(studentWithUser.userId._id.toString(), testUser1._id.toString())
  })

  test('different users can have their own students', async () => {
    const student1Data = {
      userId: testUser1._id,
      firstName: 'Alice',
      lastName: 'Smith',
      dateOfBirth: new Date('2010-01-01'),
      streetAddress: '123 Main St',
      city: 'Lisbon',
      postalCode: '1000-001',
      country: 'Portugal',
      nationality: 'Portuguese',
      passportNumber: 'PT111111',
      passportExpiryDate: new Date('2030-01-01'),
      approach: 'Core Education',
      curriculum: 'Online School'
    }

    const student2Data = {
      userId: testUser2._id,
      firstName: 'Bob',
      lastName: 'Johnson',
      dateOfBirth: new Date('2011-01-01'),
      streetAddress: '456 Oak Ave',
      city: 'Porto',
      postalCode: '4000-001',
      country: 'Portugal',
      nationality: 'Portuguese',
      passportNumber: 'PT222222',
      passportExpiryDate: new Date('2030-01-01'),
      approach: 'Unschooling',
      curriculum: 'Workbook Curriculum'
    }

    const student1 = new Student(student1Data)
    const student2 = new Student(student2Data)

    const savedStudent1 = await student1.save()
    const savedStudent2 = await student2.save()

    await User.findByIdAndUpdate(testUser1._id,
      { $push: { students: savedStudent1._id } },
      { new: true }
    )
    await User.findByIdAndUpdate(testUser2._id,
      { $push: { students: savedStudent2._id } },
      { new: true }
    )

    const user1WithStudents = await User.findById(testUser1._id).populate('students')
    const user2WithStudents = await User.findById(testUser2._id).populate('students')

    assert(user1WithStudents, 'User1 should exist after adding students')
    assert(user2WithStudents, 'User2 should exist after adding students')

    assert.strictEqual(user1WithStudents.students.length, 1)
    assert.strictEqual(user2WithStudents.students.length, 1)
    assert.strictEqual(user1WithStudents.students[0].firstName, 'Alice')
    assert.strictEqual(user2WithStudents.students[0].firstName, 'Bob')
  })

  test('can query students by user', async () => {
    const studentData = {
      userId: testUser1._id,
      firstName: 'Charlie',
      lastName: 'Brown',
      dateOfBirth: new Date('2009-01-01'),
      streetAddress: '789 Pine St',
      city: 'Braga',
      postalCode: '4700-001',
      country: 'Portugal',
      nationality: 'Portuguese',
      passportNumber: 'PT333333',
      passportExpiryDate: new Date('2030-01-01'),
      approach: 'Qualifications for higher education',
      curriculum: 'Mix and Match'
    }

    const student = new Student(studentData)
    await student.save()

    const studentsForUser1 = await Student.find({ userId: testUser1._id })
    const studentsForUser2 = await Student.find({ userId: testUser2._id })

    assert.strictEqual(studentsForUser1.length, 1)
    assert.strictEqual(studentsForUser2.length, 0)
    assert.strictEqual(studentsForUser1[0].firstName, 'Charlie')
  })

  test('deleting user does not cascade delete students (orphan protection)', async () => {
    const studentData = {
      userId: testUser1._id,
      firstName: 'David',
      lastName: 'Wilson',
      dateOfBirth: new Date('2008-01-01'),
      streetAddress: '321 Elm St',
      city: 'Coimbra',
      postalCode: '3000-001',
      country: 'Portugal',
      nationality: 'Portuguese',
      passportNumber: 'PT444444',
      passportExpiryDate: new Date('2030-01-01'),
      approach: 'Core Education',
      curriculum: 'Online School'
    }

    const student = new Student(studentData)
    const savedStudent = await student.save()

    await User.findByIdAndDelete(testUser1._id)

    const orphanStudent = await Student.findById(savedStudent._id)
    assert(orphanStudent)
    assert.strictEqual(orphanStudent.firstName, 'David')
  })

  test('user toJSON transformation includes students array', async () => {
    const user = await User.findById(testUser1._id)
    assert(user, 'User should exist for toJSON test')
    const userJSON = user.toJSON()

    assert(Array.isArray(userJSON.students))
    assert.strictEqual(userJSON.students.length, 0)
    assert(!userJSON._id)
    assert(!userJSON.__v)
    assert(!userJSON.passwordHash)
    assert(userJSON.id)
  })

  test('student toJSON transformation works correctly', async () => {
    const studentData = {
      userId: testUser1._id,
      firstName: 'Emma',
      lastName: 'Davis',
      dateOfBirth: new Date('2011-01-01'),
      streetAddress: '654 Maple Ave',
      city: 'Faro',
      postalCode: '8000-001',
      country: 'Portugal',
      nationality: 'Portuguese',
      passportNumber: 'PT555555',
      passportExpiryDate: new Date('2030-01-01'),
      approach: 'Unschooling',
      curriculum: 'Workbook Curriculum'
    }

    const student = new Student(studentData)
    const savedStudent = await student.save()
    const studentJSON = savedStudent.toJSON()

    assert.strictEqual(studentJSON.firstName, 'Emma')
    assert.strictEqual(studentJSON.approach, 'Unschooling')
    assert(!studentJSON._id)
    assert(!studentJSON.__v)
    assert(studentJSON.id)
  })
})

after(async () => {
  await mongoose.connection.close()
})