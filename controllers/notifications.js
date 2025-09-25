const express = require('express')
const router = express.Router()
const Notification = require('../models/notification')
const Student = require('../models/student')
const { userExtractor } = require('../utils/middleware')
const multer = require('multer')
const { v2: cloudinary } = require('cloudinary')
const { getPublicIdFromUrl, getDownloadUrl, getSignedDocumentUrlWithType, deleteFileByUrl, deleteFileByPublicId } = require('../utils/cloudinary')
const { exportNotifications } = require('../utils/dataExport')

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/jpg',
      'image/png'
    ]

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, JPG, PNG files are allowed.'), false)
    }
  }
})

router.get('/', userExtractor, async (req, res) => {
  try {
    const user = req.user

    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    let query = {}

    if (user.role === 'admin') {
      query = {}
    } else if (user.role === 'tutor') {
      query = {
        $or: [
          { targetType: 'public' },
          { createdBy: user._id }
        ]
      }
    } else {
      try {
        const userStudents = await Student.find({ userId: user._id }).select('_id')
        const studentIds = userStudents.map(s => s._id)

        query = {
          $or: [
            { targetType: 'public' },
            { createdBy: user._id },
            {
              targetType: 'student-specific',
              targetStudents: { $in: studentIds }
            }
          ]
        }
      } catch {
        query = {
          $or: [
            { targetType: 'public' },
            { createdBy: user._id }
          ]
        }
      }
    }

    const notifications = await Notification.find(query)
      .populate('createdBy', 'username role')
      .populate('targetStudents', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(50) // Limit to 50 most recent notifications

    res.json(notifications || [])
  } catch {
    res.status(500).json({ error: 'Failed to fetch notifications' })
  }
})

router.post('/', userExtractor, upload.single('attachment'), async (req, res) => {
  try {
    const user = req.user

    if (user.role !== 'admin' && user.role !== 'tutor') {
      return res.status(403).json({ error: 'Permission denied. Only administrators and tutors can create notifications.' })
    }

    const { title, message, targetType, targetStudents } = req.body

    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' })
    }

    if (!['public', 'student-specific'].includes(targetType)) {
      return res.status(400).json({ error: 'Invalid target type' })
    }

    let validatedTargetStudents = []
    if (targetType === 'student-specific') {
      if (!targetStudents || targetStudents.length === 0) {
        return res.status(400).json({ error: 'Target students are required for student-specific notifications' })
      }

      const studentIds = Array.isArray(targetStudents) ? targetStudents : JSON.parse(targetStudents)

      const existingStudents = await Student.find({ _id: { $in: studentIds } })
      if (existingStudents.length !== studentIds.length) {
        return res.status(400).json({ error: 'One or more target students not found' })
      }

      validatedTargetStudents = studentIds
    }

    const notificationData = {
      title,
      message,
      createdBy: user._id,
      targetType,
      targetStudents: validatedTargetStudents
    }

    if (req.file) {
      try {
        const uploadPromise = new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              resource_type: 'auto',
              folder: 'cdt-notifications',
              use_filename: true,
              unique_filename: true
            },
            (error, result) => {
              if (error) reject(error)
              else resolve(result)
            }
          )
          uploadStream.end(req.file.buffer)
        })

        const uploadResult = await uploadPromise

        notificationData.attachmentUrl = uploadResult.secure_url
        notificationData.attachmentFileName = req.file.originalname
        notificationData.attachmentFileType = req.file.mimetype
        notificationData.attachmentCloudinaryPublicId = uploadResult.public_id
      } catch {
        return res.status(500).json({ error: 'Failed to upload attachment' })
      }
    }

    const notification = new Notification(notificationData)
    await notification.save()

    await notification.populate('createdBy', 'username role')
    await notification.populate('targetStudents', 'firstName lastName')

    res.status(201).json(notification)
  } catch {
    res.status(500).json({ error: 'Failed to create notification' })
  }
})

router.delete('/:id', userExtractor, async (req, res) => {
  try {
    const user = req.user
    const notificationId = req.params.id

    const notification = await Notification.findById(notificationId)
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' })
    }

    if (notification.createdBy.toString() !== user._id.toString() && user.role !== 'admin') {
      return res.status(403).json({ error: 'Permission denied. You can only delete your own notifications.' })
    }

    if (notification.attachmentUrl) {
      try {
        if (notification.attachmentCloudinaryPublicId) {
          await deleteFileByPublicId(notification.attachmentCloudinaryPublicId, notification.attachmentFileName)
        } else {
          await deleteFileByUrl(notification.attachmentUrl, notification.attachmentFileName)
        }
      } catch {
        // Ignore file deletion errors
      }
    }

    await Notification.findByIdAndDelete(notificationId)
    res.json({ message: 'Notification deleted successfully' })
  } catch {
    res.status(500).json({ error: 'Failed to delete notification' })
  }
})

