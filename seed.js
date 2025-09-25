const mongoose = require('mongoose')
const bcrypt = require('bcrypt')
const config = require('./utils/config')
const User = require('./models/user')
const Student = require('./models/student')
const Book = require('./models/book')
const Dashboard = require('./models/dashboard')

const connectDB = async () => {
  try {
    await mongoose.connect(config.MONGODB_URI)
    console.log('Connected to MongoDB')
  } catch (error) {
    console.error('Error connecting to MongoDB:', error.message)
    process.exit(1)
  }
}

const clearDatabase = async () => {
  try {
    await User.deleteMany({})
    await Student.deleteMany({})
    await Book.deleteMany({})
    await Dashboard.deleteMany({})
    console.log('Database cleared')
  } catch (error) {
    console.error('Error clearing database:', error)
  }
}

const createSampleUsers = async () => {
  const saltRounds = 10

  const users = [
    {
      username: 'admin',
      name: 'Admin User',
      email: 'admin@campusdaterra.com',
      passwordHash: await bcrypt.hash('admin123', saltRounds),
      role: 'admin'
    },
    {
      username: 'tutor1',
      name: 'Sarah Johnson',
      email: 'sarah@campusdaterra.com',
      passwordHash: await bcrypt.hash('tutor123', saltRounds),
      role: 'tutor'
    },
    {
      username: 'parent1',
      name: 'Maria Silva',
      email: 'maria.silva@example.com',
      passwordHash: await bcrypt.hash('parent123', saltRounds),
      role: 'user',
      parentStreetAddress: 'Rua das Flores, 123',
      parentCity: 'Funchal',
      parentPostalCode: '9000-123',
      parentCountry: 'Portugal',
      parentNationality: 'Portuguese',
      contactNumber: '+351 291 123 456'
    },
    {
      username: 'parent2',
      name: 'John Smith',
      email: 'john.smith@example.com',
      passwordHash: await bcrypt.hash('parent123', saltRounds),
      role: 'user',
      parentStreetAddress: '456 Oak Street',
      parentCity: 'London',
      parentPostalCode: 'SW1A 1AA',
      parentCountry: 'United Kingdom',
      parentNationality: 'British',
      contactNumber: '+44 20 7946 0958'
    },
    {
      username: 'parent3',
      name: 'Emma Thompson',
      email: 'emma.thompson@example.com',
      passwordHash: await bcrypt.hash('parent123', saltRounds),
      role: 'user',
      parentStreetAddress: '789 Maple Avenue',
      parentCity: 'Berlin',
      parentPostalCode: '10115',
      parentCountry: 'Germany',
      parentNationality: 'German',
      contactNumber: '+49 30 12345678'
    }
  ]

  const createdUsers = await User.insertMany(users)
  console.log(`Created ${createdUsers.length} users`)
  return createdUsers
}

