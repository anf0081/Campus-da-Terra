const jwt = require('jsonwebtoken')
const studentsRouter = require('express').Router()
const Student = require('../models/student')
const User = require('../models/user')
const Dashboard = require('../models/dashboard')
const { userExtractor } = require('../utils/middleware')
const { uploadProfilePicture, deleteFileByUrl, deleteFileByPublicId, getPublicIdFromUrl, getSignedUrlFromStoredUrl, getDownloadUrl } = require('../utils/cloudinary')
const { exportStudents } = require('../utils/dataExport')
const { findStudentDuplicates, mergeStudentData, mergeDashboardData, applyMerge } = require('../utils/dataMerge')

const getTokenFrom = request => {
  const authorization = request.get('authorization')
  if (authorization && authorization.startsWith('Bearer ')) {
    return authorization.replace('Bearer ', '')
  }
  return null
}

studentsRouter.get('/', async (request, response) => {
  const token = getTokenFrom(request)

  if (!token) {
    return response.status(401).json({ error: 'Token missing' })
  }

  try {
    const decodedToken = jwt.verify(token, process.env.SECRET)
    if (!decodedToken.id) {
      return response.status(401).json({ error: 'Token invalid' })
    }

    const user = await User.findById(decodedToken.id)
    if (!user) {
      return response.status(404).json({ error: 'User not found' })
    }

    let students
    if (user.role === 'admin' || user.role === 'tutor') {
      students = await Student.find({ isArchived: { $ne: true } }).populate('userId', { username: 1, name: 1, email: 1 })
    } else {
      students = await Student.find({ userId: decodedToken.id, isArchived: { $ne: true } })
    }

    response.json(students)
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return response.status(401).json({ error: 'Token invalid' })
    }
    if (error.name === 'TokenExpiredError') {
      return response.status(401).json({ error: 'Token expired' })
    }
    response.status(500).json({ error: 'Internal server error' })
  }
})

studentsRouter.get('/template', userExtractor, async (request, response) => {
  try {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Permission denied - admin access required' })
    }

    const template = {
      _documentation: {
        note: 'userId will be set automatically based on user selection during import',
        gender: ['Male', 'Female', 'Other'],
        enrollmentLength: ['6 months (Residents)', '1 year (Residents)', 'Multiple years (Residents)', '1 month (Traveling family)', '2 months (Traveling Family)', '3 months (Traveling Family)'],
        weekdayAttendance: ['1 day/week', '2 days/week', '3 days/week', '4 days/week', '5 days/week'],
        englishProficiency: ['No prior knowledge', 'Beginner', 'Intermediate', 'Proficient', 'Fluent'],
        englishReadingWriting: ['No prior knowledge', 'Beginner', 'Intermediate', 'Advanced'],
        portugueseLevel: ['No prior knowledge', 'Beginner', 'Intermediate', 'Proficient', 'Fluent'],
        approach: ['Unschooling', 'Core Education', 'Qualifications for higher education', 'Other'],
        curriculum: ['Online School', 'Workbook Curriculum', 'Mix and Match', 'Other'],
        pricing: ['Residents', 'Financial Hardship', 'Traveling Families', 'Founding Member'],
        discount: ['Sibling Discount', 'Early Payment Discount', 'Referral Discount', 'Other', 'None'],
        paymentMethod: ['Bank Transfer', 'Cash', 'SEPA direct debit', 'MBWay', 'Stripe', 'Bitcoin', 'Other'],
        motivationForJoining: ['Alternative / more holistic education', 'Democratic / self-directed learning approach', 'To be part of a community', 'Quality of teachers', 'The values and culture of the school', 'The campus and natural environment', 'A sense of adventure / Madeira', 'Traveling family looking for short-term enrollments', 'Other']
      },
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

    response.json(template)
  } catch {
    response.status(500).json({ error: 'Internal server error' })
  }
})

