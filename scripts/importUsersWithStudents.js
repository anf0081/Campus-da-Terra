const mongoose = require('mongoose')
const bcrypt = require('bcrypt')
const config = require('../utils/config')
const User = require('../models/user')
const Student = require('../models/student')
const fs = require('fs')
const path = require('path')

const sampleData = [
  {
    user: {
      username: 'john_doe',
      password: 'doe123',
      email: 'john.doe@example.com',
      role: 'user',
      name: 'John Doe',
      contactNumber: '+1234567890',
      parentNationality: 'Portuguese',
      parentPassportNumber: 'PT123456789',
      parentPassportExpiryDate: '2025-12-31',
      parentNifNumber: '123456789',
      parentStreetAddress: '123 Main Street',
      parentCity: 'Lisbon',
      parentPostalCode: '1000-001',
      parentCountry: 'Portugal',
      emergencyContactRelationship: 'Mother',
      emergencyContactName: 'Jane Doe',
      emergencyContactNumber: '+1234567891'
    },
    students: [
      {
        firstName: 'Alice',
        middleName: '',
        lastName: 'Doe',
        gender: 'Female',
        dateOfBirth: '2010-05-15',
        streetAddress: '123 Main Street',
        city: 'Lisbon',
        postalCode: '1000-001',
        country: 'Portugal',
        nationality: 'Portuguese',
        passportNumber: 'PT987654321',
        passportExpiryDate: '2025-12-31',
        nifNumber: '',
        enrollmentLength: '1 year (Residents)',
        weekdayAttendance: '5 days/week',
        enrollmentStartDate: '',
        siblings: false,
        firstLanguage: '',
        englishProficiency: 'No prior knowledge',
        englishReadingWriting: 'No prior knowledge',
        portugueseLevel: 'No prior knowledge'
      }
    ]
  }
]

const generateUsername = (firstName, lastName) => {
  const cleanFirst = firstName.toLowerCase().replace(/[^a-z]/g, '')
  const cleanLast = lastName.toLowerCase().replace(/[^a-z]/g, '')
  return `${cleanFirst}_${cleanLast}`
}

const generatePassword = (lastName) => {
  const cleanLast = lastName.toLowerCase().replace(/[^a-z]/g, '')
  return `${cleanLast}123`
}

