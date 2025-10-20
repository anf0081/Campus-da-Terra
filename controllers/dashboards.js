const dashboardsRouter = require('express').Router()
const Dashboard = require('../models/dashboard')
const Student = require('../models/student')
const User = require('../models/user')
const { userExtractor } = require('../utils/middleware')
const {
  uploadPortfolio,
  uploadDocument,
  uploadInvoice,
  deleteFileByUrl,
  deleteFileByPublicId,
  getPublicIdFromUrl,
  getSignedUrl,
  getSignedDocumentUrlWithType,
  getSignedPDFViewUrl,
  getDownloadUrl
} = require('../utils/cloudinary')
const { sendDocumentUploadEmail, sendInvoiceUploadEmail } = require('../utils/emailService')

dashboardsRouter.get('/:studentId', userExtractor, async (request, response) => {
  try {
    const studentId = request.params.studentId

    const student = await Student.findById(studentId)
    if (!student) {
      return response.status(404).json({ error: 'Student not found' })
    }

    const isOwner = student.userId.toString() === request.user._id.toString()
    const isAdminOrTutor = request.user.role === 'admin' || request.user.role === 'tutor'

    if (!isOwner && !isAdminOrTutor) {
      return response.status(403).json({ error: 'Access denied' })
    }

    let dashboard = await Dashboard.findOne({ studentId }).populate('studentId', 'firstName lastName')

    if (!dashboard) {
      dashboard = new Dashboard({
        studentId,
        portfolios: [],
        documents: [],
        history: []
      })
      await dashboard.save()
      await dashboard.populate('studentId', 'firstName lastName')
    }

    response.json(dashboard)
  } catch {
    response.status(500).json({ error: 'Internal server error' })
  }
})

dashboardsRouter.put('/:studentId', userExtractor, async (request, response) => {
  try {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Only admins can edit dashboards' })
    }

    const studentId = request.params.studentId
    const updates = request.body

    const dashboard = await Dashboard.findOneAndUpdate(
      { studentId },
      updates,
      { new: true, runValidators: true }
    ).populate('studentId', 'firstName lastName')

    if (!dashboard) {
      return response.status(404).json({ error: 'Dashboard not found' })
    }

    response.json(dashboard)
  } catch (error) {
    response.status(400).json({ error: error.message })
  }
})

dashboardsRouter.post('/:studentId/portfolios', userExtractor, uploadPortfolio.single('portfolio'), async (request, response) => {
  try {
    if (request.user.role !== 'admin' && request.user.role !== 'tutor') {
      return response.status(403).json({ error: 'Only admins and tutors can upload portfolio' })
    }

    if (!request.file) {
      return response.status(400).json({ error: 'No file uploaded' })
    }

    const studentId = request.params.studentId
    const fileUrl = request.file.path

    let dashboard = await Dashboard.findOne({ studentId })
    if (!dashboard) {
      dashboard = new Dashboard({
        studentId,
        portfolios: [],
        documents: [],
        history: []
      })
    }

    const newPortfolio = {
      pdfUrl: fileUrl,
      fileName: request.file.originalname,
      cloudinaryPublicId: request.file.filename,
      uploadDate: new Date()
    }

    dashboard.portfolios.push(newPortfolio)

    await dashboard.save()
    await dashboard.populate('studentId', 'firstName lastName')

    response.json(dashboard)
  } catch {
    response.status(500).json({ error: 'Failed to upload portfolio' })
  }
})

