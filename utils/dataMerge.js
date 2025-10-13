const { validateFileUrl } = require('./cloudinary')

const deepMerge = (existing, incoming, strategy = 'prefer-incoming') => {
  const result = { ...existing }

  for (const key in incoming) {
    if (Object.prototype.hasOwnProperty.call(incoming, key)) {
      const incomingValue = incoming[key]
      const existingValue = existing[key]

      if (strategy === 'prefer-incoming-non-empty' &&
          (incomingValue === null || incomingValue === undefined || incomingValue === '')) {
        continue
      }

      if (Array.isArray(incomingValue)) {
        if (strategy === 'merge-arrays' && Array.isArray(existingValue)) {
          result[key] = [...new Set([...existingValue, ...incomingValue])]
        } else {
          result[key] = incomingValue
        }
      }
      else if (incomingValue && typeof incomingValue === 'object' && !Array.isArray(incomingValue)) {
        if (existingValue && typeof existingValue === 'object') {
          result[key] = deepMerge(existingValue, incomingValue, strategy)
        } else {
          result[key] = incomingValue
        }
      }
      else {
        result[key] = incomingValue
      }
    }
  }

  return result
}

const mergeUserData = (existingUser, incomingUser, strategy = 'prefer-incoming-non-empty') => {
  const protectedFields = ['_id', 'passwordHash', '__v', 'createdAt', 'students']
  const cleanIncoming = { ...incomingUser }
  protectedFields.forEach(field => delete cleanIncoming[field])

  let merged
  switch (strategy) {
    case 'replace':
      merged = { ...existingUser.toObject(), ...cleanIncoming }
      break
    case 'merge':
      merged = deepMerge(existingUser.toObject(), cleanIncoming, 'prefer-incoming-non-empty')
      break
    case 'prefer-incoming':
      merged = deepMerge(existingUser.toObject(), cleanIncoming, 'prefer-incoming')
      break
    default:
      merged = deepMerge(existingUser.toObject(), cleanIncoming, strategy)
  }

  protectedFields.forEach(field => {
    if (existingUser[field] !== undefined) {
      merged[field] = existingUser[field]
    }
  })

  return merged
}

const validateNotificationFiles = async (notificationData) => {
  const validationResults = {
    validFiles: [],
    invalidFiles: [],
    externalFiles: [],
    warnings: []
  }

  if (!notificationData || !notificationData.attachmentUrl) {
    return validationResults
  }

  try {
    const validation = await validateFileUrl(notificationData.attachmentUrl, notificationData.attachmentFileName)
    if (validation.isValid) {
      if (validation.isExternal) {
        validationResults.externalFiles.push({
          type: 'notification-attachment',
          url: notificationData.attachmentUrl,
          fileName: notificationData.attachmentFileName,
          message: validation.message
        })
      } else {
        validationResults.validFiles.push({
          type: 'notification-attachment',
          url: notificationData.attachmentUrl,
          fileName: notificationData.attachmentFileName
        })
      }
    } else {
      validationResults.invalidFiles.push({
        type: 'notification-attachment',
        url: notificationData.attachmentUrl,
        fileName: notificationData.attachmentFileName,
        error: validation.error,
        suggestion: validation.suggestion
      })
    }
  } catch (error) {
    validationResults.warnings.push(`Error validating notification attachment ${notificationData.attachmentFileName}: ${error.message}`)
  }

  return validationResults
}

const validateDocumentFiles = async (documentData) => {
  const validationResults = {
    validFiles: [],
    invalidFiles: [],
    externalFiles: [],
    warnings: []
  }

  if (!documentData || !documentData.documents || !Array.isArray(documentData.documents)) {
    return validationResults
  }

  for (const doc of documentData.documents) {
    if (doc.documentUrl) {
      try {
        const validation = await validateFileUrl(doc.documentUrl, doc.fileName)
        if (validation.isValid) {
          if (validation.isExternal) {
            validationResults.externalFiles.push({
              type: 'document',
              url: doc.documentUrl,
              fileName: doc.fileName,
              name: doc.name,
              message: validation.message
            })
          } else {
            validationResults.validFiles.push({
              type: 'document',
              url: doc.documentUrl,
              fileName: doc.fileName,
              name: doc.name
            })
          }
        } else {
          validationResults.invalidFiles.push({
            type: 'document',
            url: doc.documentUrl,
            fileName: doc.fileName,
            name: doc.name,
            error: validation.error,
            suggestion: validation.suggestion
          })
        }
      } catch (error) {
        validationResults.warnings.push(`Error validating document file ${doc.name}: ${error.message}`)
      }
    }
  }

  return validationResults
}

