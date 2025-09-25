const eventSignupsRouter = require('express').Router()
const EventSignup = require('../models/eventSignup')
const { userExtractor } = require('../utils/middleware')
const ical = require('node-ical')
const multer = require('multer')

const storage = multer.memoryStorage()
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/calendar' || file.originalname.endsWith('.ics')) {
      cb(null, true)
    } else {
      cb(new Error('Only ICS files are allowed'), false)
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }
})

eventSignupsRouter.get('/', userExtractor, async (request, response) => {
  try {
    const eventSignups = await EventSignup.find({ isActive: true })
      .populate('signups.userId', 'username name')
      .sort({ eventDate: 1 })

    response.json(eventSignups)
  } catch {
    response.status(500).json({ error: 'Failed to fetch event signups' })
  }
})

eventSignupsRouter.get('/:id', userExtractor, async (request, response) => {
  try {
    const eventSignup = await EventSignup.findById(request.params.id)
      .populate('signups.userId', 'username name')

    if (!eventSignup) {
      return response.status(404).json({ error: 'Event signup not found' })
    }

    response.json(eventSignup)
  } catch {
    response.status(500).json({ error: 'Failed to fetch event signup' })
  }
})

eventSignupsRouter.post('/', userExtractor, async (request, response) => {
  try {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Access denied. Admin privileges required.' })
    }

    const { eventTitle, eventDate, eventDescription, googleCalendarLink, maxSignups, isActive } = request.body

    if (!eventTitle || !eventDate) {
      return response.status(400).json({ error: 'Event title and date are required' })
    }

    const existingEvent = await EventSignup.findOne({
      eventTitle,
      eventDate: new Date(eventDate)
    })
    if (existingEvent) {
      return response.status(400).json({ error: 'Event signup already exists for this event' })
    }

    const eventSignup = new EventSignup({
      eventTitle,
      eventDate: new Date(eventDate),
      eventDescription,
      googleCalendarLink,
      maxSignups,
      isActive: isActive !== undefined ? isActive : true,
      signups: []
    })

    const savedEventSignup = await eventSignup.save()

    response.status(201).json(savedEventSignup)
  } catch {
    response.status(500).json({ error: 'Failed to create event signup' })
  }
})

eventSignupsRouter.put('/:id', userExtractor, async (request, response) => {
  try {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Access denied. Admin privileges required.' })
    }

    const { eventTitle, eventDate, eventDescription, googleCalendarLink, maxSignups, isActive } = request.body

    const eventSignup = await EventSignup.findById(request.params.id)
    if (!eventSignup) {
      return response.status(404).json({ error: 'Event signup not found' })
    }

    if (eventTitle) eventSignup.eventTitle = eventTitle
    if (eventDate) eventSignup.eventDate = new Date(eventDate)
    if (eventDescription !== undefined) eventSignup.eventDescription = eventDescription
    if (googleCalendarLink !== undefined) eventSignup.googleCalendarLink = googleCalendarLink
    if (maxSignups !== undefined) eventSignup.maxSignups = maxSignups
    if (isActive !== undefined) eventSignup.isActive = isActive

    const updatedEventSignup = await eventSignup.save()
    await updatedEventSignup.populate('signups.userId', 'username name')

    response.json(updatedEventSignup)
  } catch {
    response.status(500).json({ error: 'Failed to update event signup' })
  }
})

eventSignupsRouter.delete('/:id', userExtractor, async (request, response) => {
  try {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Access denied. Admin privileges required.' })
    }

    const eventSignup = await EventSignup.findById(request.params.id)
    if (!eventSignup) {
      return response.status(404).json({ error: 'Event signup not found' })
    }

    await EventSignup.findByIdAndDelete(request.params.id)
    response.status(204).end()
  } catch {
    response.status(500).json({ error: 'Failed to delete event signup' })
  }
})