studentsRouter.get('/export', userExtractor, async (request, response) => {
  try {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Permission denied - admin access required' })
    }

    const filters = {}
    if (request.query.startMonth) {
      filters.startMonth = request.query.startMonth
    }
    if (request.query.endMonth) {
      filters.endMonth = request.query.endMonth
    }
    if (request.query.userId) {
      filters.userId = request.query.userId
    }

    const exportData = await exportStudents(filters)

    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `students-export-${timestamp}.json`

    response.setHeader('Content-Type', 'application/json')
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

    response.json(exportData)
  } catch {
    response.status(500).json({ error: 'Failed to export students' })
  }
})

studentsRouter.post('/import/backup', userExtractor, async (request, response) => {
  try {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Permission denied - admin access required' })
    }

    const { backupData, duplicateHandling = 'skip' } = request.body

    if (!backupData || !backupData._metadata || !backupData.students) {
      return response.status(400).json({
        error: 'Invalid backup format - missing required fields (_metadata, students)'
      })
    }

    if (backupData._metadata.exportType !== 'students') {
      return response.status(400).json({
        error: `Invalid backup type - expected 'students', got '${backupData._metadata.exportType}'`
      })
    }

    const studentsToImport = backupData.students
    const results = {
      success: [],
      errors: [],
      duplicates: [],
      merged: [],
      conflicts: []
    }

    for (const studentData of studentsToImport) {
      try {
        const dbStudentData = { ...studentData }

        if (studentData.id) {
          delete dbStudentData.id
        }

        if (studentData.parentUsername) {
          const user = await User.findOne({ username: studentData.parentUsername })
          if (user) {
            dbStudentData.userId = user._id
          } else {
            results.errors.push({
              name: `${studentData.firstName} ${studentData.lastName}`,
              error: `Parent user with username '${studentData.parentUsername}' not found`
            })
            continue
          }
          delete dbStudentData.parentUsername
        } else if (studentData.userId) {
          const user = await User.findById(studentData.userId)
          if (!user) {
            results.errors.push({
              name: `${studentData.firstName} ${studentData.lastName}`,
              error: `Parent user with ID '${studentData.userId}' not found`
            })
            continue
          }
        } else {
          results.errors.push({
            name: `${studentData.firstName} ${studentData.lastName}`,
            error: 'No parent user reference found (parentUsername or userId required)'
          })
          continue
        }

        if (!dbStudentData.firstName || !dbStudentData.lastName) {
          results.errors.push({
            name: `${studentData.firstName} ${studentData.lastName}`,
            error: 'First name and last name are required'
          })
          continue
        }

        if (!dbStudentData.dateOfBirth) {
          results.errors.push({
            name: `${studentData.firstName} ${studentData.lastName}`,
            error: 'Date of birth is required'
          })
          continue
        }

        const duplicates = await findStudentDuplicates(dbStudentData, Student)

        if (duplicates.length > 0) {
          const existingStudent = duplicates[0].existingStudent

          switch (duplicateHandling) {
            case 'skip':
              results.duplicates.push({
                name: `${studentData.firstName} ${studentData.lastName}`,
                message: 'Skipped - duplicate found',
                duplicateType: duplicates[0].type,
                existingId: existingStudent._id
              })
              continue

            case 'replace': {
              const mergeResult = mergeStudentData(existingStudent, dbStudentData, 'replace')
              await Student.findByIdAndUpdate(existingStudent._id, mergeResult.studentData)

              if (mergeResult.dashboardData) {
                const existingDashboard = await Dashboard.findOne({ studentId: existingStudent._id })
                const mergedDashboard = mergeDashboardData(existingDashboard, mergeResult.dashboardData, 'replace')

                if (existingDashboard) {
                  await Dashboard.findByIdAndUpdate(existingDashboard._id, mergedDashboard)
                } else {
                  mergedDashboard.studentId = existingStudent._id
                  const dashboard = new Dashboard(mergedDashboard)
                  await dashboard.save()
                }
              }

              results.merged.push({
                id: existingStudent._id,
                name: `${studentData.firstName} ${studentData.lastName}`,
                action: 'replaced',
                duplicateType: duplicates[0].type
              })
              continue
            }

            case 'merge': {
              const mergeResult = mergeStudentData(existingStudent, dbStudentData, 'merge')
              const studentMergeResult = applyMerge(existingStudent, mergeResult.studentData, 'student')
              await Student.findByIdAndUpdate(existingStudent._id, studentMergeResult.mergedData)

              if (mergeResult.dashboardData) {
                const existingDashboard = await Dashboard.findOne({ studentId: existingStudent._id })
                const mergedDashboard = mergeDashboardData(existingDashboard, mergeResult.dashboardData, 'merge')

                if (existingDashboard) {
                  await Dashboard.findByIdAndUpdate(existingDashboard._id, mergedDashboard)
                } else {
                  mergedDashboard.studentId = existingStudent._id
                  const dashboard = new Dashboard(mergedDashboard)
                  await dashboard.save()
                }
              }

              results.merged.push({
                id: existingStudent._id,
                name: `${studentData.firstName} ${studentData.lastName}`,
                action: 'merged',
                duplicateType: duplicates[0].type,
                changesCount: studentMergeResult.changeCount,
                changes: studentMergeResult.changes
              })
              continue
            }

            case 'interactive':
              results.conflicts.push({
                name: `${studentData.firstName} ${studentData.lastName}`,
                existingStudent: {
                  id: existingStudent._id,
                  firstName: existingStudent.firstName,
                  lastName: existingStudent.lastName,
                  dateOfBirth: existingStudent.dateOfBirth
                },
                incomingData: dbStudentData,
                duplicateType: duplicates[0].type,
                conflicts: duplicates[0].conflicts
              })
              continue

            default:
              results.errors.push({
                name: `${studentData.firstName} ${studentData.lastName}`,
                error: `Invalid duplicate handling strategy: ${duplicateHandling}`
              })
              continue
          }
        }

        const dashboardData = dbStudentData.dashboard
        delete dbStudentData.dashboard

        const student = new Student(dbStudentData)
        const savedStudent = await student.save()

        if (dashboardData) {
          dashboardData.studentId = savedStudent._id
          const dashboard = new Dashboard(dashboardData)
          await dashboard.save()
        }

        const targetUser = await User.findById(dbStudentData.userId)
        if (targetUser) {
          if (!targetUser.students) {
            targetUser.students = []
          }
          targetUser.students = targetUser.students.concat(savedStudent._id)
          await targetUser.save()
        }

        results.success.push({
          name: `${savedStudent.firstName} ${savedStudent.lastName}`,
          id: savedStudent._id
        })
      } catch (error) {
        results.errors.push({
          name: `${studentData.firstName || 'Unknown'} ${studentData.lastName || 'Student'}`,
          error: error.message
        })
      }
    }

    let message = `Backup import completed: ${results.success.length} created`
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
        total: studentsToImport.length,
        created: results.success.length,
        merged: results.merged.length,
        skipped: results.duplicates.length,
        conflicts: results.conflicts.length,
        errors: results.errors.length
      },
      backupMetadata: backupData._metadata
    })
  } catch {
    response.status(500).json({ error: 'Internal server error' })
  }
})

