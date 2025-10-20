const bcrypt = require('bcrypt')
const usersRouter = require('express').Router()
const User = require('../models/user')
const Student = require('../models/student')
const { userExtractor } = require('../utils/middleware')
const { exportUsers, exportUsersWithStudents, exportAllData } = require('../utils/dataExport')
const { findUserDuplicates, mergeUserData, applyMerge, importAllData } = require('../utils/dataMerge')

// Password validation function
const validatePassword = (password) => {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters long'
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter'
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter'
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number'
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return 'Password must contain at least one special character (!@#$%^&*(),.?":{}|<>)'
  }
  return null // No error
}

usersRouter.get('/', userExtractor, async (request, response) => {
  try {
    if (request.user.role !== 'admin' && request.user.role !== 'tutor') {
      return response.status(403).json({ error: 'Permission denied - admin or tutor access required' })
    }

    const users = await User.find({ isArchived: { $ne: true } })
      .populate('books', { url: 1, title: 1, author: 1 })
      .populate('students')
    response.json(users)
  } catch {
    response.status(500).json({ error: 'Internal server error' })
  }
})


usersRouter.post('/', async (request, response) => {
  const {
    username,
    name,
    email,
    password,
    role,
    isGAMember,
    emailNotifications,
    contactNumber,
    parentStreetAddress,
    parentCity,
    parentPostalCode,
    parentCountry,
    parentNationality,
    parentPassportNumber,
    parentPassportExpiryDate,
    parentNifNumber,
    emergencyContactRelationship,
    emergencyContactName,
    emergencyContactNumber
  } = request.body

  const passwordError = validatePassword(password)
  if (passwordError) {
    return response.status(400).json({ error: passwordError })
  }

  if (!username || username.length < 3) {
    return response.status(400).json({ error: 'Username must be at least 3 characters long.' })
  }

  if (!email) {
    return response.status(400).json({ error: 'Email is required.' })
  }

  const existingUser = await User.findOne({ username })
  if (existingUser) {
    return response.status(400).json({ error: 'Username must be unique' })
  }

  const existingEmail = await User.findOne({ email })
  if (existingEmail) {
    return response.status(400).json({ error: 'Email must be unique' })
  }

  const saltRounds = 10
  const passwordHash = await bcrypt.hash(password, saltRounds)

  const user = new User({
    username,
    name,
    email,
    passwordHash,
    role,
    isGAMember: isGAMember || false,
    emailNotifications: emailNotifications !== undefined ? emailNotifications : true,
    contactNumber,
    parentStreetAddress,
    parentCity,
    parentPostalCode,
    parentCountry,
    parentNationality,
    parentPassportNumber,
    parentPassportExpiryDate,
    parentNifNumber,
    emergencyContactRelationship,
    emergencyContactName,
    emergencyContactNumber
  })

  try {
    const savedUser = await user.save()
    response.status(201).json(savedUser)
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.status(400).json({ error: error.message })
    }
    if (error.code === 11000) {
      if (error.keyPattern?.username) {
        return response.status(400).json({ error: 'Username must be unique' })
      }
      if (error.keyPattern?.email) {
        return response.status(400).json({ error: 'Email must be unique' })
      }
      return response.status(400).json({ error: 'Duplicate key error' })
    }
    throw error
  }
})