dashboardsRouter.delete('/:studentId/portfolios/:portfolioId', userExtractor, async (request, response) => {
  try {
    if (request.user.role !== 'admin' && request.user.role !== 'tutor') {
      return response.status(403).json({ error: 'Only admins and tutors can delete portfolio' })
    }

    const studentId = request.params.studentId
    const portfolioId = request.params.portfolioId
    const dashboard = await Dashboard.findOne({ studentId })

    if (!dashboard) {
      return response.status(404).json({ error: 'Dashboard not found' })
    }

    const portfolioIndex = dashboard.portfolios.findIndex(portfolio => portfolio._id.toString() === portfolioId)

    if (portfolioIndex === -1) {
      return response.status(404).json({ error: 'Portfolio not found' })
    }

    const portfolio = dashboard.portfolios[portfolioIndex]

    if (portfolio.pdfUrl) {
      try {
        if (portfolio.cloudinaryPublicId) {
          await deleteFileByPublicId(portfolio.cloudinaryPublicId, portfolio.fileName || 'portfolio.pdf')
        } else {
          await deleteFileByUrl(portfolio.pdfUrl, portfolio.fileName || 'portfolio.pdf')
        }
      } catch {
        // Ignore cleanup errors - portfolio deletion should continue
      }
    }

    dashboard.portfolios.splice(portfolioIndex, 1)
    await dashboard.save()
    await dashboard.populate('studentId', 'firstName lastName')

    response.json(dashboard)
  } catch {
    response.status(500).json({ error: 'Failed to delete portfolio' })
  }
})

dashboardsRouter.put('/:studentId/portfolios/:portfolioId', userExtractor, uploadPortfolio.single('portfolio'), async (request, response) => {
  try {
    if (request.user.role !== 'admin' && request.user.role !== 'tutor') {
      return response.status(403).json({ error: 'Only admins and tutors can replace portfolio' })
    }

    if (!request.file) {
      return response.status(400).json({ error: 'No file uploaded' })
    }

    const studentId = request.params.studentId
    const portfolioId = request.params.portfolioId
    const fileUrl = request.file.path

    const dashboard = await Dashboard.findOne({ studentId })

    if (!dashboard) {
      return response.status(404).json({ error: 'Dashboard not found' })
    }

    const portfolioIndex = dashboard.portfolios.findIndex(portfolio => portfolio._id.toString() === portfolioId)

    if (portfolioIndex === -1) {
      return response.status(404).json({ error: 'Portfolio not found' })
    }

    const oldPortfolio = dashboard.portfolios[portfolioIndex]

    if (oldPortfolio.pdfUrl) {
      try {
        if (oldPortfolio.cloudinaryPublicId) {
          await deleteFileByPublicId(oldPortfolio.cloudinaryPublicId, oldPortfolio.fileName || 'portfolio.pdf')
        } else {
          await deleteFileByUrl(oldPortfolio.pdfUrl, oldPortfolio.fileName || 'portfolio.pdf')
        }
      } catch {
        // Ignore cleanup errors - portfolio deletion should continue
      }
    }

    dashboard.portfolios[portfolioIndex] = {
      _id: oldPortfolio._id,
      pdfUrl: fileUrl,
      fileName: request.file.originalname,
      cloudinaryPublicId: request.file.filename,
      uploadDate: new Date()
    }

    await dashboard.save()
    await dashboard.populate('studentId', 'firstName lastName')

    response.json(dashboard)
  } catch {
    response.status(500).json({ error: 'Failed to replace portfolio' })
  }
})

dashboardsRouter.post('/:studentId/documents', userExtractor, uploadDocument.single('document'), async (request, response) => {
  try {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Only admins can add documents' })
    }

    if (!request.file) {
      return response.status(400).json({ error: 'No file uploaded' })
    }

    const { name } = request.body
    if (!name) {
      return response.status(400).json({ error: 'Document name is required' })
    }

    const studentId = request.params.studentId
    const fileUrl = request.file.path

    let dashboard = await Dashboard.findOne({ studentId })
    if (!dashboard) {
      dashboard = new Dashboard({ studentId })
    }

    dashboard.documents.push({
      name,
      url: fileUrl,
      fileName: request.file.originalname,
      cloudinaryPublicId: request.file.filename,
      uploadDate: new Date()
    })

    await dashboard.save()
    await dashboard.populate('studentId', 'firstName lastName')

    // Send email notification asynchronously
    sendDocumentUploadNotification(studentId, name, request.file.originalname, request.user).catch(error => {
      console.error('Error sending document upload email:', error)
      // Don't fail the request if email sending fails
    })

    response.json(dashboard)
  } catch {
    response.status(500).json({ error: 'Failed to add document' })
  }
})