studentsRouter.post('/import', userExtractor, async (request, response) => {
  try {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Permission denied - admin access required' })
    }

    const { students, duplicateHandling = 'skip' } = request.body
    const studentsToImport = Array.isArray(students) ? students : [students]
    const results = {
      success: [],
      errors: [],
      duplicates: [],
      merged: [],
      conflicts: []
    }

    for (const studentData of studentsToImport) {
      try {
        if (!studentData.firstName || !studentData.lastName) {
          results.errors.push({
            name: `${studentData.firstName} ${studentData.lastName}`,
            error: 'First name and last name are required'
          })
          continue
        }

        if (!studentData.dateOfBirth) {
          results.errors.push({
            name: `${studentData.firstName} ${studentData.lastName}`,
            error: 'Date of birth is required'
          })
          continue
        }

        if (!studentData.userId) {
          results.errors.push({
            name: `${studentData.firstName} ${studentData.lastName}`,
            error: 'Parent/Guardian selection is required'
          })
          continue
        }

        let userId = null
        if (studentData.userId) {
          if (typeof studentData.userId === 'string' && !studentData.userId.match(/^[0-9a-fA-F]{24}$/)) {
            const user = await User.findOne({ username: studentData.userId })
            if (user) {
              userId = user._id
            } else {
              results.errors.push({
                name: `${studentData.firstName} ${studentData.lastName}`,
                error: `User with username '${studentData.userId}' not found`
              })
              continue
            }
          } else {
            userId = studentData.userId
          }
        }

        const duplicates = await findStudentDuplicates(studentData, Student)

        if (duplicates.length > 0) {
          const existingStudent = duplicates[0].existingStudent

          switch (duplicateHandling) {
            case 'skip':
              results.duplicates.push({
                name: `${studentData.firstName} ${studentData.lastName}`,
                message: 'Skipped - duplicate found',
                duplicateType: duplicates[0].type,
                existingId: existingStudent._id
              })
              continue

            case 'replace': {
              const replacedData = mergeStudentData(existingStudent, { ...studentData, userId }, 'replace')
              await Student.findByIdAndUpdate(existingStudent._id, replacedData)

              results.merged.push({
                id: existingStudent._id,
                name: `${studentData.firstName} ${studentData.lastName}`,
                action: 'replaced',
                duplicateType: duplicates[0].type
              })
              continue
            }

            case 'merge': {
              const mergedData = mergeStudentData(existingStudent, { ...studentData, userId }, 'merge')
              const mergeResult = applyMerge(existingStudent, mergedData, 'student')
              await Student.findByIdAndUpdate(existingStudent._id, mergeResult.mergedData)

              results.merged.push({
                id: existingStudent._id,
                name: `${studentData.firstName} ${studentData.lastName}`,
                action: 'merged',
                duplicateType: duplicates[0].type,
                changesCount: mergeResult.changeCount,
                changes: mergeResult.changes
              })
              continue
            }

            case 'interactive':
              results.conflicts.push({
                name: `${studentData.firstName} ${studentData.lastName}`,
                existingStudent: {
                  id: existingStudent._id,
                  firstName: existingStudent.firstName,
                  lastName: existingStudent.lastName,
                  dateOfBirth: existingStudent.dateOfBirth
                },
                incomingData: { ...studentData, userId },
                duplicateType: duplicates[0].type,
                conflicts: duplicates[0].conflicts
              })
              continue

            default:
              results.errors.push({
                name: `${studentData.firstName} ${studentData.lastName}`,
                error: `Invalid duplicate handling strategy: ${duplicateHandling}`
              })
              continue
          }
        }

        const student = new Student({
          ...studentData,
          userId: userId
        })

        const savedStudent = await student.save()
        results.success.push({
          name: `${savedStudent.firstName} ${savedStudent.lastName}`,
          id: savedStudent._id
        })
      } catch (error) {
        results.errors.push({
          name: `${studentData.firstName || 'Unknown'} ${studentData.lastName || 'Student'}`,
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
        total: studentsToImport.length,
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

studentsRouter.get('/:id', async (request, response) => {
  const token = getTokenFrom(request)

  if (!token) {
    return response.status(401).json({ error: 'Token missing' })
  }

  try {
    const decodedToken = jwt.verify(token, process.env.SECRET)
    if (!decodedToken.id) {
      return response.status(401).json({ error: 'Token invalid' })
    }

    const student = await Student.findById(request.params.id).populate('userId', { username: 1, name: 1, email: 1 })
    if (!student) {
      return response.status(404).json({ error: 'Student not found' })
    }

    const user = await User.findById(decodedToken.id)

    if (user.role !== 'admin' && user.role !== 'tutor' && student.userId.toString() !== decodedToken.id) {
      return response.status(403).json({ error: 'Permission denied' })
    }

    response.json(student)
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return response.status(401).json({ error: 'Token invalid' })
    }
    if (error.name === 'TokenExpiredError') {
      return response.status(401).json({ error: 'Token expired' })
    }
    if (error.kind === 'ObjectId') {
      return response.status(400).json({ error: 'Malformatted id' })
    }
    response.status(500).json({ error: 'Internal server error' })
  }
})

studentsRouter.post('/', async (request, response) => {
  const token = getTokenFrom(request)

  if (!token) {
    return response.status(401).json({ error: 'Token missing' })
  }

  try {
    const decodedToken = jwt.verify(token, process.env.SECRET)
    if (!decodedToken.id) {
      return response.status(401).json({ error: 'Token invalid' })
    }

    const user = await User.findById(decodedToken.id)
    if (!user) {
      return response.status(404).json({ error: 'User not found' })
    }

    let targetUserId = decodedToken.id
    if (user.role === 'admin' && request.body.userId) {
      targetUserId = request.body.userId
    }

    const studentData = {
      ...request.body,
      userId: targetUserId
    }

    const student = new Student(studentData)
    const savedStudent = await student.save()

    const targetUser = targetUserId === decodedToken.id ? user : await User.findById(targetUserId)
    if (!targetUser) {
      return response.status(404).json({ error: 'Target user not found' })
    }

    if (!targetUser.students) {
      targetUser.students = []
    }
    targetUser.students = targetUser.students.concat(savedStudent._id)
    await targetUser.save()

    response.status(201).json(savedStudent)
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return response.status(401).json({ error: 'Token invalid' })
    }
    if (error.name === 'TokenExpiredError') {
      return response.status(401).json({ error: 'Token expired' })
    }
    if (error.name === 'ValidationError') {
      return response.status(400).json({ error: error.message })
    }
    response.status(500).json({ error: 'Internal server error' })
  }
})

studentsRouter.put('/:id', async (request, response) => {
  const token = getTokenFrom(request)

  if (!token) {
    return response.status(401).json({ error: 'Token missing' })
  }

  try {
    const decodedToken = jwt.verify(token, process.env.SECRET)
    if (!decodedToken.id) {
      return response.status(401).json({ error: 'Token invalid' })
    }

    const student = await Student.findById(request.params.id)
    if (!student) {
      return response.status(404).json({ error: 'Student not found' })
    }

    const user = await User.findById(decodedToken.id)

    if (user.role !== 'admin' && student.userId.toString() !== decodedToken.id) {
      return response.status(403).json({ error: 'Permission denied' })
    }

    const updatedStudent = await Student.findByIdAndUpdate(
      request.params.id,
      request.body,
      { new: true, runValidators: true }
    )

    response.json(updatedStudent)
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return response.status(401).json({ error: 'Token invalid' })
    }
    if (error.name === 'TokenExpiredError') {
      return response.status(401).json({ error: 'Token expired' })
    }
    if (error.name === 'ValidationError') {
      return response.status(400).json({ error: error.message })
    }
    if (error.kind === 'ObjectId') {
      return response.status(400).json({ error: 'Malformatted id' })
    }
    response.status(500).json({ error: 'Internal server error' })
  }
})

studentsRouter.delete('/:id', async (request, response) => {
  const token = getTokenFrom(request)

  if (!token) {
    return response.status(401).json({ error: 'Token missing' })
  }

  try {
    const decodedToken = jwt.verify(token, process.env.SECRET)
    if (!decodedToken.id) {
      return response.status(401).json({ error: 'Token invalid' })
    }

    const student = await Student.findById(request.params.id)
    if (!student) {
      return response.status(404).json({ error: 'Student not found' })
    }

    const user = await User.findById(decodedToken.id)

    if (user.role !== 'admin' && student.userId.toString() !== decodedToken.id) {
      return response.status(403).json({ error: 'Permission denied' })
    }

    await Student.findByIdAndDelete(request.params.id)

    user.students = user.students.filter(s => s.toString() !== request.params.id)
    await user.save()

    response.status(204).end()
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return response.status(401).json({ error: 'Token invalid' })
    }
    if (error.name === 'TokenExpiredError') {
      return response.status(401).json({ error: 'Token expired' })
    }
    if (error.kind === 'ObjectId') {
      return response.status(400).json({ error: 'Malformatted id' })
    }
    response.status(500).json({ error: 'Internal server error' })
  }
})

studentsRouter.post('/:id/wishlist', async (request, response) => {
  const token = getTokenFrom(request)

  if (!token) {
    return response.status(401).json({ error: 'Token missing' })
  }

  try {
    const decodedToken = jwt.verify(token, process.env.SECRET)
    if (!decodedToken.id) {
      return response.status(401).json({ error: 'Token invalid' })
    }

    const { bookId } = request.body
    if (!bookId) {
      return response.status(400).json({ error: 'Book Id is required' })
    }

    const student = await Student.findById(request.params.id)
    if (!student) {
      return response.status(404).json({ error: 'Student not found' })
    }

    const user = await User.findById(decodedToken.id)

    if (user.role !== 'admin' && user.role !== 'tutor' && student.userId.toString() !== decodedToken.id) {
      return response.status(403).json({ error: 'Permission denied' })
    }

    const isAlreadyInWishlist = student.wishlist.some(item => item.bookId.toString() === bookId)
    if (isAlreadyInWishlist) {
      return response.status(400).json({ error: 'Book already in wishlist' })
    }

    student.wishlist.push({ bookId })
    await student.save()
    await student.populate('wishlist.bookId')
    response.status(201).json(student.wishlist)
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return response.status(401).json({ error: 'Token invalid' })
    }
    if (error.name === 'TokenExpiredError') {
      return response.status(401).json({ error: 'Token expired' })
    }
    if (error.kind === 'ObjectId') {
      return response.status(400).json({ error: 'Malformatted id' })
    }
    response.status(500).json({ error: 'Internal server error' })
  }
})

studentsRouter.delete('/:id/wishlist/:bookId', async (request, response) => {
  const token = getTokenFrom(request)

  if (!token) {
    return response.status(401).json({ error: 'Token missing' })
  }

  try {
    const decodedToken = jwt.verify(token, process.env.SECRET)
    if (!decodedToken.id) {
      return response.status(401).json({ error: 'Token invalid' })
    }

    const student = await Student.findById(request.params.id)
    if (!student) {
      return response.status(404).json({ error: 'Student not found' })
    }

    const user = await User.findById(decodedToken.id)

    if (user.role !== 'admin' && user.role !== 'tutor' && student.userId.toString() !== decodedToken.id) {
      return response.status(403).json({ error: 'Permission denied' })
    }

    student.wishlist = student.wishlist.filter(item => item.bookId.toString() !== request.params.bookId)
    await student.save()
    await student.populate('wishlist.bookId')

    response.json(student.wishlist)
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return response.status(401).json({ error: 'Token invalid' })
    }
    if (error.name === 'TokenExpiredError') {
      return response.status(401).json({ error: 'Token expired' })
    }
    if (error.kind === 'ObjectId') {
      return response.status(400).json({ error: 'Malformatted id' })
    }
    response.status(500).json({ error: 'Internal server error' })
  }
})