usersRouter.put('/:id', userExtractor, async (request, response) => {
  const {
    name,
    email,
    password,
    contactNumber,
    isGAMember,
    emailNotifications,
    parentStreetAddress,
    parentCity,
    parentPostalCode,
    parentCountry,
    parentNationality,
    parentPassportNumber,
    parentPassportExpiryDate,
    parentNifNumber,
    emergencyContactRelationship,
    emergencyContactName,
    emergencyContactNumber
  } = request.body

  try {
    if (request.user._id.toString() !== request.params.id && request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Permission denied' })
    }

    const updateData = {}
    if (name !== undefined) updateData.name = name
    if (email !== undefined) updateData.email = email

    if (password && password.trim()) {
      const passwordError = validatePassword(password)
      if (passwordError) {
        return response.status(400).json({ error: passwordError })
      }
      const saltRounds = 10
      updateData.passwordHash = await bcrypt.hash(password, saltRounds)
    }
    if (contactNumber !== undefined) updateData.contactNumber = contactNumber

    if (isGAMember !== undefined && request.user.role === 'admin') {
      updateData.isGAMember = isGAMember
    }

    if (parentStreetAddress !== undefined) updateData.parentStreetAddress = parentStreetAddress
    if (parentCity !== undefined) updateData.parentCity = parentCity
    if (parentPostalCode !== undefined) updateData.parentPostalCode = parentPostalCode
    if (parentCountry !== undefined) updateData.parentCountry = parentCountry
    if (parentNationality !== undefined) updateData.parentNationality = parentNationality
    if (parentPassportNumber !== undefined) updateData.parentPassportNumber = parentPassportNumber
    if (parentPassportExpiryDate !== undefined) updateData.parentPassportExpiryDate = parentPassportExpiryDate
    if (parentNifNumber !== undefined) updateData.parentNifNumber = parentNifNumber
    if (emergencyContactRelationship !== undefined) updateData.emergencyContactRelationship = emergencyContactRelationship
    if (emergencyContactName !== undefined) updateData.emergencyContactName = emergencyContactName
    if (emergencyContactNumber !== undefined) updateData.emergencyContactNumber = emergencyContactNumber
    if (emailNotifications !== undefined) updateData.emailNotifications = emailNotifications

    const updatedUser = await User.findByIdAndUpdate(
      request.params.id,
      updateData,
      { new: true, runValidators: true }
    )

    if (!updatedUser) {
      return response.status(404).json({ error: 'User not found' })
    }

    response.json(updatedUser)
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.status(400).json({ error: error.message })
    }
    if (error.code === 11000) {
      return response.status(400).json({ error: 'Email must be unique' })
    }
    response.status(500).json({ error: 'Internal server error' })
  }
})

usersRouter.delete('/:id', userExtractor, async (request, response) => {
  try {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Permission denied - admin access required' })
    }

    const userToDelete = await User.findById(request.params.id)
    if (!userToDelete) {
      return response.status(404).json({ error: 'User not found' })
    }

    if (request.user._id.toString() === request.params.id) {
      return response.status(400).json({ error: 'Cannot delete your own account' })
    }

    await User.findByIdAndDelete(request.params.id)
    response.status(204).end()
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return response.status(400).json({ error: 'Malformatted id' })
    }
    response.status(500).json({ error: 'Internal server error' })
  }
})

usersRouter.put('/:id/role', userExtractor, async (request, response) => {
  try {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Access denied. Admin required.' })
    }

    const { role } = request.body
    if (!role) {
      return response.status(400).json({ error: 'Role is required' })
    }

    const validRoles = ['user', 'admin', 'tutor']
    if (!validRoles.includes(role)) {
      return response.status(400).json({ error: `Invalid role. Valid roles are: ${validRoles.join(', ')}` })
    }

    const user = await User.findById(request.params.id)
    if (!user) {
      return response.status(404).json({ error: 'User not found' })
    }

    if (user.role === 'admin' && role !== 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' })
      if (adminCount <= 1) {
        return response.status(400).json({ error: 'Cannot remove the last admin from the system' })
      }
    }

    if (request.user._id.toString() === request.params.id && role !== user.role) {
      return response.status(400).json({ error: 'Cannot change your own role' })
    }

    const updatedUser = await User.findByIdAndUpdate(
      request.params.id,
      { role },
      { new: true, runValidators: true }
    ).populate('books', { url: 1, title: 1, author: 1 }).populate('students')

    response.json(updatedUser)
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return response.status(400).json({ error: 'Invalid user ID' })
    }
    response.status(500).json({ error: 'Internal server error' })
  }
})

usersRouter.put('/:id/ga-member', userExtractor, async (request, response) => {
  try {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Access denied. Admin required.' })
    }

    const { isGAMember } = request.body
    if (typeof isGAMember !== 'boolean') {
      return response.status(400).json({ error: 'isGAMember must be a boolean value' })
    }

    const user = await User.findById(request.params.id)
    if (!user) {
      return response.status(404).json({ error: 'User not found' })
    }

    const updatedUser = await User.findByIdAndUpdate(
      request.params.id,
      { isGAMember },
      { new: true, runValidators: true }
    ).populate('books', { url: 1, title: 1, author: 1 }).populate('students')

    response.json(updatedUser)
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return response.status(400).json({ error: 'Invalid user ID' })
    }
    response.status(500).json({ error: 'Internal server error' })
  }
})

