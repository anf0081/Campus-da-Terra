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
const loginRouter = require('./controllers/login')
const middleware = require('./utils/middleware')
const cors = require('cors')

const app = express()
app.use(express.json())
app.use(cors())

mongoose
  .connect(config.MONGODB_URI)
  .then(() => {
    logger.info('connected to MongoDB')
  })
  .catch((error) => {
    logger.error('error connecting to MongoDB:', error.message)
  })

app.use(middleware.requestLogger)
app.use(middleware.tokenExtractor)

app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

app.use(express.static(path.join(__dirname, 'public')))

app.use('/api/books', booksRouter)
app.use('/api/users', usersRouter)
app.use('/api/students', studentsRouter)
app.use('/api/dashboards', dashboardsRouter)
app.use('/api/documents', documentsRouter)
app.use('/api/ga-documents', gaDocumentsRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/event-signups', eventSignupsRouter)
app.use('/api/login', loginRouter)

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

app.use(middleware.unknownEndpoint)
app.use(middleware.errorHandler)

module.exports = app