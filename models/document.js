const mongoose = require('mongoose')

const documentSchema = new mongoose.Schema({
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

documentSchema.index({ order: 1 })
documentSchema.index({ createdAt: -1 })
documentSchema.index({ createdBy: 1 })

module.exports = mongoose.model('Document', documentSchema)