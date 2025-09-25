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

describe('Student model', () => {
  let testUser

  beforeEach(async () => {
    await Student.deleteMany({})
    await User.deleteMany({
      username: 'testuser'
    })

    const passwordHash = await bcrypt.hash('password', 10)
    testUser = new User({ username: 'testuser', passwordHash })
    await testUser.save()
  })

  describe('Student creation and validation', () => {
    test('creates student with valid required fields', async () => {
      const validStudent = {
        userId: testUser._id,
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

      const student = new Student(validStudent)
      const savedStudent = await student.save()

      assert.strictEqual(savedStudent.firstName, 'John')
      assert.strictEqual(savedStudent.lastName, 'Doe')
      assert.strictEqual(savedStudent.approach, 'Core Education')
      assert.strictEqual(savedStudent.curriculum, 'Online School')
      assert(savedStudent._id)
      assert(savedStudent.createdAt)
    })

    test('fails to create student without required fields', async () => {
      const invalidStudent = new Student({
        firstName: 'John'
      })

      try {
        await invalidStudent.save()
        assert.fail('Should have thrown validation error')
      } catch (error) {
        assert(error.errors.userId)
        assert(error.errors.lastName)
        assert(error.errors.dateOfBirth)
      }
    })

    test('validates approach enum values', async () => {
      const studentData = {
        userId: testUser._id,
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
        approach: 'Invalid Approach',
        curriculum: 'Online School'
      }

      const student = new Student(studentData)

      try {
        await student.save()
        assert.fail('Should have thrown validation error for invalid approach')
      } catch (error) {
        assert(error.errors.approach)
        assert(error.errors.approach.message.includes('Invalid Approach'))
      }
    })

    test('validates curriculum enum values', async () => {
      const studentData = {
        userId: testUser._id,
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
        approach: 'Unschooling',
        curriculum: 'Invalid Curriculum'
      }

      const student = new Student(studentData)

      try {
        await student.save()
        assert.fail('Should have thrown validation error for invalid curriculum')
      } catch (error) {
        assert(error.errors.curriculum)
        assert(error.errors.curriculum.message.includes('Invalid Curriculum'))
      }
    })

    test('accepts all valid approach options', async () => {
      const approaches = ['Unschooling', 'Core Education', 'Qualifications for higher education']

      for (const approach of approaches) {
        const studentData = {
          userId: testUser._id,
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
          approach: approach,
          curriculum: 'Online School'
        }

        const student = new Student(studentData)
        const savedStudent = await student.save()

        assert.strictEqual(savedStudent.approach, approach)
        await Student.findByIdAndDelete(savedStudent._id)
      }
    })

    test('accepts all valid curriculum options', async () => {
      const curricula = ['Online School', 'Workbook Curriculum', 'Mix and Match']

      for (const curriculum of curricula) {
        const studentData = {
          userId: testUser._id,
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
          curriculum: curriculum
        }

        const student = new Student(studentData)
        const savedStudent = await student.save()

        assert.strictEqual(savedStudent.curriculum, curriculum)
        await Student.findByIdAndDelete(savedStudent._id)
      }
    })

    test('saves curriculum supplier and notes when provided', async () => {
      const studentData = {
        userId: testUser._id,
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
        curriculum: 'Mix and Match',
        curriculumSupplier: 'Khan Academy',
        curriculumNotes: 'Focusing on mathematics and science'
      }

      const student = new Student(studentData)
      const savedStudent = await student.save()

      assert.strictEqual(savedStudent.curriculumSupplier, 'Khan Academy')
      assert.strictEqual(savedStudent.curriculumNotes, 'Focusing on mathematics and science')
    })

    test('trims whitespace from name fields', async () => {
      const studentData = {
        userId: testUser._id,
        firstName: '  John  ',
        middleName: '  Michael  ',
        lastName: '  Doe  ',
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

      assert.strictEqual(savedStudent.firstName, 'John')
      assert.strictEqual(savedStudent.middleName, 'Michael')
      assert.strictEqual(savedStudent.lastName, 'Doe')
    })

    test('sets default values for boolean health fields', async () => {
      const studentData = {
        userId: testUser._id,
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

      assert.strictEqual(savedStudent.behavioralChallenges, false)
      assert.strictEqual(savedStudent.learningDifferences, false)
      assert.strictEqual(savedStudent.physicalLimitations, false)
      assert.strictEqual(savedStudent.healthConditions, false)
      assert.strictEqual(savedStudent.lifeThreatening, false)
      assert.strictEqual(savedStudent.photoConsent, false)
      assert.strictEqual(savedStudent.contactListConsent, false)
      assert.strictEqual(savedStudent.termsAndConditions, false)
      assert.strictEqual(savedStudent.personalDataConsent, false)
    })

    test('updates updatedAt timestamp on save', async () => {
      const studentData = {
        userId: testUser._id,
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
      const initialUpdatedAt = savedStudent.updatedAt

      await new Promise(resolve => setTimeout(resolve, 100))

      savedStudent.firstName = 'Jane'
      const updatedStudent = await savedStudent.save()

      assert(updatedStudent.updatedAt > initialUpdatedAt)
    })
  })
})

after(async () => {
  await mongoose.connection.close()
})