usersRouter.get('/template', userExtractor, async (request, response) => {
  try {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Permission denied - admin access required' })
    }

    const template = {
      _documentation: {
        role: ['user', 'admin', 'tutor'],
        isGAMember: 'boolean - true if user is a General Assembly member'
      },
      username: '',
      password: '',
      email: '',
      role: 'user',
      name: '',
      contactNumber: '',
      parentNationality: '',
      parentPassportNumber: '',
      parentPassportExpiryDate: '',
      parentNifNumber: '',
      parentStreetAddress: '',
      parentCity: '',
      parentPostalCode: '',
      parentCountry: '',
      emergencyContactRelationship: '',
      emergencyContactName: '',
      emergencyContactNumber: ''
    }

    response.json(template)
  } catch {
    response.status(500).json({ error: 'Internal server error' })
  }
})

usersRouter.get('/template-with-students', userExtractor, async (request, response) => {
  try {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Permission denied - admin access required' })
    }

    const template = {
      _documentation: {
        'user.role': ['user', 'admin', 'tutor'],
        'user.isGAMember': 'boolean - true if user is a General Assembly member',
        'students[].gender': ['Male', 'Female', 'Other'],
        'students[].enrollmentLength': ['6 months (Residents)', '1 year (Residents)', 'Multiple years (Residents)', '1 month (Traveling family)', '2 months (Traveling Family)', '3 months (Traveling Family)'],
        'students[].weekdayAttendance': ['1 day/week', '2 days/week', '3 days/week', '4 days/week', '5 days/week'],
        'students[].englishProficiency': ['No prior knowledge', 'Beginner', 'Intermediate', 'Proficient', 'Fluent'],
        'students[].englishReadingWriting': ['No prior knowledge', 'Beginner', 'Intermediate', 'Advanced'],
        'students[].portugueseLevel': ['No prior knowledge', 'Beginner', 'Intermediate', 'Proficient', 'Fluent'],
        'students[].approach': ['Unschooling', 'Core Education', 'Qualifications for higher education', 'Other'],
        'students[].curriculum': ['Online School', 'Workbook Curriculum', 'Mix and Match', 'Other'],
        'students[].pricing': ['Residents', 'Financial Hardship', 'Traveling Families', 'Founding Member'],
        'students[].discount': ['Sibling Discount', 'Early Payment Discount', 'Referral Discount', 'Other', 'None'],
        'students[].paymentMethod': ['Bank Transfer', 'Cash', 'SEPA direct debit', 'MBWay', 'Stripe', 'Bitcoin', 'Other'],
        'students[].motivationForJoining': ['Alternative / more holistic education', 'Democratic / self-directed learning approach', 'To be part of a community', 'Quality of teachers', 'The values and culture of the school', 'The campus and natural environment', 'A sense of adventure / Madeira', 'Traveling family looking for short-term enrollments', 'Other'],
        note: 'Students userId field will be automatically set to the created user ID'
      },
      user: {
        username: '',
        password: '',
        email: '',
        role: 'user',
        name: '',
        contactNumber: '',
        parentNationality: '',
        parentPassportNumber: '',
        parentPassportExpiryDate: '',
        parentNifNumber: '',
        parentStreetAddress: '',
        parentCity: '',
        parentPostalCode: '',
        parentCountry: '',
        emergencyContactRelationship: '',
        emergencyContactName: '',
        emergencyContactNumber: ''
      },
      students: [
        {
          firstName: '',
          middleName: '',
          lastName: '',
          gender: 'Other',
          dateOfBirth: '',
          streetAddress: '',
          city: '',
          postalCode: '',
          country: '',
          nationality: '',
          passportNumber: '',
          passportExpiryDate: '',
          nifNumber: '',
          enrollmentLength: '1 year (Residents)',
          weekdayAttendance: '5 days/week',
          enrollmentStartDate: '',
          siblings: false,
          firstLanguage: '',
          englishProficiency: 'No prior knowledge',
          englishReadingWriting: 'No prior knowledge',
          portugueseLevel: 'No prior knowledge',
          skillsHobbies: '',
          strugglingSubjects: '',
          approach: 'Other',
          curriculum: 'Other',
          curriculumSupplier: '',
          curriculumNotes: '',
          behavioralChallenges: false,
          learningDifferences: false,
          physicalLimitations: false,
          healthConditions: false,
          dailyMedication: false,
          medicalTreatments: false,
          allergies: false,
          specialNeedsDetails: '',
          lifeThreatening: false,
          medicalDetails: '',
          pricing: 'Residents',
          discount: 'None',
          paymentMethod: 'Bank Transfer',
          billingAddressSameAsHome: true,
          billingStreetAddress: '',
          billingCity: '',
          billingPostalCode: '',
          billingCountry: '',
          additionalNotes: '',
          signedTuitionAgreement: false,
          referralSource: '',
          motivationForJoining: [],
          photoConsent: false,
          contactListConsent: false,
          termsAndConditions: false,
          personalDataConsent: false
        }
      ]
    }

    response.json(template)
  } catch {
    response.status(500).json({ error: 'Internal server error' })
  }
})