const createSampleStudents = async (users) => {
  const parentUsers = users.filter(user => user.role === 'user')

  const students = [
    {
      userId: parentUsers[0]._id,
      firstName: 'Ana',
      lastName: 'Silva',
      gender: 'Female',
      dateOfBirth: new Date('2010-05-15'),
      streetAddress: 'Rua das Flores, 123',
      city: 'Funchal',
      postalCode: '9000-123',
      country: 'Portugal',
      nationality: 'Portuguese',
      passportNumber: 'PT123456789',
      passportExpiryDate: new Date('2030-12-31'),
      nifNumber: '123456789',
      enrollmentLength: '1 year (Residents)',
      weekdayAttendance: '5 days/week',
      enrollmentStartDate: new Date('2024-09-01'),
      siblings: false,
      firstLanguage: 'Portuguese',
      englishProficiency: 'Intermediate',
      englishReadingWriting: 'Intermediate',
      portugueseLevel: 'Fluent',
      skillsHobbies: 'Drawing, swimming, reading',
      approach: 'Core Education',
      curriculum: 'Mix and Match',
      pricing: 'Residents',
      paymentMethod: 'Bank Transfer',
      photoConsent: true,
      contactListConsent: true,
      termsAndConditions: true,
      personalDataConsent: true,
      signedTuitionAgreement: true,
      motivationForJoining: ['Alternative / more holistic education', 'To be part of a community']
    },
    {
      userId: parentUsers[1]._id,
      firstName: 'Oliver',
      lastName: 'Smith',
      gender: 'Male',
      dateOfBirth: new Date('2012-08-22'),
      streetAddress: '456 Oak Street',
      city: 'London',
      postalCode: 'SW1A 1AA',
      country: 'United Kingdom',
      nationality: 'British',
      passportNumber: 'GB987654321',
      passportExpiryDate: new Date('2029-06-15'),
      enrollmentLength: '6 months (Residents)',
      weekdayAttendance: '4 days/week',
      enrollmentStartDate: new Date('2024-09-01'),
      siblings: true,
      firstLanguage: 'English',
      englishProficiency: 'Fluent',
      englishReadingWriting: 'Advanced',
      portugueseLevel: 'Beginner',
      skillsHobbies: 'Football, coding, music',
      approach: 'Other',
      curriculum: 'Online School',
      pricing: 'Residents',
      paymentMethod: 'Stripe',
      photoConsent: true,
      contactListConsent: false,
      termsAndConditions: true,
      personalDataConsent: true,
      signedTuitionAgreement: true,
      motivationForJoining: ['Democratic / self-directed learning approach', 'A sense of adventure / Madeira']
    },
    {
      userId: parentUsers[1]._id,
      firstName: 'Sophie',
      lastName: 'Smith',
      gender: 'Female',
      dateOfBirth: new Date('2014-03-10'),
      streetAddress: '456 Oak Street',
      city: 'London',
      postalCode: 'SW1A 1AA',
      country: 'United Kingdom',
      nationality: 'British',
      passportNumber: 'GB111222333',
      passportExpiryDate: new Date('2029-06-15'),
      enrollmentLength: '6 months (Residents)',
      weekdayAttendance: '4 days/week',
      enrollmentStartDate: new Date('2024-09-01'),
      siblings: true,
      firstLanguage: 'English',
      englishProficiency: 'Fluent',
      englishReadingWriting: 'Intermediate',
      portugueseLevel: 'No prior knowledge',
      skillsHobbies: 'Art, dance, nature exploration',
      approach: 'Unschooling',
      curriculum: 'Mix and Match',
      pricing: 'Residents',
      discount: 'Sibling Discount',
      paymentMethod: 'Stripe',
      photoConsent: true,
      contactListConsent: false,
      termsAndConditions: true,
      personalDataConsent: true,
      signedTuitionAgreement: true,
      motivationForJoining: ['The campus and natural environment', 'To be part of a community']
    },
    {
      userId: parentUsers[2]._id,
      firstName: 'Max',
      lastName: 'Thompson',
      gender: 'Male',
      dateOfBirth: new Date('2009-11-03'),
      streetAddress: '789 Maple Avenue',
      city: 'Berlin',
      postalCode: '10115',
      country: 'Germany',
      nationality: 'German',
      passportNumber: 'DE444555666',
      passportExpiryDate: new Date('2031-01-20'),
      enrollmentLength: '3 months (Traveling Family)',
      weekdayAttendance: '5 days/week',
      enrollmentStartDate: new Date('2024-10-01'),
      siblings: false,
      firstLanguage: 'German',
      englishProficiency: 'Proficient',
      englishReadingWriting: 'Advanced',
      portugueseLevel: 'No prior knowledge',
      skillsHobbies: 'Science experiments, hiking, photography',
      approach: 'Qualifications for higher education',
      curriculum: 'Workbook Curriculum',
      curriculumSupplier: 'German Correspondence School',
      pricing: 'Traveling Families',
      paymentMethod: 'SEPA direct debit',
      photoConsent: true,
      contactListConsent: true,
      termsAndConditions: true,
      personalDataConsent: true,
      signedTuitionAgreement: true,
      motivationForJoining: ['Traveling family looking for short-term enrollments', 'The values and culture of the school']
    }
  ]

  const createdStudents = await Student.insertMany(students)
  console.log(`Created ${createdStudents.length} students`)

  for (let i = 0; i < createdStudents.length; i++) {
    const student = createdStudents[i]
    await User.findByIdAndUpdate(
      student.userId,
      { $push: { students: student._id } }
    )
  }

  return createdStudents
}