studentsRouter.get('/:id/wishlist', async (request, response) => {
  const token = getTokenFrom(request)

  if (!token) {
    return response.status(401).json({ error: 'Token missing' })
  }

  try {
    const decodedToken = jwt.verify(token, process.env.SECRET)
    if (!decodedToken.id) {
      return response.status(401).json({ error: 'Token invalid' })
    }

    const student = await Student.findById(request.params.id).populate('wishlist.bookId')
    if (!student) {
      return response.status(404).json({ error: 'Student not found' })
    }

    const user = await User.findById(decodedToken.id)

    if (user.role !== 'admin' && user.role !== 'tutor' && student.userId.toString() !== decodedToken.id) {
      return response.status(403).json({ error: 'Permission denied' })
    }

    response.json(student.wishlist)
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return response.status(401).json({ error: 'Token invalid' })
    }
    if (error.name === 'TokenExpiredError') {
      return response.status(401).json({ error: 'Token expired' })
    }
    if (error.kind === 'ObjectId') {
      return response.status(400).json({ error: 'Malformatted id' })
    }
    response.status(500).json({ error: 'Internal server error' })
  }
})

studentsRouter.post('/:id/profile-picture', uploadProfilePicture.single('profilePicture'), async (request, response) => {
  const token = getTokenFrom(request)

  if (!token) {
    return response.status(401).json({ error: 'Token missing' })
  }

  try {
    const decodedToken = jwt.verify(token, process.env.SECRET)
    if (!decodedToken.id) {
      return response.status(401).json({ error: 'Token invalid' })
    }

    const student = await Student.findById(request.params.id)
    if (!student) {
      return response.status(404).json({ error: 'Student not found' })
    }

    const user = await User.findById(decodedToken.id)

    if (user.role !== 'admin') {
      return response.status(403).json({ error: 'Only administrators can upload profile pictures' })
    }

    if (!request.file) {
      return response.status(400).json({ error: 'No file uploaded' })
    }

    if (student.profilePicture) {
      try {
        if (student.profilePicturePublicId) {
          await deleteFileByPublicId(student.profilePicturePublicId, 'profile-picture.jpg')
        } else {
          await deleteFileByUrl(student.profilePicture, 'profile-picture.jpg')
        }
      } catch {
        // Ignore file deletion errors
      }
    }

    const updatedStudent = await Student.findByIdAndUpdate(
      request.params.id,
      {
        profilePicture: request.file.path,
        profilePicturePublicId: request.file.filename
      },
      { new: true, runValidators: true }
    )

    response.json(updatedStudent)
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return response.status(401).json({ error: 'Token invalid' })
    }
    if (error.name === 'TokenExpiredError') {
      return response.status(401).json({ error: 'Token expired' })
    }
    if (error.kind === 'ObjectId') {
      return response.status(400).json({ error: 'Malformatted id' })
    }
    response.status(500).json({ error: 'Failed to upload profile picture' })
  }
})