const validateDashboardFiles = async (dashboardData) => {
  const validationResults = {
    validFiles: [],
    invalidFiles: [],
    externalFiles: [],
    warnings: []
  }

  if (!dashboardData) return validationResults

  if (dashboardData.portfolios && Array.isArray(dashboardData.portfolios)) {
    for (const portfolio of dashboardData.portfolios) {
      const fileUrl = portfolio.portfolioUrl || portfolio.pdfUrl
      if (fileUrl) {
        try {
          const validation = await validateFileUrl(fileUrl, portfolio.fileName)
          if (validation.isValid) {
            if (validation.isExternal) {
              validationResults.externalFiles.push({
                type: 'portfolio',
                url: fileUrl,
                fileName: portfolio.fileName,
                message: validation.message
              })
            } else {
              validationResults.validFiles.push({
                type: 'portfolio',
                url: fileUrl,
                fileName: portfolio.fileName
              })
            }
          } else {
            validationResults.invalidFiles.push({
              type: 'portfolio',
              url: fileUrl,
              fileName: portfolio.fileName,
              error: validation.error,
              suggestion: validation.suggestion
            })
          }
        } catch (error) {
          validationResults.warnings.push(`Error validating portfolio file ${portfolio.fileName}: ${error.message}`)
        }
      }
    }
  }

  if (dashboardData.documents && Array.isArray(dashboardData.documents)) {
    for (const document of dashboardData.documents) {
      const fileUrl = document.documentUrl || document.url
      if (fileUrl) {
        try {
          const validation = await validateFileUrl(fileUrl, document.fileName)
          if (validation.isValid) {
            if (validation.isExternal) {
              validationResults.externalFiles.push({
                type: 'document',
                url: fileUrl,
                fileName: document.fileName,
                name: document.name,
                message: validation.message
              })
            } else {
              validationResults.validFiles.push({
                type: 'document',
                url: fileUrl,
                fileName: document.fileName,
                name: document.name
              })
            }
          } else {
            validationResults.invalidFiles.push({
              type: 'document',
              url: fileUrl,
              fileName: document.fileName,
              name: document.name,
              error: validation.error,
              suggestion: validation.suggestion
            })
          }
        } catch (error) {
          validationResults.warnings.push(`Error validating document file ${document.name}: ${error.message}`)
        }
      }
    }
  }

  if (dashboardData.history && Array.isArray(dashboardData.history)) {
    for (const event of dashboardData.history) {
      const fileUrl = event.receiptUrl || event.downloadUrl
      if (fileUrl) {
        try {
          const validation = await validateFileUrl(fileUrl, event.fileName)
          if (validation.isValid) {
            if (validation.isExternal) {
              validationResults.externalFiles.push({
                type: 'receipt',
                url: fileUrl,
                fileName: event.fileName,
                eventType: event.type,
                message: validation.message
              })
            } else {
              validationResults.validFiles.push({
                type: 'receipt',
                url: fileUrl,
                fileName: event.fileName,
                eventType: event.type
              })
            }
          } else {
            validationResults.invalidFiles.push({
              type: 'receipt',
              url: fileUrl,
              fileName: event.fileName,
              eventType: event.type,
              error: validation.error,
              suggestion: validation.suggestion
            })
          }
        } catch (error) {
          validationResults.warnings.push(`Error validating receipt file ${event.fileName}: ${error.message}`)
        }
      }
    }
  }

  return validationResults
}

