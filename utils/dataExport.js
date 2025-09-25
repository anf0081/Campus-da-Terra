const User = require('../models/user')
const Student = require('../models/student')
const Dashboard = require('../models/dashboard')
const Book = require('../models/book')
const Notification = require('../models/notification')
const Document = require('../models/document')
const EventSignup = require('../models/eventSignup')

const sanitizeUserData = (user, options = {}) => {
  const sanitized = { ...user.toObject() }

  if (!options.preservePasswords) {
    delete sanitized.passwordHash
  }
  delete sanitized.__v
  if (sanitized._id) {
    sanitized.id = sanitized._id.toString()
    delete sanitized._id
  }

  if (sanitized.students && Array.isArray(sanitized.students)) {
    sanitized.students = sanitized.students.map(student =>
      typeof student === 'object' && student._id
        ? student._id.toString()
        : student.toString()
    )
  }

  return sanitized
}

const sanitizeDashboardData = (dashboard) => {
  if (!dashboard) return null

  const sanitized = { ...dashboard.toObject() }

  delete sanitized.__v
  if (sanitized._id) {
    sanitized.id = sanitized._id.toString()
    delete sanitized._id
  }

  if (sanitized.studentId) {
    sanitized.studentId = sanitized.studentId.toString()
  }

  if (sanitized.portfolios) {
    sanitized.portfolios = sanitized.portfolios.map(portfolio => ({
      fileName: portfolio.fileName,
      uploadDate: portfolio.uploadDate,
      portfolioUrl: portfolio.pdfUrl,
      _fileNote: 'File URL preserved - will be validated during import. Re-upload if inaccessible.'
    }))
  }

  if (sanitized.documents) {
    sanitized.documents = sanitized.documents.map(doc => ({
      name: doc.name,
      fileName: doc.fileName,
      uploadDate: doc.uploadDate,
      documentUrl: doc.url,
      _fileNote: 'File URL preserved - will be validated during import. Re-upload if inaccessible.'
    }))
  }

  if (sanitized.history) {
    sanitized.history = sanitized.history.map(event => ({
      type: event.type,
      date: event.date,
      month: event.month,
      year: event.year,
      donorName: event.donorName,
      donationAmount: event.donationAmount,
      paymentStatus: event.paymentStatus,
      fileName: event.fileName,
      receiptUrl: event.downloadUrl,
      description: event.description,
      _fileNote: event.fileName && event.downloadUrl ? 'File URL preserved - will be validated during import. Re-upload if inaccessible.' : undefined
    }))
  }

  return sanitized
}

const sanitizeStudentData = (student, dashboard = null) => {
  const sanitized = { ...student.toObject() }

  delete sanitized.__v
  if (sanitized._id) {
    sanitized.id = sanitized._id.toString()
    delete sanitized._id
  }

  if (sanitized.userId) {
    if (typeof sanitized.userId === 'object' && sanitized.userId._id) {
      sanitized.parentUsername = sanitized.userId.username
      sanitized.userId = sanitized.userId._id.toString()
    } else {
      sanitized.userId = sanitized.userId.toString()
    }
  }

  if (dashboard) {
    sanitized.dashboard = sanitizeDashboardData(dashboard)
  }

  return sanitized
}

const exportUsers = async (filters = {}, options = {}) => {
  let query = {}

  if (filters.role) {
    query.role = filters.role
  }

  const users = await User.find(query).sort({ createdAt: -1 })

  const exportData = {
    _metadata: {
      exportType: 'users',
      exportTimestamp: new Date().toISOString(),
      totalRecords: users.length,
      filters: filters,
      preservePasswords: !!options.preservePasswords
    },
    users: users.map(user => sanitizeUserData(user, options))
  }

  return exportData
}

const exportStudents = async (filters = {}) => {
  let query = {}

  if (filters.startMonth || filters.endMonth) {
    query.enrollmentStartDate = {}

    if (filters.startMonth) {
      const startDate = new Date(filters.startMonth + '-01')
      query.enrollmentStartDate.$gte = startDate
    }

    if (filters.endMonth) {
      const endDate = new Date(filters.endMonth + '-01')
      endDate.setMonth(endDate.getMonth() + 1)
      endDate.setDate(0)
      query.enrollmentStartDate.$lte = endDate
    }
  }

  if (filters.userId) {
    query.userId = filters.userId
  }

  const students = await Student.find(query)
    .populate('userId', 'username')
    .sort({ enrollmentStartDate: -1, createdAt: -1 })

  let dashboardsByStudent = {}
  if (filters.includeDashboard) {
    const studentIds = students.map(s => s._id)
    const dashboards = await Dashboard.find({ studentId: { $in: studentIds } })
    dashboards.forEach(dashboard => {
      dashboardsByStudent[dashboard.studentId.toString()] = dashboard
    })
  }

  const exportData = {
    _metadata: {
      exportType: 'students',
      exportTimestamp: new Date().toISOString(),
      totalRecords: students.length,
      filters: filters,
      includeDashboard: !!filters.includeDashboard
    },
    students: students.map(student =>
      sanitizeStudentData(student, dashboardsByStudent[student._id.toString()])
    )
  }

  return exportData
}

