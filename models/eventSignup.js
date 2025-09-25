const mongoose = require('mongoose')

const signupSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  responsibility: {
    type: String,
    maxLength: 200
  },
  notes: {
    type: String,
    maxLength: 500
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
})

const eventSignupSchema = new mongoose.Schema({
  eventTitle: {
    type: String,
    required: true,
    maxLength: 200
  },
  eventDate: {
    type: Date,
    required: true
  },
  eventDescription: {
    type: String,
    maxLength: 500
  },
  googleCalendarLink: {
    type: String,
    maxLength: 500
  },
  signups: [signupSchema],
  maxSignups: {
    type: Number,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
})

eventSignupSchema.pre('save', function(next) {
  this.updatedAt = Date.now()
  this.signups.forEach(signup => {
    if (signup.isModified()) {
      signup.updatedAt = Date.now()
    }
  })
  next()
})

eventSignupSchema.index({ eventDate: 1, isActive: 1 })
eventSignupSchema.index({ 'signups.userId': 1 })

module.exports = mongoose.model('EventSignup', eventSignupSchema)