const mergeDashboardData = (existingDashboard, incomingDashboard, strategy = 'prefer-incoming-non-empty') => {
  if (!incomingDashboard) return existingDashboard

  const protectedFields = ['_id', '__v', 'createdAt', 'studentId']
  const cleanIncoming = { ...incomingDashboard }
  protectedFields.forEach(field => delete cleanIncoming[field])

  let merged
  if (!existingDashboard) {
    merged = cleanIncoming
  } else {
    switch (strategy) {
      case 'replace':
        merged = { ...existingDashboard.toObject(), ...cleanIncoming }
        break
      case 'merge':
        merged = deepMerge(existingDashboard.toObject(), cleanIncoming, 'prefer-incoming-non-empty')

        if (cleanIncoming.portfolios && Array.isArray(cleanIncoming.portfolios)) {
          merged.portfolios = [...(merged.portfolios || []), ...cleanIncoming.portfolios]
        }
        if (cleanIncoming.documents && Array.isArray(cleanIncoming.documents)) {
          merged.documents = [...(merged.documents || []), ...cleanIncoming.documents]
        }
        if (cleanIncoming.history && Array.isArray(cleanIncoming.history)) {
          merged.history = [...(merged.history || []), ...cleanIncoming.history]
        }
        break
      case 'prefer-incoming':
        merged = deepMerge(existingDashboard.toObject(), cleanIncoming, 'prefer-incoming')
        break
      default:
        merged = deepMerge(existingDashboard.toObject(), cleanIncoming, strategy)
    }

    protectedFields.forEach(field => {
      if (existingDashboard[field] !== undefined) {
        merged[field] = existingDashboard[field]
      }
    })
  }

  return merged
}

const mergeStudentData = (existingStudent, incomingStudent, strategy = 'prefer-incoming-non-empty') => {
  const protectedFields = ['_id', '__v', 'createdAt']

  const cleanIncoming = { ...incomingStudent }
  protectedFields.forEach(field => delete cleanIncoming[field])

  const incomingDashboard = cleanIncoming.dashboard
  delete cleanIncoming.dashboard

  let merged
  switch (strategy) {
    case 'replace':
      merged = { ...existingStudent.toObject(), ...cleanIncoming }
      break
    case 'merge':
      merged = deepMerge(existingStudent.toObject(), cleanIncoming, 'prefer-incoming-non-empty')

      if (cleanIncoming.motivationForJoining && Array.isArray(cleanIncoming.motivationForJoining)) {
        merged.motivationForJoining = cleanIncoming.motivationForJoining
      }
      break
    case 'prefer-incoming':
      merged = deepMerge(existingStudent.toObject(), cleanIncoming, 'prefer-incoming')
      break
    default:
      merged = deepMerge(existingStudent.toObject(), cleanIncoming, strategy)
  }

  protectedFields.forEach(field => {
    if (existingStudent[field] !== undefined) {
      merged[field] = existingStudent[field]
    }
  })

  return {
    studentData: merged,
    dashboardData: incomingDashboard
  }
}

const detectConflicts = (existing, incoming, entityType = 'user') => {
  const conflicts = []
  const protectedFields = entityType === 'user'
    ? ['_id', 'passwordHash', '__v', 'createdAt', 'students']
    : ['_id', '__v', 'createdAt']

  for (const key in incoming) {
    if (Object.prototype.hasOwnProperty.call(incoming, key) && !protectedFields.includes(key)) {
      const existingValue = existing[key]
      const incomingValue = incoming[key]

      if (existingValue !== incomingValue &&
          existingValue !== null && existingValue !== undefined && existingValue !== '' &&
          incomingValue !== null && incomingValue !== undefined && incomingValue !== '') {

        conflicts.push({
          field: key,
          existingValue,
          incomingValue,
          type: typeof incomingValue
        })
      }
    }
  }

  return conflicts
}

const findUserDuplicates = async (userData, User) => {
  const duplicates = []

  if (userData.username) {
    const userByUsername = await User.findOne({ username: userData.username })
    if (userByUsername) {
      duplicates.push({
        type: 'username',
        field: 'username',
        value: userData.username,
        existingUser: userByUsername,
        conflicts: detectConflicts(userByUsername, userData, 'user')
      })
    }
  }

  if (userData.email && (!duplicates.length || duplicates[0].existingUser.email !== userData.email)) {
    const userByEmail = await User.findOne({ email: userData.email })
    if (userByEmail && (!duplicates.length || userByEmail._id.toString() !== duplicates[0].existingUser._id.toString())) {
      duplicates.push({
        type: 'email',
        field: 'email',
        value: userData.email,
        existingUser: userByEmail,
        conflicts: detectConflicts(userByEmail, userData, 'user')
      })
    }
  }

  return duplicates
}