const importUsersWithStudents = async (data) => {
  try {
    console.log('Connecting to MongoDB...')
    await mongoose.connect(config.MONGODB_URI)
    console.log('Connected to MongoDB')

    const results = {
      usersCreated: 0,
      usersSkipped: 0,
      studentsCreated: 0,
      errors: []
    }

    const createdUsers = new Map()

    for (const familyData of data) {
      try {
        const { user: userData, students } = familyData
        let userInfo, username, password

        if (userData) {
          userInfo = userData
          username = userData.username || generateUsername(userData.name?.split(' ')[0] || '', userData.name?.split(' ')[1] || '')
          password = userData.password || generatePassword(userData.name?.split(' ')[1] || '')
        } else if (familyData.parent) {
          const parent = familyData.parent
          username = generateUsername(parent.firstName, parent.lastName)
          password = generatePassword(parent.lastName)
          userInfo = {
            username: username,
            password: password,
            email: parent.email,
            role: 'user',
            name: `${parent.firstName} ${parent.lastName}`,
            contactNumber: parent.contactNumber,
            parentNationality: parent.nationality,
            parentPassportNumber: parent.passportNumber,
            parentPassportExpiryDate: parent.passportExpiryDate,
            parentNifNumber: parent.nifNumber,
            parentStreetAddress: parent.streetAddress,
            parentCity: parent.city,
            parentPostalCode: parent.postalCode,
            parentCountry: parent.country,
            emergencyContactRelationship: parent.emergencyContactRelationship,
            emergencyContactName: parent.emergencyContactName,
            emergencyContactNumber: parent.emergencyContactNumber
          }
        } else {
          throw new Error('Invalid data format: missing user or parent information')
        }

        console.log(`Processing family: ${userInfo.name}`)
        console.log(`Username: ${username}, password: ${password}`)

        let user

        const userKey = `${userInfo.name?.toLowerCase()}_${userInfo.email?.toLowerCase()}`

        if (createdUsers.has(userKey)) {
          user = createdUsers.get(userKey)
          console.log(`Using existing user: ${username}`)
          results.usersSkipped++
        } else {
          const existingUser = await User.findOne({
            $or: [
              { username: username },
              { email: userInfo.email }
            ]
          })

          if (existingUser) {
            console.log(`User already exists: ${username}`)
            user = existingUser
            results.usersSkipped++
          } else {
            const passwordHash = await bcrypt.hash(password, 10)

            user = new User({
              username: username,
              name: userInfo.name,
              passwordHash: passwordHash,
              email: userInfo.email,
              role: userInfo.role || 'user',
              contactNumber: userInfo.contactNumber,
              parentNationality: userInfo.parentNationality,
              parentPassportNumber: userInfo.parentPassportNumber,
              parentPassportExpiryDate: userInfo.parentPassportExpiryDate ? new Date(userInfo.parentPassportExpiryDate) : null,
              parentNifNumber: userInfo.parentNifNumber,
              parentStreetAddress: userInfo.parentStreetAddress,
              parentCity: userInfo.parentCity,
              parentPostalCode: userInfo.parentPostalCode,
              parentCountry: userInfo.parentCountry,
              emergencyContactRelationship: userInfo.emergencyContactRelationship,
              emergencyContactName: userInfo.emergencyContactName,
              emergencyContactNumber: userInfo.emergencyContactNumber
            })

            await user.save()
            console.log(`✅ Created user: ${username}`)
            results.usersCreated++
          }

          createdUsers.set(userKey, user)
        }
        for (const studentData of students) {
          try {
            const existingStudent = await Student.findOne({
              firstName: studentData.firstName,
              lastName: studentData.lastName,
              dateOfBirth: new Date(studentData.dateOfBirth),
              userId: user._id
            })

            if (existingStudent) {
              console.log(`Student already exists: ${studentData.firstName} ${studentData.lastName}`)
              continue
            }

            const student = new Student({
              userId: user._id,
              firstName: studentData.firstName,
              middleName: studentData.middleName || '',
              lastName: studentData.lastName,
              gender: studentData.gender || 'Other',
              dateOfBirth: new Date(studentData.dateOfBirth),
              streetAddress: studentData.streetAddress,
              city: studentData.city,
              postalCode: studentData.postalCode,
              country: studentData.country,
              nationality: studentData.nationality,
              passportNumber: studentData.passportNumber,
              passportExpiryDate: studentData.passportExpiryDate ? new Date(studentData.passportExpiryDate) : null,
              nifNumber: studentData.nifNumber || '',
              enrollmentLength: studentData.enrollmentLength || '1 year (Residents)',
              weekdayAttendance: studentData.weekdayAttendance || '5 days/week',
              enrollmentStartDate: studentData.enrollmentStartDate ? new Date(studentData.enrollmentStartDate) : null,
              siblings: studentData.siblings || false,
              firstLanguage: studentData.firstLanguage || '',
              englishProficiency: studentData.englishProficiency || 'No prior knowledge',
              englishReadingWriting: studentData.englishReadingWriting || 'No prior knowledge',
              portugueseLevel: studentData.portugueseLevel || 'No prior knowledge',
              skillsHobbies: studentData.skillsHobbies || '',
              strugglingSubjects: studentData.strugglingSubjects || '',
              allergies: studentData.allergies === true || studentData.allergies === 'true',
              behavioralChallenges: studentData.behavioralChallenges === true || studentData.behavioralChallenges === 'true',
              learningDifferences: studentData.learningDifferences === true || studentData.learningDifferences === 'true',
              physicalLimitations: studentData.physicalLimitations === true || studentData.physicalLimitations === 'true',
              healthConditions: studentData.healthConditions === true || studentData.healthConditions === 'true',
              dailyMedication: studentData.dailyMedication === true || studentData.dailyMedication === 'true',
              medicalTreatments: studentData.medicalTreatments === true || studentData.medicalTreatments === 'true',
              lifeThreatening: studentData.lifeThreatening === true || studentData.lifeThreatening === 'true'
            })

            await student.save()

            if (!user.students.includes(student._id)) {
              user.students.push(student._id)
              await user.save()
            }

            console.log(`✅ Created student: ${studentData.firstName} ${studentData.lastName}`)
            results.studentsCreated++

          } catch (studentError) {
            console.error(`❌ Error creating student ${studentData.firstName} ${studentData.lastName}:`, studentError.message)
            results.errors.push({
              type: 'student',
              name: `${studentData.firstName} ${studentData.lastName}`,
              error: studentError.message
            })
          }
        }

      } catch (familyError) {
        const familyName = familyData.user?.name ||
                          (familyData.parent ? `${familyData.parent.firstName} ${familyData.parent.lastName}` : 'Unknown Family')
        console.error(`❌ Error processing family ${familyName}:`, familyError.message)
        results.errors.push({
          type: 'family',
          name: familyName,
          error: familyError.message
        })
      }
    }

    console.log('\n🎉 Import completed!')
    console.log('📊 Results:')
    console.log(`   Users created: ${results.usersCreated}`)
    console.log(`   Users skipped: ${results.usersSkipped}`)
    console.log(`   Students created: ${results.studentsCreated}`)
    console.log(`   Errors: ${results.errors.length}`)

    if (results.errors.length > 0) {
      console.log('\n❌ Errors:')
      results.errors.forEach(error => {
        console.log(`   ${error.type}: ${error.name} - ${error.error}`)
      })
    }

    await mongoose.connection.close()
    console.log('Disconnected from MongoDB')

    return results

  } catch (error) {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  }
}

const loadDataFromFile = (filePath) => {
  try {
    const fullPath = path.resolve(filePath)
    if (!fs.existsSync(fullPath)) {
      console.error(`File not found: ${fullPath}`)
      return null
    }
    const data = fs.readFileSync(fullPath, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    console.error('Error reading data file:', error.message)
    return null
  }
}

const main = async () => {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.log('Usage: node importUsersWithStudents.js [data-file.json]')
    console.log('If no file is provided, sample data will be used.')
    console.log('')
    console.log('Expected JSON structure (using the combined template format):')
    console.log(JSON.stringify([sampleData[0]], null, 2))

    await importUsersWithStudents(sampleData)
  } else {
    const dataFile = args[0]
    const data = loadDataFromFile(dataFile)

    if (!data) {
      console.error('Failed to load data file')
      process.exit(1)
    }

    if (!Array.isArray(data)) {
      console.error('Data must be an array of family objects')
      process.exit(1)
    }

    await importUsersWithStudents(data)
  }
}

if (require.main === module) {
  main()
}

module.exports = { importUsersWithStudents, generateUsername, generatePassword }