eventSignupsRouter.post('/:id/signups', userExtractor, async (request, response) => {
  try {
    const { responsibility, notes } = request.body

    const eventSignup = await EventSignup.findById(request.params.id)
    if (!eventSignup) {
      return response.status(404).json({ error: 'Event signup not found' })
    }

    if (!eventSignup.isActive) {
      return response.status(400).json({ error: 'This event signup is no longer active' })
    }

    const existingSignup = eventSignup.signups.find(
      signup => signup.userId.toString() === request.user.id
    )
    if (existingSignup) {
      return response.status(400).json({ error: 'You have already signed up for this event' })
    }

    if (eventSignup.maxSignups && eventSignup.signups.length >= eventSignup.maxSignups) {
      return response.status(400).json({ error: 'This event has reached its signup limit' })
    }

    eventSignup.signups.push({
      userId: request.user.id,
      userName: request.user.name || request.user.username,
      responsibility,
      notes: notes || ''
    })

    const updatedEventSignup = await eventSignup.save()
    await updatedEventSignup.populate('signups.userId', 'username name')

    response.status(201).json(updatedEventSignup)
  } catch {
    response.status(500).json({ error: 'Failed to add signup' })
  }
})

eventSignupsRouter.put('/:id/signups/:signupId', userExtractor, async (request, response) => {
  try {
    const { responsibility, notes } = request.body

    const eventSignup = await EventSignup.findById(request.params.id)
    if (!eventSignup) {
      return response.status(404).json({ error: 'Event signup not found' })
    }

    const signup = eventSignup.signups.id(request.params.signupId)
    if (!signup) {
      return response.status(404).json({ error: 'Signup not found' })
    }

    if (request.user.role !== 'admin' && signup.userId.toString() !== request.user.id) {
      return response.status(403).json({ error: 'You can only edit your own signup' })
    }

    if (responsibility) signup.responsibility = responsibility
    if (notes !== undefined) signup.notes = notes

    const updatedEventSignup = await eventSignup.save()
    await updatedEventSignup.populate('signups.userId', 'username name')

    response.json(updatedEventSignup)
  } catch {
    response.status(500).json({ error: 'Failed to update signup' })
  }
})

eventSignupsRouter.delete('/:id/signups/:signupId', userExtractor, async (request, response) => {
  try {
    const eventSignup = await EventSignup.findById(request.params.id)
    if (!eventSignup) {
      return response.status(404).json({ error: 'Event signup not found' })
    }

    const signup = eventSignup.signups.id(request.params.signupId)
    if (!signup) {
      return response.status(404).json({ error: 'Signup not found' })
    }

    if (request.user.role !== 'admin' && signup.userId.toString() !== request.user.id) {
      return response.status(403).json({ error: 'You can only delete your own signup' })
    }

    signup.deleteOne()
    const updatedEventSignup = await eventSignup.save()
    await updatedEventSignup.populate('signups.userId', 'username name')

    response.json(updatedEventSignup)
  } catch {
    response.status(500).json({ error: 'Failed to delete signup' })
  }
})