const exportUsersWithStudents = async (filters = {}, options = {}) => {
  let userQuery = {}

  if (filters.role) {
    userQuery.role = filters.role
  }

  const users = await User.find(userQuery)
    .populate('students')
    .sort({ createdAt: -1 })

  const exportData = {
    _metadata: {
      exportType: 'users-with-students',
      exportTimestamp: new Date().toISOString(),
      totalUsers: users.length,
      totalStudents: users.reduce((acc, user) => acc + (user.students?.length || 0), 0),
      filters: filters,
      preservePasswords: !!options.preservePasswords
    },
    data: users.map(user => ({
      user: sanitizeUserData(user, options),
      students: user.students ? user.students.map(sanitizeStudentData) : []
    }))
  }

  return exportData
}

const exportUserWithStudents = async (userId) => {
  const user = await User.findById(userId).populate('students')

  if (!user) {
    throw new Error('User not found')
  }

  const exportData = {
    _metadata: {
      exportType: 'single-user-with-students',
      exportTimestamp: new Date().toISOString(),
      userId: userId
    },
    user: sanitizeUserData(user),
    students: user.students ? user.students.map(sanitizeStudentData) : []
  }

  return exportData
}

const exportNotifications = async (filters = {}) => {
  let query = {}

  if (filters.startDate || filters.endDate) {
    query.createdAt = {}

    if (filters.startDate) {
      query.createdAt.$gte = new Date(filters.startDate)
    }

    if (filters.endDate) {
      const endDate = new Date(filters.endDate)
      endDate.setHours(23, 59, 59, 999)
      query.createdAt.$lte = endDate
    }
  }

  if (filters.targetType) {
    query.targetType = filters.targetType
  }

  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })

  const sanitizedNotifications = notifications.map(notification => {
    const sanitized = { ...notification.toObject() }
    delete sanitized.__v

    if (sanitized._id) {
      sanitized.id = sanitized._id.toString()
      delete sanitized._id
    }

    if (sanitized.attachmentUrl) {
      sanitized._attachmentNote = 'File URL preserved - will be validated during import. Re-upload if inaccessible.'
    }

    return sanitized
  })

  const exportData = {
    _metadata: {
      exportType: 'notifications',
      exportTimestamp: new Date().toISOString(),
      totalRecords: sanitizedNotifications.length,
      filters: filters
    },
    notifications: sanitizedNotifications
  }

  return exportData
}

const exportDocuments = async (filters = {}) => {
  const documents = await Document.find({})
    .sort({ createdAt: -1 })

  const sanitizedDocuments = documents.map(doc => {
    const sanitized = { ...doc.toObject() }
    delete sanitized.__v

    if (sanitized._id) {
      sanitized.id = sanitized._id.toString()
      delete sanitized._id
    }

    if (sanitized.documents) {
      sanitized.documents = sanitized.documents.map(file => ({
        name: file.name,
        fileName: file.fileName,
        uploadDate: file.uploadDate,
        documentUrl: file.fileUrl || file.documentUrl,
        uploadedBy: file.uploadedBy ? file.uploadedBy.toString() : undefined,
        _fileNote: file.fileName && (file.fileUrl || file.documentUrl) ? 'File URL preserved - will be validated during import. Re-upload if inaccessible.' : undefined
      }))
    }

    return sanitized
  })

  const exportData = {
    _metadata: {
      exportType: 'documents',
      exportTimestamp: new Date().toISOString(),
      totalRecords: sanitizedDocuments.length,
      filters: filters
    },
    documents: sanitizedDocuments
  }

  return exportData
}

const exportEventSignups = async (filters = {}) => {
  let query = {}

  if (filters.startDate || filters.endDate) {
    query.eventDate = {}

    if (filters.startDate) {
      query.eventDate.$gte = new Date(filters.startDate)
    }

    if (filters.endDate) {
      const endDate = new Date(filters.endDate)
      endDate.setHours(23, 59, 59, 999)
      query.eventDate.$lte = endDate
    }
  }

  if (filters.isActive !== undefined) {
    query.isActive = filters.isActive
  }

  const eventSignups = await EventSignup.find(query)
    .populate('signups.userId', 'username name')
    .sort({ eventDate: -1 })

  const sanitizedEventSignups = eventSignups.map(eventSignup => {
    const sanitized = { ...eventSignup.toObject() }
    delete sanitized.__v

    if (sanitized._id) {
      sanitized.id = sanitized._id.toString()
      delete sanitized._id
    }

    if (sanitized.createdBy) {
      sanitized.createdByUsername = sanitized.createdBy.username
      sanitized.createdBy = sanitized.createdBy._id ? sanitized.createdBy._id.toString() : sanitized.createdBy.toString()
    }

    if (sanitized.signups) {
      sanitized.signups = sanitized.signups.map(signup => ({
        id: signup._id ? signup._id.toString() : undefined,
        userId: signup.userId._id ? signup.userId._id.toString() : signup.userId.toString(),
        userUsername: signup.userId.username,
        userName: signup.userName,
        responsibility: signup.responsibility,
        notes: signup.notes,
        createdAt: signup.createdAt,
        updatedAt: signup.updatedAt
      }))
    }

    return sanitized
  })

  const exportData = {
    _metadata: {
      exportType: 'event-signups',
      exportTimestamp: new Date().toISOString(),
      totalRecords: sanitizedEventSignups.length,
      filters: filters
    },
    eventSignups: sanitizedEventSignups
  }

  return exportData
}