usersRouter.post('/import', userExtractor, async (request, response) => {
  try {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Permission denied - admin access required' })
    }

    const { users, duplicateHandling = 'skip' } = request.body
    const usersToImport = Array.isArray(users) ? users : [users]
    const results = {
      success: [],
      errors: [],
      duplicates: [],
      merged: [],
      conflicts: []
    }

    for (const userData of usersToImport) {
      try {
        if (!userData.username || userData.username.length < 3) {
          results.errors.push({
            username: userData.username,
            error: 'Username must be at least 3 characters long'
          })
          continue
        }

        const passwordError = validatePassword(userData.password)
        if (passwordError) {
          results.errors.push({
            username: userData.username,
            error: passwordError
          })
          continue
        }

        if (!userData.email) {
          results.errors.push({
            username: userData.username,
            error: 'Email is required'
          })
          continue
        }

        const duplicates = await findUserDuplicates(userData, User)

        if (duplicates.length > 0) {
          const existingUser = duplicates[0].existingUser

          switch (duplicateHandling) {
            case 'skip':
              results.duplicates.push({
                username: userData.username,
                message: 'Skipped - duplicate found',
                duplicateType: duplicates[0].type,
                existingId: existingUser._id
              })
              continue

            case 'replace': {
              let passwordHash = existingUser.passwordHash
              if (userData.password) {
                const saltRounds = 10
                passwordHash = await bcrypt.hash(userData.password, saltRounds)
              }

              const replacedData = mergeUserData(existingUser, userData, 'replace')
              replacedData.passwordHash = passwordHash

              await User.findByIdAndUpdate(existingUser._id, replacedData)

              results.merged.push({
                id: existingUser._id,
                username: userData.username,
                action: 'replaced',
                duplicateType: duplicates[0].type
              })
              continue
            }

            case 'merge': {
              let mergePasswordHash = existingUser.passwordHash
              if (userData.password && userData.password.trim() !== '') {
                const saltRounds = 10
                mergePasswordHash = await bcrypt.hash(userData.password, saltRounds)
              }

              const mergedData = mergeUserData(existingUser, userData, 'merge')
              mergedData.passwordHash = mergePasswordHash

              const mergeResult = applyMerge(existingUser, mergedData, 'user')
              await User.findByIdAndUpdate(existingUser._id, mergeResult.mergedData)

              results.merged.push({
                id: existingUser._id,
                username: userData.username,
                action: 'merged',
                duplicateType: duplicates[0].type,
                changesCount: mergeResult.changeCount,
                changes: mergeResult.changes
              })
              continue
            }

            case 'interactive':
              results.conflicts.push({
                username: userData.username,
                existingUser: {
                  id: existingUser._id,
                  username: existingUser.username,
                  email: existingUser.email,
                  name: existingUser.name
                },
                incomingData: userData,
                duplicateType: duplicates[0].type,
                conflicts: duplicates[0].conflicts
              })
              continue

            default:
              results.errors.push({
                username: userData.username,
                error: `Invalid duplicate handling strategy: ${duplicateHandling}`
              })
              continue
          }
        }

        const saltRounds = 10
        const passwordHash = await bcrypt.hash(userData.password, saltRounds)

        const user = new User({
          username: userData.username,
          passwordHash,
          email: userData.email,
          role: userData.role || 'user',
          name: userData.name,
          contactNumber: userData.contactNumber,
          parentNationality: userData.parentNationality,
          parentPassportNumber: userData.parentPassportNumber,
          parentPassportExpiryDate: userData.parentPassportExpiryDate,
          parentNifNumber: userData.parentNifNumber,
          parentStreetAddress: userData.parentStreetAddress,
          parentCity: userData.parentCity,
          parentPostalCode: userData.parentPostalCode,
          parentCountry: userData.parentCountry,
          emergencyContactRelationship: userData.emergencyContactRelationship,
          emergencyContactName: userData.emergencyContactName,
          emergencyContactNumber: userData.emergencyContactNumber
        })

        const savedUser = await user.save()
        results.success.push({
          id: savedUser._id,
          username: savedUser.username,
          email: savedUser.email
        })
      } catch (error) {
        results.errors.push({
          username: userData.username,
          error: error.message
        })
      }
    }

    let message = `Import completed: ${results.success.length} created`
    if (results.merged.length > 0) {
      message += `, ${results.merged.length} merged`
    }
    if (results.duplicates.length > 0) {
      message += `, ${results.duplicates.length} skipped`
    }
    if (results.conflicts.length > 0) {
      message += `, ${results.conflicts.length} conflicts need resolution`
    }

    response.status(200).json({
      message,
      results,
      summary: {
        total: usersToImport.length,
        created: results.success.length,
        merged: results.merged.length,
        skipped: results.duplicates.length,
        conflicts: results.conflicts.length,
        errors: results.errors.length
      }
    })
  } catch {
    response.status(500).json({ error: 'Internal server error' })
  }
})

