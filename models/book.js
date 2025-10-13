const mongoose = require('mongoose')

const bookSchema = mongoose.Schema({
  title: String,
  author: String,
  url: String,
  language: {
    type: String,
    default: ''
  },
  difficulty: {
    type: String,
    enum: ['Learning to Read', 'Beginner', 'Intermediate', 'Advanced', 'Expert']
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lending: {
    isLent: {
      type: Boolean,
      default: false
    },
    borrower: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    lentDate: {
      type: Date,
      default: null
    },
    dueDate: {
      type: Date,
      default: null
    },
    returnRequested: {
      type: Boolean,
      default: false
    },
    returnRequestDate: {
      type: Date,
      default: null
    }
  },
  lendingHistory: [{
    borrower: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    lentDate: {
      type: Date,
      required: true
    },
    dueDate: {
      type: Date,
      required: true
    },
    returnedDate: {
      type: Date,
      default: null
    },
    isReturned: {
      type: Boolean,
      default: false
    }
  }]
})

bookSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    if (returnedObject._id) {
      returnedObject.id = returnedObject._id.toString()
    }
    delete returnedObject._id
    delete returnedObject.__v
  },
})

module.exports = mongoose.model('Book', bookSchema)