dashboardsRouter.delete('/:studentId/documents/:documentId', userExtractor, async (request, response) => {
  try {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Only admins can remove documents' })
    }

    const { studentId, documentId } = request.params

    const dashboard = await Dashboard.findOne({ studentId })
    if (!dashboard) {
      return response.status(404).json({ error: 'Dashboard not found' })
    }

    const document = dashboard.documents.id(documentId)
    if (!document) {
      return response.status(404).json({ error: 'Document not found' })
    }

    if (document.url) {
      try {
        if (document.cloudinaryPublicId) {
          await deleteFileByPublicId(document.cloudinaryPublicId, document.fileName || 'document')
        } else {
          await deleteFileByUrl(document.url, document.fileName || 'document')
        }
      } catch {
        // Ignore cleanup errors - portfolio deletion should continue
      }
    }

    dashboard.documents.pull(documentId)
    await dashboard.save()
    await dashboard.populate('studentId', 'firstName lastName')

    response.json(dashboard)
  } catch {
    response.status(500).json({ error: 'Failed to remove document' })
  }
})

dashboardsRouter.post('/:studentId/history', userExtractor, async (request, response) => {
  try {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Only admins can add history events' })
    }

    const studentId = request.params.studentId
    const { type, date, month, year, donorName, donationAmount, paymentStatus, downloadUrl, description } = request.body

    if (!type || !date) {
      return response.status(400).json({ error: 'Type and date are required' })
    }

    if (type === 'donation_receipt') {
      if (!donorName) {
        return response.status(400).json({ error: 'Donor name is required for donation receipts' })
      }
      if (!donationAmount || donationAmount <= 0) {
        return response.status(400).json({ error: 'Valid donation amount is required for donation receipts' })
      }
    }

    let dashboard = await Dashboard.findOne({ studentId })
    if (!dashboard) {
      dashboard = new Dashboard({ studentId })
    }

    const historyEvent = {
      type,
      date: new Date(date),
      description
    }

    if (type === 'receipt') {
      historyEvent.month = month
      historyEvent.year = year
      historyEvent.paymentStatus = paymentStatus || 'not_paid'
    } else if (type === 'donation_receipt') {
      historyEvent.donorName = donorName
      historyEvent.donationAmount = donationAmount
    }

    if (downloadUrl) {
      historyEvent.downloadUrl = downloadUrl
    }

    dashboard.history.push(historyEvent)

    dashboard.history.sort((a, b) => new Date(a.date) - new Date(b.date))

    await dashboard.save()
    await dashboard.populate('studentId', 'firstName lastName')

    response.json(dashboard)
  } catch (error) {
    response.status(400).json({ error: error.message })
  }
})

dashboardsRouter.put('/:studentId/history/:historyId', userExtractor, async (request, response) => {
  try {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Only admins can update history events' })
    }

    const { studentId, historyId } = request.params
    const { date, type, description, amount, isPaid } = request.body

    const dashboard = await Dashboard.findOne({ studentId })
    if (!dashboard) {
      return response.status(404).json({ error: 'Dashboard not found' })
    }

    const historyEvent = dashboard.history.id(historyId)
    if (!historyEvent) {
      return response.status(404).json({ error: 'History event not found' })
    }

    // Update fields if provided
    if (date !== undefined) historyEvent.date = date
    if (type !== undefined) historyEvent.type = type
    if (description !== undefined) historyEvent.description = description
    if (amount !== undefined) historyEvent.amount = amount
    if (isPaid !== undefined) historyEvent.isPaid = isPaid

    await dashboard.save()
    await dashboard.populate('studentId', 'firstName lastName')

    response.json(dashboard)
  } catch {
    response.status(500).json({ error: 'Failed to update history event' })
  }
})

