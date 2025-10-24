const express = require('express')
const mongoose = require('mongoose')
const path = require('path')
const config = require('./utils/config')
const logger = require('./utils/logger')
const booksRouter = require('./controllers/books')
const usersRouter = require('./controllers/users')
const studentsRouter = require('./controllers/students')
const dashboardsRouter = require('./controllers/dashboards')
const documentsRouter = require('./controllers/documents')
const gaDocumentsRouter = require('./controllers/gaDocuments')
const notificationsRouter = require('./controllers/notifications')
const eventSignupsRouter = require('./controllers/eventSignups')
const calendarSettingsRouter = require('./controllers/calendarSettings')
const loginRouter = require('./controllers/login')
const middleware = require('./utils/middleware')
const cors = require('cors')
const helmet = require('helmet')

const app = express()

// Security headers with Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ['\'self\''],
      scriptSrc: ['\'self\'', '\'unsafe-inline\''],
      styleSrc: ['\'self\'', '\'unsafe-inline\'', 'https://fonts.googleapis.com'],
      imgSrc: ['\'self\'', 'data:', 'https:', 'http:', 'res.cloudinary.com'],
      connectSrc: ['\'self\'', 'https://res.cloudinary.com', 'https://api.cloudinary.com'],
      fontSrc: ['\'self\'', 'data:', 'https://fonts.gstatic.com'],
      objectSrc: ['\'none\''],
      mediaSrc: ['\'self\''],
      frameSrc: ['\'self\'', 'https://calendar.google.com'],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}))

app.use(express.json())

mongoose
  .connect(config.MONGODB_URI)
  .then(() => {
    logger.info('connected to MongoDB')
  })
  .catch((error) => {
    logger.error('error connecting to MongoDB:', error.message)
  })

// Serve static files BEFORE CORS and other middleware
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))
app.use(express.static(path.join(__dirname, 'public')))

// CORS configuration - restrict to specific origins
const allowedOrigins = [
  'https://cdt-management-app.onrender.com',
  'https://members.campusdaterra.org',
  'http://localhost:5173',
  'http://localhost:3001'
]

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true)
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.'
      return callback(new Error(msg), false)
    }
    return callback(null, true)
  },
  credentials: true
}))

app.use(middleware.requestLogger)
app.use(middleware.tokenExtractor)

app.use('/api/books', booksRouter)
app.use('/api/users', usersRouter)
app.use('/api/students', studentsRouter)
app.use('/api/dashboards', dashboardsRouter)
app.use('/api/documents', documentsRouter)
app.use('/api/ga-documents', gaDocumentsRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/event-signups', eventSignupsRouter)
app.use('/api/calendar-settings', calendarSettingsRouter)
app.use('/api/login', loginRouter)

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

// Catch-all route for SPA - but exclude /api and /assets routes
app.get(/^(?!\/api|\/assets).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

app.use(middleware.unknownEndpoint)
app.use(middleware.errorHandler)

module.exports = app