const findStudentDuplicates = async (studentData, Student) => {
  const duplicates = []

  if (studentData.firstName && studentData.lastName && studentData.dateOfBirth) {
    const existingStudent = await Student.findOne({
      firstName: studentData.firstName,
      lastName: studentData.lastName,
      dateOfBirth: studentData.dateOfBirth
    })

    if (existingStudent) {
      duplicates.push({
        type: 'name-dob',
        field: 'firstName + lastName + dateOfBirth',
        value: `${studentData.firstName} ${studentData.lastName} (${studentData.dateOfBirth})`,
        existingStudent: existingStudent,
        conflicts: detectConflicts(existingStudent, studentData, 'student')
      })
    }
  }

  return duplicates
}

const applyMerge = (existingData, mergedData, _entityType = 'user') => {
  const changes = []

  for (const key in mergedData) {
    if (Object.prototype.hasOwnProperty.call(mergedData, key) && existingData[key] !== mergedData[key]) {
      changes.push({
        field: key,
        oldValue: existingData[key],
        newValue: mergedData[key],
        timestamp: new Date().toISOString()
      })
    }
  }

  return {
    mergedData,
    changes,
    changeCount: changes.length
  }
}

const importAllData = async (backupData, options = {}, models = {}) => {
  const { User, Student, Dashboard, Notification, Document, Book, EventSignup } = models
  const { duplicateHandling = 'skip', previewOnly = false } = options

  const results = {
    users: { success: [], errors: [], duplicates: [], merged: [], warnings: [] },
    students: { success: [], errors: [], duplicates: [], merged: [], warnings: [] },
    notifications: { success: [], errors: [], duplicates: [], warnings: [] },
    documents: { success: [], errors: [], duplicates: [], warnings: [] },
    books: { success: [], errors: [], duplicates: [], warnings: [] },
    eventSignups: { success: [], errors: [], duplicates: [], warnings: [] },
    summary: {},
    errors: []
  }

  try {
    if (!backupData._metadata || backupData._metadata.exportType !== 'complete-system-backup') {
      throw new Error('Invalid backup format - not a complete system backup')
    }

    if (previewOnly) {
      return await previewAllDataImport(backupData, options, models)
    }

    if (backupData.users && backupData.users.data) {
      for (const userData of backupData.users.data) {
        try {
          const duplicates = await findUserDuplicates(userData, User)

          if (duplicates.length > 0) {
            const existingUser = duplicates[0].existingUser

            if (duplicateHandling === 'skip') {
              results.users.duplicates.push({
                username: userData.username,
                message: 'Skipped - duplicate found'
              })
              continue
            } else if (duplicateHandling === 'merge') {
              const mergedData = mergeUserData(existingUser, userData, 'merge')
              await User.findByIdAndUpdate(existingUser._id, mergedData)
              results.users.merged.push({
                username: userData.username,
                id: existingUser._id
              })
              continue
            }
          }

          const user = new User(userData)
          const savedUser = await user.save()
          results.users.success.push({
            username: savedUser.username,
            id: savedUser._id
          })
        } catch (error) {
          results.users.errors.push({
            username: userData.username || 'Unknown',
            error: error.message
          })
        }
      }
    }

    if (backupData.students && backupData.students.data) {
      for (const studentData of backupData.students.data) {
        try {
          const dashboardData = studentData.dashboard
          const cleanStudentData = { ...studentData }
          delete cleanStudentData.dashboard

          let fileValidation = null
          if (dashboardData) {
            try {
              fileValidation = await validateDashboardFiles(dashboardData)

              if (fileValidation.invalidFiles.length > 0) {
                results.students.warnings = results.students.warnings || []
                results.students.warnings.push({
                  student: `${studentData.firstName} ${studentData.lastName}`,
                  invalidFiles: fileValidation.invalidFiles.map(file => ({
                    type: file.type,
                    fileName: file.fileName,
                    error: file.error,
                    suggestion: file.suggestion
                  }))
                })
              }

              if (fileValidation.externalFiles.length > 0) {
                results.students.warnings = results.students.warnings || []
                results.students.warnings.push({
                  student: `${studentData.firstName} ${studentData.lastName}`,
                  externalFiles: fileValidation.externalFiles.map(file => ({
                    type: file.type,
                    fileName: file.fileName,
                    message: file.message
                  }))
                })
              }
            } catch (fileValidationError) {
              results.students.warnings = results.students.warnings || []
              results.students.warnings.push({
                student: `${studentData.firstName} ${studentData.lastName}`,
                fileValidationError: `File validation failed: ${fileValidationError.message}`
              })
            }
          }

          if (studentData.parentUsername) {
            const user = await User.findOne({ username: studentData.parentUsername })
            if (user) {
              cleanStudentData.userId = user._id
            } else {
              results.students.errors.push({
                name: `${studentData.firstName} ${studentData.lastName}`,
                error: `Parent user '${studentData.parentUsername}' not found`
              })
              continue
            }
            delete cleanStudentData.parentUsername
          }

          const duplicates = await findStudentDuplicates(cleanStudentData, Student)

          if (duplicates.length > 0) {
            const existingStudent = duplicates[0].existingStudent

            if (duplicateHandling === 'skip') {
              results.students.duplicates.push({
                name: `${studentData.firstName} ${studentData.lastName}`,
                message: 'Skipped - duplicate found'
              })
              continue
            } else if (duplicateHandling === 'merge') {
              const mergeResult = mergeStudentData(existingStudent, cleanStudentData, 'merge')
              await Student.findByIdAndUpdate(existingStudent._id, mergeResult.studentData)

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

              results.students.merged.push({
                name: `${studentData.firstName} ${studentData.lastName}`,
                id: existingStudent._id
              })
              continue
            }
          }

          const student = new Student(cleanStudentData)
          const savedStudent = await student.save()

          if (dashboardData) {

            const mappedDashboardData = {
              studentId: savedStudent._id
            }

            if (dashboardData.portfolios && Array.isArray(dashboardData.portfolios)) {
              mappedDashboardData.portfolios = dashboardData.portfolios.map(portfolio => ({
                pdfUrl: portfolio.portfolioUrl || portfolio.pdfUrl,
                fileName: portfolio.fileName,
                cloudinaryPublicId: portfolio.cloudinaryPublicId,
                uploadDate: portfolio.uploadDate
              }))
            }

            if (dashboardData.documents && Array.isArray(dashboardData.documents)) {
              mappedDashboardData.documents = dashboardData.documents.map(doc => ({
                name: doc.name,
                url: doc.documentUrl || doc.url,
                fileName: doc.fileName,
                cloudinaryPublicId: doc.cloudinaryPublicId,
                uploadDate: doc.uploadDate
              }))
            }

            if (dashboardData.history && Array.isArray(dashboardData.history)) {
              mappedDashboardData.history = dashboardData.history.map(event => ({
                type: event.type,
                date: event.date,
                month: event.month,
                year: event.year,
                donorName: event.donorName,
                donationAmount: event.donationAmount,
                paymentStatus: event.paymentStatus,
                downloadUrl: event.receiptUrl || event.downloadUrl,
                fileName: event.fileName,
                cloudinaryPublicId: event.cloudinaryPublicId,
                description: event.description
              }))
            }


            const dashboard = new Dashboard(mappedDashboardData)
            await dashboard.save()
          }

          if (cleanStudentData.userId) {
            await User.findByIdAndUpdate(cleanStudentData.userId, {
              $addToSet: { students: savedStudent._id }
            })
          }

          results.students.success.push({
            name: `${savedStudent.firstName} ${savedStudent.lastName}`,
            id: savedStudent._id
          })
        } catch (error) {
          results.students.errors.push({
            name: `${studentData.firstName || 'Unknown'} ${studentData.lastName || 'Student'}`,
            error: error.message,
            details: error.stack ? error.stack.split('\n')[0] : 'No stack trace available'
          })
        }
      }
    }

    if (backupData.notifications && backupData.notifications.data) {
      for (const notificationData of backupData.notifications.data) {
        try {
          if (notificationData.attachmentUrl) {
            try {
              const fileValidation = await validateNotificationFiles(notificationData)

              if (fileValidation.invalidFiles.length > 0) {
                results.notifications.warnings = results.notifications.warnings || []
                results.notifications.warnings.push({
                  notification: notificationData.title,
                  invalidFiles: fileValidation.invalidFiles.map(file => ({
                    type: file.type,
                    fileName: file.fileName,
                    error: file.error,
                    suggestion: file.suggestion
                  }))
                })
              }

              if (fileValidation.externalFiles.length > 0) {
                results.notifications.warnings = results.notifications.warnings || []
                results.notifications.warnings.push({
                  notification: notificationData.title,
                  externalFiles: fileValidation.externalFiles.map(file => ({
                    type: file.type,
                    fileName: file.fileName,
                    message: file.message
                  }))
                })
              }
            } catch (fileValidationError) {
              results.notifications.warnings = results.notifications.warnings || []
              results.notifications.warnings.push({
                notification: notificationData.title,
                fileValidationError: `File validation failed: ${fileValidationError.message}`
              })
            }
          }

          const cleanData = { ...notificationData }
          delete cleanData.id
          delete cleanData._id
          delete cleanData.attachmentMetadata
          delete cleanData._fileNote
          delete cleanData._attachmentNote

          const existing = await Notification.findOne({
            title: cleanData.title,
            message: cleanData.message
          })

          if (existing && duplicateHandling === 'skip') {
            results.notifications.duplicates.push({
              title: cleanData.title,
              message: 'Skipped - duplicate found'
            })
            continue
          }

          const notification = new Notification(cleanData)
          const saved = await notification.save()
          results.notifications.success.push({
            title: saved.title,
            id: saved._id
          })
        } catch (error) {
          results.notifications.errors.push({
            title: notificationData.title || 'Unknown',
            error: error.message
          })
        }
      }
    }

    if (backupData.documents && backupData.documents.data) {
      for (const documentData of backupData.documents.data) {
        try {
          if (documentData.documents && Array.isArray(documentData.documents)) {
            try {
              const fileValidation = await validateDocumentFiles(documentData)

              if (fileValidation.invalidFiles.length > 0) {
                results.documents.warnings = results.documents.warnings || []
                results.documents.warnings.push({
                  documentSection: documentData.title,
                  invalidFiles: fileValidation.invalidFiles.map(file => ({
                    type: file.type,
                    fileName: file.fileName,
                    name: file.name,
                    error: file.error,
                    suggestion: file.suggestion
                  }))
                })
              }

              if (fileValidation.externalFiles.length > 0) {
                results.documents.warnings = results.documents.warnings || []
                results.documents.warnings.push({
                  documentSection: documentData.title,
                  externalFiles: fileValidation.externalFiles.map(file => ({
                    type: file.type,
                    fileName: file.fileName,
                    name: file.name,
                    message: file.message
                  }))
                })
              }
            } catch (fileValidationError) {
              results.documents.warnings = results.documents.warnings || []
              results.documents.warnings.push({
                documentSection: documentData.title,
                fileValidationError: `File validation failed: ${fileValidationError.message}`
              })
            }
          }

          const cleanData = { ...documentData }
          delete cleanData.id
          delete cleanData._id
          delete cleanData._fileNote

          if (cleanData.documents && Array.isArray(cleanData.documents)) {
            cleanData.documents = cleanData.documents.map(doc => {
              const cleanDoc = { ...doc }
              delete cleanDoc._fileNote

              if (cleanDoc.documentUrl && !cleanDoc.fileUrl) {
                cleanDoc.fileUrl = cleanDoc.documentUrl
                delete cleanDoc.documentUrl
              }

              return cleanDoc
            })
          }

          const existing = await Document.findOne({ title: cleanData.title })

          if (existing && duplicateHandling === 'skip') {
            results.documents.duplicates.push({
              title: cleanData.title,
              message: 'Skipped - duplicate section found'
            })
            continue
          }

          const document = new Document(cleanData)
          const saved = await document.save()
          results.documents.success.push({
            title: saved.title,
            id: saved._id
          })
        } catch (error) {
          results.documents.errors.push({
            title: documentData.title || 'Unknown',
            error: error.message
          })
        }
      }
    }

    if (backupData.books && backupData.books.data) {
      for (const bookData of backupData.books.data) {
        try {
          const cleanData = { ...bookData }
          delete cleanData.id
          delete cleanData._id
          delete cleanData.lentToUsername

          if (cleanData.lentTo) {
            const user = await User.findById(cleanData.lentTo)
            if (!user) {
              cleanData.lentTo = null
              cleanData.lentDate = null
            }
          }

          const existing = await Book.findOne({
            title: cleanData.title,
            author: cleanData.author || ''
          })

          if (existing && duplicateHandling === 'skip') {
            results.books.duplicates.push({
              title: cleanData.title,
              message: 'Skipped - duplicate book found'
            })
            continue
          }

          const book = new Book(cleanData)
          const saved = await book.save()
          results.books.success.push({
            title: saved.title,
            id: saved._id
          })
        } catch (error) {
          results.books.errors.push({
            title: bookData.title || 'Unknown',
            error: error.message
          })
        }
      }
    }

    if (backupData.eventSignups && backupData.eventSignups.data) {
      for (const eventSignupData of backupData.eventSignups.data) {
        try {
          const cleanData = { ...eventSignupData }
          delete cleanData.id
          delete cleanData._id
          delete cleanData.createdByUsername

          if (cleanData.createdBy) {
            const user = await User.findById(cleanData.createdBy)
            if (!user) {
              cleanData.createdBy = undefined
            }
          }

          if (cleanData.signups && Array.isArray(cleanData.signups)) {
            const validSignups = []
            for (const signup of cleanData.signups) {
              const cleanSignup = { ...signup }
              delete cleanSignup.id
              delete cleanSignup._id
              delete cleanSignup.userUsername

              if (cleanSignup.userId) {
                const user = await User.findById(cleanSignup.userId)
                if (user) {
                  cleanSignup.userName = user.name || user.username
                  validSignups.push(cleanSignup)
                }
              }
            }
            cleanData.signups = validSignups
          }

          const existing = await EventSignup.findOne({
            eventTitle: cleanData.eventTitle,
            eventDate: cleanData.eventDate
          })

          if (existing && duplicateHandling === 'skip') {
            results.eventSignups.duplicates.push({
              eventTitle: cleanData.eventTitle,
              message: 'Skipped - duplicate event found'
            })
            continue
          } else if (existing && duplicateHandling === 'merge') {
            const existingSignupUserIds = existing.signups.map(s => s.userId.toString())
            const newSignups = cleanData.signups.filter(s =>
              !existingSignupUserIds.includes(s.userId.toString())
            )

            if (newSignups.length > 0) {
              existing.signups.push(...newSignups)
              existing.eventTitle = cleanData.eventTitle
              existing.eventDescription = cleanData.eventDescription
              existing.googleCalendarLink = cleanData.googleCalendarLink
              existing.maxSignups = cleanData.maxSignups
              existing.isActive = cleanData.isActive

              await existing.save()
              results.eventSignups.success.push({
                eventTitle: existing.eventTitle,
                id: existing._id,
                signupsAdded: newSignups.length
              })
            } else {
              results.eventSignups.duplicates.push({
                eventTitle: cleanData.eventTitle,
                message: 'No new signups to merge'
              })
            }
            continue
          }

          const eventSignup = new EventSignup(cleanData)
          const saved = await eventSignup.save()
          results.eventSignups.success.push({
            eventTitle: saved.eventTitle,
            id: saved._id,
            signupsCount: saved.signups.length
          })
        } catch (error) {
          results.eventSignups.errors.push({
            eventTitle: eventSignupData.eventTitle || 'Unknown',
            error: error.message
          })
        }
      }
    }

    results.summary = {
      users: {
        total: (backupData.users?.data || []).length,
        created: results.users.success.length,
        merged: results.users.merged.length,
        skipped: results.users.duplicates.length,
        errors: results.users.errors.length
      },
      students: {
        total: (backupData.students?.data || []).length,
        created: results.students.success.length,
        merged: results.students.merged.length,
        skipped: results.students.duplicates.length,
        errors: results.students.errors.length
      },
      notifications: {
        total: (backupData.notifications?.data || []).length,
        created: results.notifications.success.length,
        skipped: results.notifications.duplicates.length,
        errors: results.notifications.errors.length
      },
      documents: {
        total: (backupData.documents?.data || []).length,
        created: results.documents.success.length,
        skipped: results.documents.duplicates.length,
        errors: results.documents.errors.length
      },
      books: {
        total: (backupData.books?.data || []).length,
        created: results.books.success.length,
        skipped: results.books.duplicates.length,
        errors: results.books.errors.length
      },
      eventSignups: {
        total: (backupData.eventSignups?.data || []).length,
        created: results.eventSignups.success.length,
        skipped: results.eventSignups.duplicates.length,
        errors: results.eventSignups.errors.length
      }
    }

    return results

  } catch (error) {
    results.errors.push(error.message)
    throw error
  }
}

const previewAllDataImport = async (backupData, _options = {}, _models = {}) => {
  return {
    preview: true,
    message: 'Preview functionality would be implemented here',
    conflicts: [],
    missingReferences: [],
    summary: {}
  }
}

module.exports = {
  deepMerge,
  mergeUserData,
  mergeStudentData,
  mergeDashboardData,
  validateDashboardFiles,
  validateNotificationFiles,
  validateDocumentFiles,
  detectConflicts,
  findUserDuplicates,
  findStudentDuplicates,
  applyMerge,
  importAllData
}