dashboardsRouter.delete('/:studentId/history/:historyId', userExtractor, async (request, response) => {
  try {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Only admins can remove history events' })
    }

    const { studentId, historyId } = request.params

    const dashboard = await Dashboard.findOne({ studentId })
    if (!dashboard) {
      return response.status(404).json({ error: 'Dashboard not found' })
    }

    const historyEvent = dashboard.history.id(historyId)
    if (historyEvent && historyEvent.downloadUrl) {
      try {
        if (historyEvent.cloudinaryPublicId) {
          await deleteFileByPublicId(historyEvent.cloudinaryPublicId, historyEvent.fileName || 'invoice')
        } else {
          await deleteFileByUrl(historyEvent.downloadUrl, historyEvent.fileName || 'invoice')
        }
      } catch {
        // Ignore cleanup errors - history deletion should continue
      }
    }

    dashboard.history.pull(historyId)
    await dashboard.save()
    await dashboard.populate('studentId', 'firstName lastName')

    response.json(dashboard)
  } catch {
    response.status(500).json({ error: 'Failed to remove history event' })
  }
})

dashboardsRouter.post('/:studentId/history/:historyId/receipt', userExtractor, uploadInvoice.single('receiptFile'), async (request, response) => {
  try {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Only admins can upload invoices' })
    }

    if (!request.file) {
      return response.status(400).json({ error: 'Invoice file is required' })
    }

    const { studentId, historyId } = request.params
    const fileUrl = request.file.path

    const dashboard = await Dashboard.findOne({ studentId })
    if (!dashboard) {
      return response.status(404).json({ error: 'Dashboard not found' })
    }

    const historyEvent = dashboard.history.id(historyId)
    if (!historyEvent) {
      return response.status(404).json({ error: 'History event not found' })
    }

    if (historyEvent.type !== 'receipt' && historyEvent.type !== 'donation_receipt') {
      return response.status(400).json({ error: 'Can only upload files for receipt and donation receipt events' })
    }

    if (historyEvent.downloadUrl) {
      try {
        if (historyEvent.cloudinaryPublicId) {
          await deleteFileByPublicId(historyEvent.cloudinaryPublicId, historyEvent.fileName || 'invoice')
        } else {
          await deleteFileByUrl(historyEvent.downloadUrl, historyEvent.fileName || 'invoice')
        }
      } catch {
        // Ignore cleanup errors - portfolio deletion should continue
      }
    }

    historyEvent.downloadUrl = fileUrl
    historyEvent.fileName = request.file.originalname
    historyEvent.cloudinaryPublicId = request.file.filename

    await dashboard.save()
    await dashboard.populate('studentId', 'firstName lastName')

    // Send email notification asynchronously
    sendInvoiceUploadNotification(studentId, historyEvent, request.user).catch(error => {
      console.error('Error sending invoice upload email:', error)
      // Don't fail the request if email sending fails
    })

    response.json(dashboard)
  } catch {
    response.status(500).json({ error: 'Failed to upload invoice' })
  }
})

dashboardsRouter.delete('/:studentId/history/:historyId/receipt', userExtractor, async (request, response) => {
  try {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Only admins can delete invoices' })
    }

    const { studentId, historyId } = request.params

    const dashboard = await Dashboard.findOne({ studentId })
    if (!dashboard) {
      return response.status(404).json({ error: 'Dashboard not found' })
    }

    const historyEvent = dashboard.history.id(historyId)
    if (!historyEvent) {
      return response.status(404).json({ error: 'History event not found' })
    }

    if (!historyEvent.downloadUrl) {
      return response.status(400).json({ error: 'No invoice file to delete' })
    }

    try {
      if (historyEvent.cloudinaryPublicId) {
        await deleteFileByPublicId(historyEvent.cloudinaryPublicId, historyEvent.fileName || 'invoice')
      } else {
        await deleteFileByUrl(historyEvent.downloadUrl, historyEvent.fileName || 'invoice')
      }
    } catch {
      // Ignore cleanup errors - receipt deletion should continue
    }

    historyEvent.downloadUrl = undefined
    historyEvent.fileName = undefined
    historyEvent.cloudinaryPublicId = undefined

    await dashboard.save()
    await dashboard.populate('studentId', 'firstName lastName')

    response.json(dashboard)
  } catch {
    response.status(500).json({ error: 'Failed to delete invoice' })
  }
})