studentsRouter.delete('/:id/profile-picture', async (request, response) => {
  const token = getTokenFrom(request)

  if (!token) {
    return response.status(401).json({ error: 'Token missing' })
  }

  try {
    const decodedToken = jwt.verify(token, process.env.SECRET)
    if (!decodedToken.id) {
      return response.status(401).json({ error: 'Token invalid' })
    }

    const student = await Student.findById(request.params.id)
    if (!student) {
      return response.status(404).json({ error: 'Student not found' })
    }

    const user = await User.findById(decodedToken.id)

    if (user.role !== 'admin') {
      return response.status(403).json({ error: 'Only administrators can remove profile pictures' })
    }

    if (!student.profilePicture) {
      return response.status(400).json({ error: 'No profile picture to remove' })
    }

    try {
      if (student.profilePicturePublicId) {
        await deleteFileByPublicId(student.profilePicturePublicId, 'profile-picture.jpg')
      } else {
        await deleteFileByUrl(student.profilePicture, 'profile-picture.jpg')
      }
    } catch {
      // Ignore file deletion errors
    }

    const updatedStudent = await Student.findByIdAndUpdate(
      request.params.id,
      { $unset: { profilePicture: 1, profilePicturePublicId: 1 } },
      { new: true }
    )

    response.json(updatedStudent)
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return response.status(401).json({ error: 'Token invalid' })
    }
    if (error.name === 'TokenExpiredError') {
      return response.status(401).json({ error: 'Token expired' })
    }
    if (error.kind === 'ObjectId') {
      return response.status(400).json({ error: 'Malformatted id' })
    }
    response.status(500).json({ error: 'Failed to remove profile picture' })
  }
})