const exportBooks = async (filters = {}) => {
  let query = {}

  if (filters.availability) {
    if (filters.availability === 'available') {
      query['lending.borrower'] = null
    } else if (filters.availability === 'lent') {
      query['lending.borrower'] = { $ne: null }
    }
  }

  const books = await Book.find(query)
    .populate('lending.borrower', 'username name')
    .populate('lendingHistory.borrower', 'username name')
    .sort({ title: 1 })

  const sanitizedBooks = books.map(book => {
    const sanitized = { ...book.toObject() }
    delete sanitized.__v

    if (sanitized._id) {
      sanitized.id = sanitized._id.toString()
      delete sanitized._id
    }

    if (sanitized.lending && sanitized.lending.borrower) {
      sanitized.lentToUsername = sanitized.lending.borrower.username
      sanitized.lentTo = sanitized.lending.borrower._id ? sanitized.lending.borrower._id.toString() : sanitized.lending.borrower.toString()
    }

    if (sanitized.lendingHistory) {
      sanitized.lendingHistory = sanitized.lendingHistory.map(entry => ({
        user: entry.user._id ? entry.user._id.toString() : entry.user.toString(),
        username: entry.user.username,
        lentDate: entry.lentDate,
        returnedDate: entry.returnedDate
      }))
    }

    return sanitized
  })

  const exportData = {
    _metadata: {
      exportType: 'books',
      exportTimestamp: new Date().toISOString(),
      totalRecords: sanitizedBooks.length,
      filters: filters
    },
    books: sanitizedBooks
  }

  return exportData
}

const exportAllData = async (filters = {}, options = {}) => {
  const exportTimestamp = new Date().toISOString()

  const exportOptions = {
    preservePasswords: options.preservePasswords !== false,
    ...options
  }

  const [
    usersData,
    studentsData,
    notificationsData,
    documentsData,
    booksData,
    eventSignupsData
  ] = await Promise.all([
    exportUsers(filters.users || {}, exportOptions),
    exportStudents({ ...filters.students, includeDashboard: true }),
    exportNotifications(filters.notifications || {}),
    exportDocuments(filters.documents || {}),
    exportBooks(filters.books || {}),
    exportEventSignups(filters.eventSignups || {})
  ])

  const combinedData = {
    _metadata: {
      exportType: 'complete-system-backup',
      exportTimestamp,
      version: '1.0',
      systemInfo: {
        totalUsers: usersData.users.length,
        totalStudents: studentsData.students.length,
        totalNotifications: notificationsData.notifications.length,
        totalDocumentSections: documentsData.documents.length,
        totalBooks: booksData.books.length,
        totalEventSignups: eventSignupsData.eventSignups.length
      },
      filters: filters,
      options: exportOptions,
      sections: ['users', 'students', 'notifications', 'documents', 'books', 'eventSignups'],
      notes: {
        students: 'Includes dashboard data (portfolios, documents, history)',
        files: 'File URLs preserved - will be validated during import. Re-upload if inaccessible.',
        import: 'Import users first, then students, then other data types',
        passwords: exportOptions.preservePasswords
          ? 'WARNING: User password hashes are included for login functionality - store securely!'
          : 'User password hashes excluded - users will need password reset after import'
      }
    },
    users: {
      metadata: usersData._metadata,
      data: usersData.users
    },
    students: {
      metadata: {
        ...studentsData._metadata,
        includeDashboard: true,
        dashboardNote: 'Dashboard data included for complete backup'
      },
      data: studentsData.students
    },
    notifications: {
      metadata: notificationsData._metadata,
      data: notificationsData.notifications
    },
    documents: {
      metadata: documentsData._metadata,
      data: documentsData.documents
    },
    books: {
      metadata: booksData._metadata,
      data: booksData.books
    },
    eventSignups: {
      metadata: eventSignupsData._metadata,
      data: eventSignupsData.eventSignups
    }
  }

  return combinedData
}

module.exports = {
  sanitizeUserData,
  sanitizeStudentData,
  sanitizeDashboardData,
  exportUsers,
  exportStudents,
  exportUsersWithStudents,
  exportUserWithStudents,
  exportNotifications,
  exportDocuments,
  exportEventSignups,
  exportBooks,
  exportAllData
}