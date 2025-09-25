const mongoose = require('mongoose')

const dashboardSchema = mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
    unique: true
  },

  portfolios: [{
    pdfUrl: {
      type: String,
      required: true
    },
    fileName: {
      type: String,
      required: true
    },
    cloudinaryPublicId: {
      type: String,
      required: false
    },
    uploadDate: {
      type: Date,
      default: Date.now
    }
  }],

  documents: [{
    name: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true
    },
    fileName: String,
    cloudinaryPublicId: {
      type: String,
      required: false
    },
    uploadDate: {
      type: Date,
      default: Date.now
    }
  }],

  history: [{
    type: {
      type: String,
      enum: ['enrollment_start', 'receipt', 'enrollment_end', 'donation_receipt'],
      required: true
    },
    date: {
      type: Date,
      required: true
    },
    month: String,
    year: Number,
    donorName: String,
    donationAmount: Number,
    paymentStatus: {
      type: String,
      enum: ['paid', 'not_paid'],
      default: 'not_paid'
    },
    downloadUrl: String,
    fileName: String,
    cloudinaryPublicId: String,
    description: String
  }],

  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
})

dashboardSchema.pre('save', function(next) {
  this.updatedAt = Date.now()
  next()
})

dashboardSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    if (returnedObject._id) {
      returnedObject.id = returnedObject._id.toString()
    }
    delete returnedObject._id
    delete returnedObject.__v
  }
})

module.exports = mongoose.model('Dashboard', dashboardSchema)