usersRouter.post('/import-with-students', userExtractor, async (request, response) => {
  try {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Permission denied - admin access required' })
    }

    const { user: userData, students: studentsData } = request.body

    if (!userData.username || userData.username.length < 3) {
      return response.status(400).json({ error: 'Username must be at least 3 characters long' })
    }

    const passwordError = validatePassword(userData.password)
    if (passwordError) {
      return response.status(400).json({ error: passwordError })
    }

    if (!userData.email) {
      return response.status(400).json({ error: 'Email is required' })
    }

    const existingUser = await User.findOne({
      $or: [
        { username: userData.username },
        { email: userData.email }
      ]
    })

    if (existingUser) {
      return response.status(400).json({ error: 'Username or email already exists' })
    }

    const saltRounds = 10
    const passwordHash = await bcrypt.hash(userData.password, saltRounds)

    const user = new User({
      username: userData.username,
      passwordHash,
      email: userData.email,
      role: userData.role || 'user',
      name: userData.name,
      contactNumber: userData.contactNumber,
      parentNationality: userData.parentNationality,
      parentPassportNumber: userData.parentPassportNumber,
      parentPassportExpiryDate: userData.parentPassportExpiryDate,
      parentNifNumber: userData.parentNifNumber,
      parentStreetAddress: userData.parentStreetAddress,
      parentCity: userData.parentCity,
      parentPostalCode: userData.parentPostalCode,
      parentCountry: userData.parentCountry,
      emergencyContactRelationship: userData.emergencyContactRelationship,
      emergencyContactName: userData.emergencyContactName,
      emergencyContactNumber: userData.emergencyContactNumber
    })

    const savedUser = await user.save()
    const createdStudents = []

    if (studentsData && Array.isArray(studentsData)) {
      for (const studentData of studentsData) {
        try {
          const student = new Student({
            ...studentData,
            userId: savedUser._id
          })

          const savedStudent = await student.save()

          savedUser.students.push(savedStudent._id)

          createdStudents.push({
            id: savedStudent._id,
            firstName: savedStudent.firstName,
            lastName: savedStudent.lastName
          })
        } catch {
          // Ignore notification creation errors
        }
      }

      await savedUser.save()
    }

    const populatedUser = await User.findById(savedUser._id)
      .populate('students')

    response.status(201).json({
      message: 'User and students imported successfully',
      user: {
        id: populatedUser._id,
        username: populatedUser.username,
        email: populatedUser.email
      },
      students: createdStudents
    })
  } catch {
    response.status(500).json({ error: 'Internal server error' })
  }
})

usersRouter.get('/export', userExtractor, async (request, response) => {
  try {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Permission denied - admin access required' })
    }

    const filters = {}
    if (request.query.role) {
      filters.role = request.query.role
    }

    const exportData = await exportUsers(filters)

    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `users-export-${timestamp}.json`

    response.setHeader('Content-Type', 'application/json')
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

    response.json(exportData)
  } catch {
    response.status(500).json({ error: 'Failed to export users' })
  }
})