studentsRouter.get('/:id/profile-picture', async (request, response) => {
  const token = getTokenFrom(request)

  if (!token) {
    return response.status(401).json({ error: 'Token missing' })
  }

  try {
    const decodedToken = jwt.verify(token, process.env.SECRET)
    if (!decodedToken.id) {
      return response.status(401).json({ error: 'Token invalid' })
    }

    const student = await Student.findById(request.params.id)
    if (!student) {
      return response.status(404).json({ error: 'Student not found' })
    }

    const user = await User.findById(decodedToken.id)

    if (user.role !== 'admin' && user.role !== 'tutor' && student.userId.toString() !== decodedToken.id) {
      return response.status(403).json({ error: 'Permission denied' })
    }

    if (!student.profilePicture) {
      return response.status(404).json({ error: 'No profile picture found' })
    }


    const publicId = getPublicIdFromUrl(student.profilePicture)
    if (!publicId) {
      return response.json({
        url: student.profilePicture,
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
      })
    }

    let signedUrl = getDownloadUrl(publicId, 'profile-picture.jpg', {
      expiresIn: 3600
    })

    if (!signedUrl) {
      try {
        signedUrl = getSignedUrlFromStoredUrl(student.profilePicture, {
          expiresIn: 3600
        })
      } catch {
        return response.status(500).json({ error: 'Failed to generate secure image URL' })
      }
    }

    if (!signedUrl) {
      return response.status(500).json({ error: 'Failed to generate secure image URL' })
    }

    response.json({
      url: signedUrl,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
    })
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return response.status(401).json({ error: 'Token invalid' })
    }
    if (error.name === 'TokenExpiredError') {
      return response.status(401).json({ error: 'Token expired' })
    }
    if (error.kind === 'ObjectId') {
      return response.status(400).json({ error: 'Malformatted id' })
    }
    response.status(500).json({ error: 'Internal server error' })
  }
})