dashboardsRouter.get('/:studentId/portfolios/:portfolioId/view', userExtractor, async (request, response) => {
  try {
    const studentId = request.params.studentId
    const portfolioId = request.params.portfolioId

    if (request.user.role !== 'admin' && request.user.student.toString() !== studentId) {
      return response.status(403).json({ error: 'Access denied' })
    }

    const dashboard = await Dashboard.findOne({ studentId })
    if (!dashboard) {
      return response.status(404).json({ error: 'Dashboard not found' })
    }

    const portfolio = dashboard.portfolios.id(portfolioId)
    if (!portfolio) {
      return response.status(404).json({ error: 'Portfolio not found' })
    }

    if (!portfolio.pdfUrl) {
      return response.status(404).json({ error: 'Portfolio file not found' })
    }

    if (portfolio.pdfUrl.startsWith('/uploads/') || !portfolio.pdfUrl.includes('cloudinary.com')) {
      return response.status(400).json({
        error: 'This portfolio uses legacy storage and needs to be re-uploaded for secure access'
      })
    }

    let publicId = portfolio.cloudinaryPublicId
    if (!publicId) {
      publicId = getPublicIdFromUrl(portfolio.pdfUrl)
      if (!publicId) {
        return response.status(400).json({ error: 'Invalid portfolio URL format' })
      }
    }

    const signedUrl = getSignedPDFViewUrl(publicId, { expiresIn: 3600 })

    if (!signedUrl) {
      return response.status(500).json({ error: 'Failed to generate secure URL' })
    }

    const https = require('https')
    const url = require('url')

    const parsedUrl = url.parse(signedUrl)

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.path,
      method: 'GET'
    }

    const req = https.request(options, (pdfResponse) => {
      if (pdfResponse.statusCode !== 200) {
        return response.status(pdfResponse.statusCode).json({ error: 'Failed to fetch PDF' })
      }

      response.setHeader('Content-Type', 'application/pdf')
      response.setHeader('Content-Disposition', 'inline; filename="portfolio.pdf"')
      response.setHeader('Cache-Control', 'private, max-age=3600')

      pdfResponse.pipe(response)
    })

    req.on('error', (_) => {
      response.status(500).json({ error: 'Failed to fetch PDF' })
    })

    req.end()

  } catch {
    response.status(500).json({ error: 'Internal server error' })
  }
})

dashboardsRouter.get('/:studentId/portfolios/:portfolioId/url', userExtractor, async (request, response) => {
  try {
    const { studentId, portfolioId } = request.params

    const student = await Student.findById(studentId)
    if (!student) {
      return response.status(404).json({ error: 'Student not found' })
    }

    const isOwner = student.userId.toString() === request.user._id.toString()
    const isAdminOrTutor = request.user.role === 'admin' || request.user.role === 'tutor'

    if (!isOwner && !isAdminOrTutor) {
      return response.status(403).json({ error: 'Access denied' })
    }

    const dashboard = await Dashboard.findOne({ studentId })
    if (!dashboard) {
      return response.status(404).json({ error: 'Dashboard not found' })
    }

    const portfolio = dashboard.portfolios.id(portfolioId)
    if (!portfolio) {
      return response.status(404).json({ error: 'Portfolio not found' })
    }

    if (!portfolio.pdfUrl) {
      return response.status(404).json({ error: 'Portfolio file not found' })
    }

    if (portfolio.pdfUrl.startsWith('/uploads/') || !portfolio.pdfUrl.includes('cloudinary.com')) {
      return response.status(400).json({
        error: 'This portfolio uses legacy storage and needs to be re-uploaded for secure access'
      })
    }

    let publicId = portfolio.cloudinaryPublicId
    if (!publicId) {
      publicId = getPublicIdFromUrl(portfolio.pdfUrl)
      if (!publicId) {
        return response.status(400).json({ error: 'Invalid portfolio URL format' })
      }
    }
    const signedUrl = getSignedUrl(publicId, {
      resource_type: 'raw',
      disposition: 'attachment',
      expiresIn: 3600
    })

    if (!signedUrl) {
      return response.status(500).json({ error: 'Failed to generate secure URL' })
    }

    response.json({ url: signedUrl })
  } catch {
    response.status(500).json({ error: 'Internal server error' })
  }
})

