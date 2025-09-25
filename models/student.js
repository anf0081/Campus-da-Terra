const mongoose = require('mongoose')

const studentSchema = mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  firstName: {
    type: String,
    required: true,
    trim: true
  },
  middleName: {
    type: String,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
    default: 'Other'
  },
  dateOfBirth: {
    type: Date,
    required: true
  },
  profilePicture: {
    type: String,
    trim: true
  },
  profilePicturePublicId: {
    type: String,
    required: false
  },

  streetAddress: {
    type: String,
    required: true
  },
  city: {
    type: String,
    required: true
  },
  postalCode: {
    type: String,
    required: true
  },
  country: {
    type: String,
    required: true
  },
  nationality: {
    type: String,
    required: true
  },
  passportNumber: {
    type: String,
    required: true
  },
  passportExpiryDate: {
    type: Date,
    required: true
  },
  nifNumber: String,

  enrollmentLength: {
    type: String,
    enum: ['6 months (Residents)', '1 year (Residents)', 'Multiple years (Residents)', '1 month (Traveling family)', '2 months (Traveling Family)', '3 months (Traveling Family)'],
    default: '1 year (Residents)'
  },
  weekdayAttendance: {
    type: String,
    enum: ['1 day/week', '2 days/week', '3 days/week', '4 days/week', '5 days/week'],
    default: '5 days/week'
  },
  enrollmentStartDate: Date,
  siblings: Boolean,
  firstLanguage: String,
  englishProficiency: {
    type: String,
    enum: ['No prior knowledge', 'Beginner', 'Intermediate', 'Proficient', 'Fluent'],
    default: 'No prior knowledge'
  },
  englishReadingWriting: {
    type: String,
    enum: ['No prior knowledge', 'Beginner', 'Intermediate', 'Advanced'],
    default: 'No prior knowledge'
  },
  portugueseLevel: {
    type: String,
    enum: ['No prior knowledge', 'Beginner', 'Intermediate', 'Proficient', 'Fluent'],
    default: 'No prior knowledge'
  },
  skillsHobbies: String,
  strugglingSubjects: String,

  approach: {
    type: String,
    enum: ['Unschooling', 'Core Education', 'Qualifications for higher education', 'Other'],
    default: 'Other'
  },
  curriculum: {
    type: String,
    enum: ['Online School', 'Workbook Curriculum', 'Mix and Match', 'Other'],
    default: 'Other'
  },
  curriculumSupplier: String,
  curriculumNotes: String,

  behavioralChallenges: {
    type: Boolean,
    default: false
  },
  learningDifferences: {
    type: Boolean,
    default: false
  },
  physicalLimitations: {
    type: Boolean,
    default: false
  },
  healthConditions: {
    type: Boolean,
    default: false
  },
  dailyMedication: {
    type: Boolean,
    default: false
  },
  medicalTreatments: {
    type: Boolean,
    default: false
  },
  allergies: {
    type: Boolean,
    default: false
  },

  specialNeedsDetails: String,

  lifeThreatening: {
    type: Boolean,
    default: false
  },
  medicalDetails: String,

  pricing: {
    type: String,
    enum: ['Residents', 'Financial Hardship', 'Traveling Families', 'Founding Member'],
    default: 'Residents'
  },
  discount: {
    type: String,
    enum: ['Sibling Discount', 'Early Payment Discount', 'Referral Discount', 'Other', 'None'],
    default: 'None'
  },
  paymentMethod: {
    type: String,
    enum: ['Bank Transfer', 'Cash', 'SEPA direct debit', 'MBWay', 'Stripe', 'Bitcoin', 'Other'],
    default: 'Bank Transfer'
  },
  billingAddressSameAsHome: {
    type: Boolean,
    default: true
  },
  billingStreetAddress: String,
  billingCity: String,
  billingPostalCode: String,
  billingCountry: String,
  additionalNotes: String,
  signedTuitionAgreement: {
    type: Boolean,
    default: false
  },

  referralSource: String,
  motivationForJoining: {
    type: [String],
    enum: [
      'Alternative / more holistic education',
      'Democratic / self-directed learning approach',
      'To be part of a community',
      'Quality of teachers',
      'The values and culture of the school',
      'The campus and natural environment',
      'A sense of adventure / Madeira',
      'Traveling family looking for short-term enrollments',
      'Other'
    ]
  },
  photoConsent: {
    type: Boolean,
    default: false
  },
  contactListConsent: {
    type: Boolean,
    default: false
  },
  termsAndConditions: {
    type: Boolean,
    default: false
  },
  personalDataConsent: {
    type: Boolean,
    default: false
  },

  wishlist: [{
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: true
    },
    addedDate: {
      type: Date,
      default: Date.now
    }
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

studentSchema.pre('save', function(next) {
  this.updatedAt = Date.now()
  next()
})

studentSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    if (returnedObject._id) {
      returnedObject.id = returnedObject._id.toString()
    }
    delete returnedObject._id
    delete returnedObject.__v
  }
})

module.exports = mongoose.model('Student', studentSchema)