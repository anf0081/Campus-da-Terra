const mongoose = require('mongoose')

const gaDocumentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    maxLength: 200
  },
  description: {
    type: String,
    maxLength: 1000
  },
  documents: [{
    name: {
      type: String,
      required: true
    },
    fileName: {
      type: String,
      required: false
    },
    fileUrl: {
      type: String,
      required: false
    },
    fileType: {
      type: String
    },
    documentUrl: {
      type: String,
      required: false
    },
    contentType: {
      type: String,
      enum: ['file', 'text', 'upload_area'],
      default: 'file'
    },
    textContent: {
      type: String,
      maxLength: 5000
    },
    allowUserUploads: {
      type: Boolean,
      default: false
    },
    userUploads: [{
      fileName: String,
      fileUrl: String,
      fileType: String,
      cloudinaryPublicId: String,
      uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      uploadDate: {
        type: Date,
        default: Date.now
      },
      userDescription: {
        type: String,
        maxLength: 500
      }
    }],
    uploadDate: {
      type: Date,
      default: Date.now
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    cloudinaryPublicId: {
      type: String,
      required: false
    }
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  order: {
    type: Number,
    default: 0
  }
})

gaDocumentSchema.index({ order: 1 })
gaDocumentSchema.index({ createdAt: -1 })
gaDocumentSchema.index({ createdBy: 1 })

module.exports = mongoose.model('GADocument', gaDocumentSchema)