dashboardsRouter.get('/:studentId/documents/:documentId/url', userExtractor, async (request, response) => {
  try {
    const { studentId, documentId } = request.params

    const student = await Student.findById(studentId)
    if (!student) {
      return response.status(404).json({ error: 'Student not found' })
    }

    const isOwner = student.userId.toString() === request.user._id.toString()
    const isAdminOrTutor = request.user.role === 'admin' || request.user.role === 'tutor'

    if (!isOwner && !isAdminOrTutor) {
      return response.status(403).json({ error: 'Access denied' })
    }

    const dashboard = await Dashboard.findOne({ studentId })
    if (!dashboard) {
      return response.status(404).json({ error: 'Dashboard not found' })
    }

    const document = dashboard.documents.id(documentId)
    if (!document) {
      return response.status(404).json({ error: 'Document not found' })
    }

    if (!document.url) {
      return response.status(404).json({ error: 'Document file not found' })
    }

    if (document.url.startsWith('/uploads/') || !document.url.includes('cloudinary.com')) {
      return response.status(400).json({
        error: 'This document uses legacy storage and needs to be re-uploaded for secure access'
      })
    }

    const publicId = getPublicIdFromUrl(document.url)
    if (!publicId) {
      return response.json({ url: document.url })
    }

    let signedUrl = getDownloadUrl(publicId, document.fileName, {
      expiresIn: 3600
    })

    if (!signedUrl) {
      signedUrl = getSignedDocumentUrlWithType(publicId, document.fileName, { expiresIn: 3600 })
    }

    if (!signedUrl) {
      return response.status(500).json({ error: 'Failed to generate secure URL' })
    }

    response.json({ url: signedUrl })
  } catch {
    response.status(500).json({ error: 'Internal server error' })
  }
})