// Get all archived students (admin only)
studentsRouter.get('/archived/all', async (request, response) => {
  const token = getTokenFrom(request)

  if (!token) {
    return response.status(401).json({ error: 'Token missing' })
  }

  try {
    const decodedToken = jwt.verify(token, process.env.SECRET)
    if (!decodedToken.id) {
      return response.status(401).json({ error: 'Token invalid' })
    }

    const user = await User.findById(decodedToken.id)
    if (!user) {
      return response.status(404).json({ error: 'User not found' })
    }

    if (user.role !== 'admin') {
      return response.status(403).json({ error: 'Permission denied - admin access required' })
    }

    const archivedStudents = await Student.find({ isArchived: true }).populate('userId', { username: 1, name: 1, email: 1 })
    response.json(archivedStudents)
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return response.status(401).json({ error: 'Token invalid' })
    }
    if (error.name === 'TokenExpiredError') {
      return response.status(401).json({ error: 'Token expired' })
    }
    response.status(500).json({ error: 'Internal server error' })
  }
})

// Archive a student (admin only)
studentsRouter.put('/:id/archive', async (request, response) => {
  const token = getTokenFrom(request)

  if (!token) {
    return response.status(401).json({ error: 'Token missing' })
  }

  try {
    const decodedToken = jwt.verify(token, process.env.SECRET)
    if (!decodedToken.id) {
      return response.status(401).json({ error: 'Token invalid' })
    }

    const user = await User.findById(decodedToken.id)
    if (!user) {
      return response.status(404).json({ error: 'User not found' })
    }

    if (user.role !== 'admin') {
      return response.status(403).json({ error: 'Permission denied - admin access required' })
    }

    const student = await Student.findById(request.params.id)
    if (!student) {
      return response.status(404).json({ error: 'Student not found' })
    }

    student.isArchived = true
    await student.save()

    const updatedStudent = await Student.findById(request.params.id).populate('userId', { username: 1, name: 1, email: 1 })
    response.json(updatedStudent)
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return response.status(401).json({ error: 'Token invalid' })
    }
    if (error.name === 'TokenExpiredError') {
      return response.status(401).json({ error: 'Token expired' })
    }
    if (error.kind === 'ObjectId') {
      return response.status(400).json({ error: 'Malformatted id' })
    }
    response.status(500).json({ error: 'Internal server error' })
  }
})

