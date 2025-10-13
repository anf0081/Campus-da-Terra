const mongoose = require('mongoose')

const notificationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    maxLength: 200
  },
  message: {
    type: String,
    required: true,
    maxLength: 2000
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  targetType: {
    type: String,
    enum: ['public', 'student-specific'],
    required: true,
    default: 'public'
  },
  targetStudents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student'
  }],
  attachmentUrl: {
    type: String
  },
  attachmentFileName: {
    type: String
  },
  attachmentFileType: {
    type: String
  },
  attachmentCloudinaryPublicId: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
})

notificationSchema.index({ createdAt: -1 })
notificationSchema.index({ targetType: 1 })
notificationSchema.index({ targetStudents: 1 })
notificationSchema.index({ createdBy: 1 })

module.exports = mongoose.model('Notification', notificationSchema)