dashboardsRouter.get('/:studentId/history/:historyId/receipt/url', userExtractor, async (request, response) => {
  try {
    const { studentId, historyId } = request.params

    const student = await Student.findById(studentId)
    if (!student) {
      return response.status(404).json({ error: 'Student not found' })
    }

    const isOwner = student.userId.toString() === request.user._id.toString()
    const isAdminOrTutor = request.user.role === 'admin' || request.user.role === 'tutor'

    if (!isOwner && !isAdminOrTutor) {
      return response.status(403).json({ error: 'Access denied' })
    }

    const dashboard = await Dashboard.findOne({ studentId })
    if (!dashboard) {
      return response.status(404).json({ error: 'Dashboard not found' })
    }

    const historyEvent = dashboard.history.id(historyId)
    if (!historyEvent) {
      return response.status(404).json({ error: 'History event not found' })
    }

    if (!historyEvent.downloadUrl) {
      return response.status(404).json({ error: 'Invoice file not found' })
    }

    if (historyEvent.downloadUrl.startsWith('/uploads/') || !historyEvent.downloadUrl.includes('cloudinary.com')) {
      return response.status(400).json({
        error: 'This invoice uses legacy storage and needs to be re-uploaded for secure access'
      })
    }

    let publicId = historyEvent.cloudinaryPublicId
    if (!publicId) {
      publicId = getPublicIdFromUrl(historyEvent.downloadUrl)
      if (!publicId) {
        return response.json({ url: historyEvent.downloadUrl })
      }
    }
    const signedUrl = getSignedUrl(publicId, {
      resource_type: 'raw',
      disposition: 'attachment',
      expiresIn: 3600
    })

    if (!signedUrl) {
      return response.status(500).json({ error: 'Failed to generate secure URL' })
    }

    response.json({ url: signedUrl })
  } catch {
    response.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * Helper function to send document upload notification email
 */
async function sendDocumentUploadNotification(studentId, documentName, fileName, uploadedByUser) {
  try {
    // Get student and populate user to get parent email and email preferences
    const student = await Student.findById(studentId).populate('userId', 'email name emailNotifications')

    if (!student || !student.userId || !student.userId.email) {
      console.log('No parent email found for student document upload notification')
      return
    }

    // Check if user has email notifications enabled
    if (student.userId.emailNotifications === false) {
      console.log('User has disabled email notifications, skipping document upload email')
      return
    }

    const recipientEmail = student.userId.email
    const studentName = `${student.firstName} ${student.lastName}`
    const uploadedBy = uploadedByUser.name || uploadedByUser.username || 'Campus da Terra Admin'

    // Prepare email data
    const emailData = {
      studentId: studentId.toString(),
      studentName,
      documentName,
      fileName,
      uploadedBy
    }

    // Send email
    await sendDocumentUploadEmail(recipientEmail, emailData)
  } catch (error) {
    console.error('Error in sendDocumentUploadNotification:', error)
    throw error
  }
}

// Resend invoice/receipt email
dashboardsRouter.post('/:studentId/history/:historyId/resend-email', userExtractor, async (request, response) => {
  try {
    const { studentId, historyId } = request.params

    // Get the dashboard and find the history event
    const dashboard = await Dashboard.findOne({ studentId })
    if (!dashboard) {
      return response.status(404).json({ error: 'Dashboard not found' })
    }

    const historyEvent = dashboard.history.id(historyId)
    if (!historyEvent) {
      return response.status(404).json({ error: 'History event not found' })
    }

    // Check if this is an invoice or receipt type
    if (historyEvent.type !== 'receipt' && historyEvent.type !== 'donation_receipt') {
      return response.status(400).json({ error: 'This event is not an invoice or receipt' })
    }

    // Check if it has a file attached
    if (!historyEvent.downloadUrl || !historyEvent.fileName) {
      return response.status(400).json({ error: 'No invoice file found for this event' })
    }

    // Send email notification
    await sendInvoiceUploadNotification(studentId, historyEvent, request.user)

    response.json({ message: 'Invoice email resent successfully' })
  } catch (error) {
    console.error('Error resending invoice email:', error)
    response.status(500).json({ error: 'Failed to resend invoice email' })
  }
})

/**
 * Helper function to send invoice/receipt upload notification email
 */
async function sendInvoiceUploadNotification(studentId, historyEvent, uploadedByUser) {
  try {
    // Get student and populate user to get parent email and email preferences
    const student = await Student.findById(studentId).populate('userId', 'email name emailNotifications')

    if (!student || !student.userId || !student.userId.email) {
      console.log('No parent email found for student invoice upload notification')
      return
    }

    // Check if user has email notifications enabled
    if (student.userId.emailNotifications === false) {
      console.log('User has disabled email notifications, skipping invoice upload email')
      return
    }

    const recipientEmail = student.userId.email
    const studentName = `${student.firstName} ${student.lastName}`
    const uploadedBy = uploadedByUser.name || uploadedByUser.username || 'Campus da Terra Admin'

    // Prepare email data
    const emailData = {
      studentId: studentId.toString(),
      studentName,
      receiptType: historyEvent.type,
      amount: historyEvent.amount || '0',
      fileName: historyEvent.fileName,
      fileUrl: historyEvent.downloadUrl,
      uploadedBy
    }

    // Send email
    await sendInvoiceUploadEmail(recipientEmail, emailData)
  } catch (error) {
    console.error('Error in sendInvoiceUploadNotification:', error)
    throw error
  }
}

module.exports = dashboardsRouter