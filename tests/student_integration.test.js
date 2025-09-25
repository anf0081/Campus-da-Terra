require('dotenv').config()
process.env.NODE_ENV = 'test'
const { test, describe, after, beforeEach, before } = require('node:test')
const assert = require('node:assert')
const mongoose = require('mongoose')
const config = require('../utils/config')
const Student = require('../models/student')
const User = require('../models/user')
const helper = require('./test_helper')
const bcrypt = require('bcrypt')

before(async () => {
  await mongoose.connect(config.MONGODB_URI)
})

describe('Student Integration Tests', () => {
  beforeEach(async () => {
    await Student.deleteMany({})
    await User.deleteMany({
      username: { $in: ['integrationuser1', 'integrationuser2', 'validationuser', 'enumuser'] }
    })
  })

  test('complete student lifecycle with user relationship', async () => {
    const passwordHash = await bcrypt.hash('password', 10)
    const user = new User({
      username: 'integrationuser1',
      name: 'Integration User',
      passwordHash
    })
    const savedUser = await user.save()

    const completeStudentData = {
      userId: savedUser._id,
      firstName: 'Maria',
      middleName: 'Teresa',
      lastName: 'Silva',
      gender: 'Female',
      dateOfBirth: new Date('2010-05-15'),

      streetAddress: 'Rua das Flores, 123',
      city: 'Lisboa',
      postalCode: '1200-194',
      country: 'Portugal',
      nationality: 'Portuguese',
      passportNumber: 'PT987654321',
      passportExpiryDate: new Date('2032-05-15'),
      nifNumber: '123456789',

      primarySchoolStage: 'Ages 10-11',
      enrollmentLength: 'Multiple years (Residents)',
      enrollmentStartDate: new Date('2024-09-01'),
      siblings: true,
      currentSchoolInPortugal: false,
      firstLanguage: 'Portuguese',
      englishProficiency: 'Intermediate',
      englishReadingWriting: 'Beginner',
      portugueseLevel: 'Fluent',
      skillsHobbies: 'Piano, Swimming, Reading',
      strugglingSubjects: 'Mathematics',

      approach: 'Qualifications for higher education',
      curriculum: 'Mix and Match',
      curriculumSupplier: 'Cambridge International',
      curriculumNotes: 'Focus on IGCSE preparation with additional Portuguese literature',

      behavioralChallenges: false,
      learningDifferences: true,
      physicalLimitations: false,
      healthConditions: false,
      dailyMedication: false,
      medicalTreatments: false,
      allergies: true,
      medicalDetails: 'Mild dyslexia, allergic to nuts',

      referralSource: 'School fair',
      motivationForJoining: ['Alternative / more holistic education', 'Democratic / self-directed learning approach'],
      photoConsent: true,
      contactListConsent: false
    }

    const student = new Student(completeStudentData)
    const savedStudent = await student.save()

    await User.findByIdAndUpdate(savedUser._id,
      { $push: { students: savedStudent._id } },
      { new: true }
    )

    const userWithStudents = await User.findById(savedUser._id).populate('students')
    const studentWithUser = await Student.findById(savedStudent._id).populate('userId')

    assert(userWithStudents, 'User should exist after saving')
    assert.strictEqual(userWithStudents.students.length, 1)
    assert.strictEqual(userWithStudents.students[0].firstName, 'Maria')
    assert.strictEqual(userWithStudents.students[0].approach, 'Qualifications for higher education')
    assert.strictEqual(userWithStudents.students[0].curriculumSupplier, 'Cambridge International')

    assert.strictEqual(studentWithUser.userId.username, 'integrationuser1')
    assert.strictEqual(studentWithUser.learningDifferences, true)
    assert.strictEqual(studentWithUser.allergies, true)
    assert.strictEqual(studentWithUser.medicalDetails, 'Mild dyslexia, allergic to nuts')
  })

  test('multiple students with different educational approaches', async () => {
    const passwordHash = await bcrypt.hash('password', 10)
    const user = new User({
      username: 'integrationuser2',
      name: 'Multi Student Parent',
      passwordHash
    })
    const savedUser = await user.save()

    const students = [
      {
        userId: savedUser._id,
        firstName: 'João',
        lastName: 'Santos',
        dateOfBirth: new Date('2008-03-20'),
        streetAddress: 'Av. da República, 456',
        city: 'Porto',
        postalCode: '4000-195',
        country: 'Portugal',
        nationality: 'Portuguese',
        passportNumber: 'PT111222333',
        passportExpiryDate: new Date('2031-03-20'),
        approach: 'Unschooling',
        curriculum: 'Online School',
        curriculumSupplier: 'Khan Academy',
        primarySchoolStage: 'Ages 11-12'
      },
      {
        userId: savedUser._id,
        firstName: 'Ana',
        lastName: 'Santos',
        dateOfBirth: new Date('2012-07-10'),
        streetAddress: 'Av. da República, 456',
        city: 'Porto',
        postalCode: '4000-195',
        country: 'Portugal',
        nationality: 'Portuguese',
        passportNumber: 'PT444555666',
        passportExpiryDate: new Date('2033-07-10'),
        approach: 'Core Education',
        curriculum: 'Workbook Curriculum',
        curriculumSupplier: 'Oxford University Press',
        primarySchoolStage: 'Ages 9-10'
      },
      {
        userId: savedUser._id,
        firstName: 'Pedro',
        lastName: 'Santos',
        dateOfBirth: new Date('2014-11-05'),
        streetAddress: 'Av. da República, 456',
        city: 'Porto',
        postalCode: '4000-195',
        country: 'Portugal',
        nationality: 'Portuguese',
        passportNumber: 'PT777888999',
        passportExpiryDate: new Date('2035-11-05'),
        approach: 'Qualifications for higher education',
        curriculum: 'Mix and Match',
        curriculumNotes: 'Combining online resources with traditional textbooks',
        primarySchoolStage: 'Ages 7-8'
      }
    ]

    const savedStudents = []
    for (const studentData of students) {
      const student = new Student(studentData)
      const savedStudent = await student.save()
      savedStudents.push(savedStudent)
    }

    const studentIds = savedStudents.map(s => s._id)
    await User.findByIdAndUpdate(savedUser._id,
      { $push: { students: { $each: studentIds } } },
      { new: true }
    )

    const userWithAllStudents = await User.findById(savedUser._id).populate('students')
    assert(userWithAllStudents, 'User should exist after saving students')

    assert.strictEqual(userWithAllStudents.students.length, 3)

    const approaches = userWithAllStudents.students.map(s => s.approach)
    assert(approaches.includes('Unschooling'))
    assert(approaches.includes('Core Education'))
    assert(approaches.includes('Qualifications for higher education'))

    const curricula = userWithAllStudents.students.map(s => s.curriculum)
    assert(curricula.includes('Online School'))
    assert(curricula.includes('Workbook Curriculum'))
    assert(curricula.includes('Mix and Match'))

    const studentsInDatabase = await helper.studentsInDb()
    assert.strictEqual(studentsInDatabase.length, 3)
  })

  test('student data validation with real-world scenarios', async () => {
    const passwordHash = await bcrypt.hash('password', 10)
    const user = new User({
      username: 'validationuser',
      name: 'Validation Test User',
      passwordHash
    })
    const savedUser = await user.save()

    const scenarios = [
      {
        name: 'Portuguese student with Portuguese curriculum',
        data: {
          userId: savedUser._id,
          firstName: 'Luísa',
          lastName: 'Fernandes',
          dateOfBirth: new Date('2011-01-15'),
          streetAddress: 'Rua do Ouro, 789',
          city: 'Coimbra',
          postalCode: '3000-123',
          country: 'Portugal',
          nationality: 'Portuguese',
          passportNumber: 'PT123789456',
          passportExpiryDate: new Date('2032-01-15'),
          firstLanguage: 'Portuguese',
          portugueseLevel: 'Fluent',
          englishProficiency: 'Beginner',
          approach: 'Core Education',
          curriculum: 'Workbook Curriculum',
          curriculumSupplier: 'Porto Editora'
        },
        expectedValid: true
      },
      {
        name: 'International student',
        data: {
          userId: savedUser._id,
          firstName: 'Sophie',
          lastName: 'Johnson',
          dateOfBirth: new Date('2009-12-03'),
          streetAddress: 'International School Campus',
          city: 'Cascais',
          postalCode: '2750-001',
          country: 'Portugal',
          nationality: 'British',
          passportNumber: 'GB987654321',
          passportExpiryDate: new Date('2030-12-03'),
          firstLanguage: 'English',
          portugueseLevel: 'Beginner',
          englishProficiency: 'Fluent',
          approach: 'Qualifications for higher education',
          curriculum: 'Online School',
          curriculumSupplier: 'British International School'
        },
        expectedValid: true
      }
    ]

    for (const scenario of scenarios) {
      const student = new Student(scenario.data)

      if (scenario.expectedValid) {
        const savedStudent = await student.save()
        assert(savedStudent._id)
        assert.strictEqual(savedStudent.firstName, scenario.data.firstName)
        assert.strictEqual(savedStudent.approach, scenario.data.approach)

        await Student.findByIdAndDelete(savedStudent._id)
      }
    }
  })

  test('enum validation covers all specified options', async () => {
    const passwordHash = await bcrypt.hash('password', 10)
    const user = new User({
      username: 'enumuser',
      name: 'Enum Test User',
      passwordHash
    })
    const savedUser = await user.save()

    const baseStudentData = {
      userId: savedUser._id,
      firstName: 'Test',
      lastName: 'Student',
      dateOfBirth: new Date('2010-01-01'),
      streetAddress: 'Test Address',
      city: 'Test City',
      postalCode: '0000-000',
      country: 'Portugal',
      nationality: 'Portuguese',
      passportNumber: 'PT000000000',
      passportExpiryDate: new Date('2030-01-01')
    }

    const approachOptions = ['Unschooling', 'Core Education', 'Qualifications for higher education']
    const curriculumOptions = ['Online School', 'Workbook Curriculum', 'Mix and Match']

    let testCount = 0
    for (const approach of approachOptions) {
      for (const curriculum of curriculumOptions) {
        const studentData = {
          ...baseStudentData,
          firstName: `Test${testCount++}`,
          approach,
          curriculum
        }

        const student = new Student(studentData)
        const savedStudent = await student.save()

        assert.strictEqual(savedStudent.approach, approach)
        assert.strictEqual(savedStudent.curriculum, curriculum)

        await Student.findByIdAndDelete(savedStudent._id)
      }
    }

    assert.strictEqual(testCount, 9)
  })
})

after(async () => {
  await mongoose.connection.close()
})