usersRouter.get('/export-with-students', userExtractor, async (request, response) => {
  try {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Permission denied - admin access required' })
    }

    const filters = {}
    if (request.query.role) {
      filters.role = request.query.role
    }

    const exportData = await exportUsersWithStudents(filters)

    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `users-with-students-export-${timestamp}.json`

    response.setHeader('Content-Type', 'application/json')
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

    response.json(exportData)
  } catch {
    response.status(500).json({ error: 'Failed to export users with students' })
  }
})

usersRouter.get('/export-all', userExtractor, async (request, response) => {
  try {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Permission denied - admin access required' })
    }

    const filters = {
      users: {},
      students: {},
      notifications: {},
      documents: {},
      books: {}
    }

    if (request.query.userRole) {
      filters.users.role = request.query.userRole
    }

    if (request.query.studentStartMonth) {
      filters.students.startMonth = request.query.studentStartMonth
    }

    if (request.query.studentEndMonth) {
      filters.students.endMonth = request.query.studentEndMonth
    }

    if (request.query.notificationStartDate) {
      filters.notifications.startDate = request.query.notificationStartDate
    }

    if (request.query.notificationEndDate) {
      filters.notifications.endDate = request.query.notificationEndDate
    }

    if (request.query.notificationTargetType) {
      filters.notifications.targetType = request.query.notificationTargetType
    }

    if (request.query.bookAvailability) {
      filters.books.availability = request.query.bookAvailability
    }

    const options = {
      preservePasswords: request.query.preservePasswords !== 'false'
    }

    const exportData = await exportAllData(filters, options)

    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `system-backup-${timestamp}.json`

    response.setHeader('Content-Type', 'application/json')
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

    response.json(exportData)
  } catch (error) {
    console.error('Export error:', error)
    response.status(500).json({ error: 'Failed to export system data', details: error.message })
  }
})

usersRouter.post('/import-all', userExtractor, async (request, response) => {
  try {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Permission denied - admin access required' })
    }

    const { backupData, options = {} } = request.body

    if (!backupData || typeof backupData !== 'object') {
      return response.status(400).json({ error: 'Invalid backup data format' })
    }

    if (backupData._metadata?.exportType !== 'complete-system-backup') {
      return response.status(400).json({ error: 'Invalid backup file - must be a complete system backup' })
    }

    const defaultOptions = {
      userDuplicateHandling: 'skip',
      studentDuplicateHandling: 'skip',
      notificationDuplicateHandling: 'skip',
      documentDuplicateHandling: 'skip',
      bookDuplicateHandling: 'skip'
    }

    const mergedOptions = { ...defaultOptions, ...options }

    const User = require('../models/user')
    const Student = require('../models/student')
    const Dashboard = require('../models/dashboard')
    const Notification = require('../models/notification')
    const Document = require('../models/document')
    const Book = require('../models/book')
    const EventSignup = require('../models/eventSignup')

    const models = { User, Student, Dashboard, Notification, Document, Book, EventSignup }

    const result = await importAllData(backupData, mergedOptions, models)

    let message = 'System restore completed: '
    const summaryParts = []

    if (result.summary?.users?.created > 0) summaryParts.push(`${result.summary.users.created} users created`)
    if (result.summary?.students?.created > 0) summaryParts.push(`${result.summary.students.created} students created`)
    if (result.summary?.notifications?.created > 0) summaryParts.push(`${result.summary.notifications.created} notifications created`)
    if (result.summary?.documents?.created > 0) summaryParts.push(`${result.summary.documents.created} documents created`)
    if (result.summary?.books?.created > 0) summaryParts.push(`${result.summary.books.created} books created`)
    if (result.summary?.eventSignups?.created > 0) summaryParts.push(`${result.summary.eventSignups.created} event signups created`)

    message += summaryParts.length > 0 ? summaryParts.join(', ') : 'No new records created'

    response.status(200).json({
      message,
      results: result,
      summary: {
        totalProcessed: (result.summary?.users?.total || 0) + (result.summary?.students?.total || 0) + (result.summary?.notifications?.total || 0) + (result.summary?.documents?.total || 0) + (result.summary?.books?.total || 0) + (result.summary?.eventSignups?.total || 0),
        totalCreated: (result.summary?.users?.created || 0) + (result.summary?.students?.created || 0) + (result.summary?.notifications?.created || 0) + (result.summary?.documents?.created || 0) + (result.summary?.books?.created || 0) + (result.summary?.eventSignups?.created || 0),
        totalErrors: (result.summary?.users?.errors || 0) + (result.summary?.students?.errors || 0) + (result.summary?.notifications?.errors || 0) + (result.summary?.documents?.errors || 0) + (result.summary?.books?.errors || 0) + (result.summary?.eventSignups?.errors || 0)
      }
    })
  } catch (error) {
    response.status(500).json({
      error: 'Failed to restore system data',
      details: error.message
    })
  }
})