// Unarchive a student (admin only)
studentsRouter.put('/:id/unarchive', async (request, response) => {
  const token = getTokenFrom(request)

  if (!token) {
    return response.status(401).json({ error: 'Token missing' })
  }

  try {
    const decodedToken = jwt.verify(token, process.env.SECRET)
    if (!decodedToken.id) {
      return response.status(401).json({ error: 'Token invalid' })
    }

    const user = await User.findById(decodedToken.id)
    if (!user) {
      return response.status(404).json({ error: 'User not found' })
    }

    if (user.role !== 'admin') {
      return response.status(403).json({ error: 'Permission denied - admin access required' })
    }

    const student = await Student.findById(request.params.id)
    if (!student) {
      return response.status(404).json({ error: 'Student not found' })
    }

    student.isArchived = false
    await student.save()

    const updatedStudent = await Student.findById(request.params.id).populate('userId', { username: 1, name: 1, email: 1 })
    response.json(updatedStudent)
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return response.status(401).json({ error: 'Token invalid' })
    }
    if (error.name === 'TokenExpiredError') {
      return response.status(401).json({ error: 'Token expired' })
    }
    if (error.kind === 'ObjectId') {
      return response.status(400).json({ error: 'Malformatted id' })
    }
    response.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = studentsRouter