eventSignupsRouter.post('/upload-ics', userExtractor, upload.single('icsFile'), async (request, response) => {
  try {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Access denied. Admin privileges required.' })
    }

    if (!request.file) {
      return response.status(400).json({ error: 'No ICS file provided' })
    }

    const { maxSignups = null, isActive = true } = request.body

    const icsData = request.file.buffer.toString('utf8')
    const parsedData = ical.parseICS(icsData)

    const createdEvents = []
    const errors = []

    for (const [, event] of Object.entries(parsedData)) {
      if (event.type === 'VEVENT') {
        try {
          const eventTitle = event.summary || 'Untitled Event'
          const eventDescription = event.description || ''
          const location = event.location || ''


          const titleLower = eventTitle.toLowerCase()
          const descLower = eventDescription.toLowerCase()

          const titleHasHoliday = titleLower.includes('holiday')
          const descHasHoliday = descLower.includes('holiday')
          const titleHasSchoolBreak = titleLower.includes('school break')
          const descHasSchoolBreak = descLower.includes('school break')

          if (titleHasHoliday || descHasHoliday || titleHasSchoolBreak || descHasSchoolBreak) {
            continue
          }

          let startDate = event.start
          let endDate = event.end

          if (!startDate || !endDate) {
            continue
          }

          if (typeof startDate === 'string') {
            startDate = new Date(startDate)
          }
          if (typeof endDate === 'string') {
            endDate = new Date(endDate)
          }

          const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
          const endDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())
          const daysDiff = Math.ceil((endDay - startDay) / (1000 * 60 * 60 * 24))

          if (daysDiff <= 1) {
            const existingEvent = await EventSignup.findOne({
              eventTitle,
              eventDate: startDate
            })

            if (!existingEvent) {
              const eventData = {
                eventTitle,
                eventDate: startDate,
                eventDescription: `${eventDescription}${location ? `\nLocation: ${location}` : ''}`,
                maxSignups: maxSignups ? parseInt(maxSignups) : null,
                isActive: isActive !== false,
                signups: []
              }

              const newEvent = new EventSignup(eventData)
              await newEvent.save()
              createdEvents.push(newEvent)
            }
          } else if (daysDiff <= 7) {
            for (let day = 0; day < daysDiff; day++) {
              const currentDay = new Date(startDay)
              currentDay.setDate(startDay.getDate() + day)

              const eventDateTime = new Date(currentDay)
              eventDateTime.setHours(startDate.getHours(), startDate.getMinutes(), 0, 0)

              const dayTitle = `${eventTitle} - Day ${day + 1}`

              const existingEvent = await EventSignup.findOne({
                eventTitle: dayTitle,
                eventDate: eventDateTime
              })

              if (!existingEvent) {
                const eventData = {
                  eventTitle: dayTitle,
                  eventDate: eventDateTime,
                  eventDescription: `${eventDescription}${location ? `\nLocation: ${location}` : ''}\n\nThis is day ${day + 1} of a ${daysDiff}-day event.`,
                  maxSignups: maxSignups ? parseInt(maxSignups) : null,
                  isActive: isActive !== false,
                  signups: []
                }

                const newEvent = new EventSignup(eventData)
                await newEvent.save()
                createdEvents.push(newEvent)
              }
            }
          } else {
            const weeksDiff = Math.ceil(daysDiff / 7)

            for (let week = 0; week < weeksDiff; week++) {
              const weekStartDay = new Date(startDay)
              weekStartDay.setDate(startDay.getDate() + (week * 7))

              const eventDateTime = new Date(weekStartDay)
              eventDateTime.setHours(startDate.getHours(), startDate.getMinutes(), 0, 0)

              const weekTitle = `${eventTitle} - Week ${week + 1}`

              const existingEvent = await EventSignup.findOne({
                eventTitle: weekTitle,
                eventDate: eventDateTime
              })

              if (!existingEvent) {
                const eventData = {
                  eventTitle: weekTitle,
                  eventDate: eventDateTime,
                  eventDescription: `${eventDescription}${location ? `\nLocation: ${location}` : ''}\n\nThis is week ${week + 1} of a ${weeksDiff}-week event.`,
                  maxSignups: maxSignups ? parseInt(maxSignups) : null,
                  isActive: isActive !== false,
                  signups: []
                }

                const newEvent = new EventSignup(eventData)
                await newEvent.save()
                createdEvents.push(newEvent)
              }
            }
          }
        } catch (eventError) {
          errors.push({
            eventTitle: event.summary || 'Unknown Event',
            error: eventError.message
          })
        }
      }
    }

    response.json({
      message: `Successfully created ${createdEvents.length} events`,
      createdEvents,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch {
    response.status(500).json({ error: 'Failed to process ICS file' })
  }
})

module.exports = eventSignupsRouter