usersRouter.post('/clear-database', userExtractor, async (request, response) => {
  try {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Access denied. Admin privileges required.' })
    }

    const { confirmation } = request.body
    if (confirmation !== 'DELETE') {
      return response.status(400).json({ error: 'Invalid confirmation. Type DELETE to confirm.' })
    }

    const Book = require('../models/book')
    const Document = require('../models/document')
    const Dashboard = require('../models/dashboard')
    const Notification = require('../models/notification')
    const EventSignup = require('../models/eventSignup')


    const results = {}

    const userCount = await User.countDocuments()
    await User.deleteMany({ _id: { $ne: request.user.id } })
    results.users = userCount - 1

    const studentCount = await Student.countDocuments()
    await Student.deleteMany({})
    results.students = studentCount

    const dashboardCount = await Dashboard.countDocuments()
    await Dashboard.deleteMany({})
    results.dashboards = dashboardCount

    const notificationCount = await Notification.countDocuments()

    await Notification.deleteMany({})
    results.notifications = notificationCount


    const documentCount = await Document.countDocuments()
    await Document.deleteMany({})
    results.documents = documentCount

    const bookCount = await Book.countDocuments()
    await Book.deleteMany({})
    results.books = bookCount

    const eventSignupCount = await EventSignup.countDocuments()
    await EventSignup.deleteMany({})
    results.eventSignups = eventSignupCount


    response.status(200).json({
      message: 'Database cleared successfully',
      clearedCounts: results,
      timestamp: new Date().toISOString(),
      clearedBy: request.user.username
    })

  } catch (error) {
    response.status(500).json({
      error: 'Failed to clear database',
      details: error.message
    })
  }
})

// Get all archived users (admin only)
usersRouter.get('/archived/all', userExtractor, async (request, response) => {
  try {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Permission denied - admin access required' })
    }

    const archivedUsers = await User.find({ isArchived: true })
      .populate('books', { url: 1, title: 1, author: 1 })
      .populate('students')
    response.json(archivedUsers)
  } catch {
    response.status(500).json({ error: 'Internal server error' })
  }
})

// Archive a user and all their students (admin only)
usersRouter.put('/:id/archive', userExtractor, async (request, response) => {
  try {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Permission denied - admin access required' })
    }

    const user = await User.findById(request.params.id)
    if (!user) {
      return response.status(404).json({ error: 'User not found' })
    }

    // Archive the user
    user.isArchived = true
    await user.save()

    // Archive all students belonging to this user
    await Student.updateMany(
      { userId: request.params.id },
      { $set: { isArchived: true } }
    )

    const updatedUser = await User.findById(request.params.id)
      .populate('books', { url: 1, title: 1, author: 1 })
      .populate('students')

    response.json(updatedUser)
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return response.status(400).json({ error: 'Malformatted id' })
    }
    response.status(500).json({ error: 'Internal server error' })
  }
})

// Unarchive a user (does not unarchive students automatically)
usersRouter.put('/:id/unarchive', userExtractor, async (request, response) => {
  try {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Permission denied - admin access required' })
    }

    const user = await User.findById(request.params.id)
    if (!user) {
      return response.status(404).json({ error: 'User not found' })
    }

    user.isArchived = false
    await user.save()

    const updatedUser = await User.findById(request.params.id)
      .populate('books', { url: 1, title: 1, author: 1 })
      .populate('students')

    response.json(updatedUser)
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return response.status(400).json({ error: 'Malformatted id' })
    }
    response.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = usersRouter
