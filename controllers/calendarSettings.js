const express = require('express')
const router = express.Router()
const CalendarSettings = require('../models/calendarSettings')
const { userExtractor } = require('../utils/middleware')

router.get('/', async (req, res) => {
  try {
    let settings = await CalendarSettings.findOne()

    if (!settings) {
      settings = new CalendarSettings({
        desktopCalendarUrl: 'https://calendar.google.com/calendar/embed?height=600&wkst=2&ctz=Europe%2FLisbon&showPrint=0&showTitle=0&title=Campus%20da%20Terra%20Events&src=Y18wNjBkNGExMmUzZTU1ZjczZmUwOWFiNDQ3MWM2NThmODgzMWFkOGI5OTI3NGM2OWU1M2Q3NGI1YWQxNDQ5NjllQGdyb3VwLmNhbGVuZGFyLmdvb2dsZS5jb20&src=Y19hZWI4ZDgxOTg1MjUzNDY0ZGVmYjMwMDRkZTlkNDhlNGQyZmE4MjNlZTkyMzc0ZDRiNWViYjBiZDlmYTY0ZGM4QGdyb3VwLmNhbGVuZGFyLmdvb2dsZS5jb20&src=Y18xNDlkMjQxMDkxYTJjYWFhMDM0OTUxYmNhYjllNTJjNjU1ZGQ4MjY1MTMzZGVlOWI4ZjQ3Y2JiMTQ0MDRhYjgxQGdyb3VwLmNhbGVuZGFyLmdvb2dsZS5jb20&color=%23d81b60&color=%23f6bf26&color=%23009688',
        mobileCalendarUrl: 'https://calendar.google.com/calendar/embed?height=600&wkst=2&ctz=Europe%2FLisbon&showPrint=0&showTitle=0&title=Campus%20da%20Terra%20Events&mode=AGENDA&src=Y18wNjBkNGExMmUzZTU1ZjczZmUwOWFiNDQ3MWM2NThmODgzMWFkOGI5OTI3NGM2OWU1M2Q3NGI1YWQxNDQ5NjllQGdyb3VwLmNhbGVuZGFyLmdvb2dsZS5jb20&src=Y19hZWI4ZDgxOTg1MjUzNDY0ZGVmYjMwMDRkZTlkNDhlNGQyZmE4MjNlZTkyMzc0ZDRiNWViYjBiZDlmYTY0ZGM4QGdyb3VwLmNhbGVuZGFyLmdvb2dsZS5jb20&src=Y18xNDlkMjQxMDkxYTJjYWFhMDM0OTUxYmNhYjllNTJjNjU1ZGQ4MjY1MTMzZGVlOWI4ZjQ3Y2JiMTQ0MDRhYjgxQGdyb3VwLmNhbGVuZGFyLmdvb2dsZS5jb20&color=%23d81b60&color=%23f6bf26&color=%23009688'
      })
      await settings.save()
    }

    res.json(settings)
  } catch {
    res.status(500).json({ error: 'Failed to fetch calendar settings' })
  }
})

router.put('/', userExtractor, async (req, res) => {
  try {
    const user = req.user

    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Permission denied. Only administrators can update calendar settings.' })
    }

    const { desktopCalendarUrl, mobileCalendarUrl } = req.body

    if (!desktopCalendarUrl || !mobileCalendarUrl) {
      return res.status(400).json({ error: 'Both desktop and mobile calendar URLs are required' })
    }

    try {
      new URL(desktopCalendarUrl)
      new URL(mobileCalendarUrl)
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' })
    }

    let settings = await CalendarSettings.findOne()

    if (!settings) {
      settings = new CalendarSettings({
        desktopCalendarUrl,
        mobileCalendarUrl
      })
    } else {
      settings.desktopCalendarUrl = desktopCalendarUrl
      settings.mobileCalendarUrl = mobileCalendarUrl
    }

    await settings.save()
    res.json(settings)
  } catch {
    res.status(500).json({ error: 'Failed to update calendar settings' })
  }
})

module.exports = router