const createSampleBooks = async (users) => {
  const adminUser = users.find(user => user.role === 'admin')

  const books = [
    {
      title: 'Green Eggs and Ham',
      author: 'Dr. Seuss',
      url: 'https://example.com/green-eggs-ham',
      language: 'English',
      difficulty: 'Learning to Read',
      user: adminUser._id
    },
    {
      title: 'The Cat in the Hat',
      author: 'Dr. Seuss',
      url: 'https://example.com/cat-hat',
      language: 'English',
      difficulty: 'Learning to Read',
      user: adminUser._id
    },
    {
      title: 'Go, Dog. Go!',
      author: 'P.D. Eastman',
      url: 'https://example.com/go-dog-go',
      language: 'English',
      difficulty: 'Learning to Read',
      user: adminUser._id
    },
    {
      title: 'The Wild Robot',
      author: 'Peter Brown',
      url: 'https://example.com/wild-robot',
      language: 'English',
      difficulty: 'Intermediate',
      user: adminUser._id
    },
    {
      title: 'Wonder',
      author: 'R.J. Palacio',
      url: 'https://example.com/wonder',
      language: 'English',
      difficulty: 'Intermediate',
      user: adminUser._id
    },
    {
      title: 'The Giver',
      author: 'Lois Lowry',
      url: 'https://example.com/giver',
      language: 'English',
      difficulty: 'Advanced',
      user: adminUser._id
    },
    {
      title: 'Charlotte\'s Web',
      author: 'E.B. White',
      url: 'https://example.com/charlottes-web',
      language: 'English',
      difficulty: 'Beginner',
      user: adminUser._id
    },
    {
      title: 'O Principezinho',
      author: 'Antoine de Saint-Exupéry',
      url: 'https://example.com/principezinho',
      language: 'Portuguese',
      difficulty: 'Intermediate',
      user: adminUser._id
    },
    {
      title: 'Holes',
      author: 'Louis Sachar',
      url: 'https://example.com/holes',
      language: 'English',
      difficulty: 'Intermediate',
      user: adminUser._id
    },
    {
      title: 'Bridge to Terabithia',
      author: 'Katherine Paterson',
      url: 'https://example.com/bridge-terabithia',
      language: 'English',
      difficulty: 'Intermediate',
      user: adminUser._id
    },
    {
      title: 'The Secret Garden',
      author: 'Frances Hodgson Burnett',
      url: 'https://example.com/secret-garden',
      language: 'English',
      difficulty: 'Advanced',
      user: adminUser._id
    },
    {
      title: 'Matilda',
      author: 'Roald Dahl',
      url: 'https://example.com/matilda',
      language: 'English',
      difficulty: 'Intermediate',
      user: adminUser._id
    },
    {
      title: 'Harry Potter e a Pedra Filosofal',
      author: 'J.K. Rowling',
      url: 'https://example.com/harry-potter-pt',
      language: 'Portuguese',
      difficulty: 'Advanced',
      user: adminUser._id
    }
  ]

  const createdBooks = await Book.insertMany(books)
  console.log(`Created ${createdBooks.length} books`)
  return createdBooks
}

const createSampleDashboards = async (students) => {
  const dashboards = []

  for (const student of students) {
    const dashboard = {
      studentId: student._id,
      portfolios: [],
      documents: [],
      history: []
    }

    if (student.firstName === 'Ana') {
      dashboard.history.push(
        {
          type: 'enrollment_start',
          date: new Date('2024-09-01'),
          description: 'Started enrollment at Campus da Terra'
        },
        {
          type: 'receipt',
          date: new Date('2024-09-05'),
          month: 'September',
          year: 2024,
          paymentStatus: 'paid',
          description: 'Monthly tuition payment'
        },
        {
          type: 'donation_receipt',
          date: new Date('2024-09-15'),
          donorName: 'Maria Silva',
          donationAmount: 150.00,
          description: 'Donation for school equipment'
        }
      )
    } else if (student.firstName === 'Oliver') {
      dashboard.history.push(
        {
          type: 'enrollment_start',
          date: new Date('2024-09-01'),
          description: 'Started enrollment at Campus da Terra'
        },
        {
          type: 'receipt',
          date: new Date('2024-09-05'),
          month: 'September',
          year: 2024,
          paymentStatus: 'paid',
          description: 'Monthly tuition payment'
        },
        {
          type: 'donation_receipt',
          date: new Date('2024-09-20'),
          donorName: 'John Smith',
          donationAmount: 200.00,
          description: 'Donation for library expansion'
        }
      )
    } else if (student.firstName === 'Sophie') {
      dashboard.history.push(
        {
          type: 'enrollment_start',
          date: new Date('2024-09-01'),
          description: 'Started enrollment at Campus da Terra'
        },
        {
          type: 'receipt',
          date: new Date('2024-09-05'),
          month: 'September',
          year: 2024,
          paymentStatus: 'not_paid',
          description: 'Monthly tuition payment - sibling discount applied'
        }
      )
    } else if (student.firstName === 'Max') {
      dashboard.history.push(
        {
          type: 'enrollment_start',
          date: new Date('2024-10-01'),
          description: 'Started short-term enrollment'
        },
        {
          type: 'donation_receipt',
          date: new Date('2024-10-05'),
          donorName: 'Emma Thompson',
          donationAmount: 100.00,
          description: 'Donation in appreciation for welcoming traveling families'
        }
      )
    }

    dashboards.push(dashboard)
  }

  const createdDashboards = await Dashboard.insertMany(dashboards)
  console.log(`Created ${createdDashboards.length} dashboards`)
  return createdDashboards
}

const seedDatabase = async () => {
  try {
    await connectDB()
    await clearDatabase()

    console.log('Starting database population...')

    const users = await createSampleUsers()
    const students = await createSampleStudents(users)
    await createSampleBooks(users)
    await createSampleDashboards(students)

    console.log('Database population completed successfully!')
    console.log('\nSample login credentials:')
    console.log('Admin: username="admin", password="admin123"')
    console.log('Tutor: username="tutor1", password="tutor123"')
    console.log('Parent: username="parent1", password="parent123"')
    console.log('Parent: username="parent2", password="parent123"')
    console.log('Parent: username="parent3", password="parent123"')

  } catch (error) {
    console.error('Error seeding database:', error)
  } finally {
    await mongoose.connection.close()
    console.log('Database connection closed')
  }
}

if (require.main === module) {
  seedDatabase()
}

module.exports = { seedDatabase }