router.get('/:id/attachment/url', userExtractor, async (req, res) => {
  try {
    const user = req.user
    const notificationId = req.params.id

    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const notification = await Notification.findById(notificationId)
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' })
    }

    let hasAccess = false
    if (user.role === 'admin') {
      hasAccess = true
    } else if (user.role === 'tutor') {
      hasAccess = notification.targetType === 'public' || notification.createdBy.toString() === user._id.toString()
    } else {
      if (notification.targetType === 'public' || notification.createdBy.toString() === user._id.toString()) {
        hasAccess = true
      } else if (notification.targetType === 'student-specific') {
        try {
          const userStudents = await Student.find({ userId: user._id }).select('_id')
          const studentIds = userStudents.map(s => s._id.toString())
          hasAccess = notification.targetStudents.some(studentId => studentIds.includes(studentId.toString()))
        } catch {
          hasAccess = false
        }
      }
    }

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' })
    }

    if (!notification.attachmentUrl) {
      return res.status(404).json({ error: 'No attachment found' })
    }


    const publicId = getPublicIdFromUrl(notification.attachmentUrl)
    if (!publicId) {
      return res.json({ url: notification.attachmentUrl })
    }


    let signedUrl = getDownloadUrl(publicId, notification.attachmentFileName, {
      expiresIn: 3600
    })

    if (!signedUrl) {
      signedUrl = getSignedDocumentUrlWithType(publicId, notification.attachmentFileName, { expiresIn: 3600 })
    }

    if (!signedUrl) {
      return res.status(500).json({ error: 'Failed to generate secure URL' })
    }


    res.json({ url: signedUrl })
  } catch {
    res.status(500).json({ error: 'Failed to get attachment URL' })
  }
})

router.get('/export', userExtractor, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Permission denied - admin access required' })
    }

    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      targetType: req.query.targetType
    }

    const exportData = await exportNotifications(filters)

    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `notifications-export-${timestamp}.json`

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

    res.json(exportData)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/import', userExtractor, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Permission denied - admin access required' })
    }

    const { notifications, duplicateHandling = 'skip' } = req.body
    const notificationsToImport = Array.isArray(notifications) ? notifications : [notifications]
    const results = {
      success: [],
      errors: [],
      duplicates: [],
      skipped: []
    }

    for (const notificationData of notificationsToImport) {
      try {
        const cleanData = { ...notificationData }
        if (cleanData.id) {
          delete cleanData.id
        }
        if (cleanData._id) {
          delete cleanData._id
        }

        if (cleanData.attachmentMetadata) {
          delete cleanData.attachmentMetadata
        }
        if (cleanData._fileNote) {
          delete cleanData._fileNote
        }
        if (!cleanData.title || !cleanData.message) {
          results.errors.push({
            title: cleanData.title || 'Unknown',
            error: 'Title and message are required'
          })
          continue
        }

        const existingNotification = await Notification.findOne({
          title: cleanData.title,
          message: cleanData.message
        })

        if (existingNotification) {
          if (duplicateHandling === 'skip') {
            results.duplicates.push({
              title: cleanData.title,
              message: 'Skipped - duplicate found'
            })
            continue
          }
          results.duplicates.push({
            title: cleanData.title,
            message: 'Duplicate found but no merge strategy for notifications'
          })
          continue
        }

        const notification = new Notification(cleanData)
        const savedNotification = await notification.save()

        results.success.push({
          title: savedNotification.title,
          id: savedNotification._id
        })
      } catch (error) {
        results.errors.push({
          title: notificationData.title || 'Unknown',
          error: error.message
        })
      }
    }

    let message = `Notifications import completed: ${results.success.length} created`
    if (results.duplicates.length > 0) {
      message += `, ${results.duplicates.length} skipped`
    }

    res.status(200).json({
      message,
      results,
      summary: {
        total: notificationsToImport.length,
        created: results.success.length,
        skipped: results.duplicates.length,
        errors: results.errors.length
      }
    })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = router