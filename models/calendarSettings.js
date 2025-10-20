const mongoose = require('mongoose')

const calendarSettingsSchema = mongoose.Schema({
  desktopCalendarUrl: {
    type: String,
    required: true,
    default: "https://calendar.google.com/calendar/embed?height=600&wkst=2&ctz=Europe%2FLisbon&showPrint=0&showTitle=0&title=Campus%20da%20Terra%20Events&src=Y18wNjBkNGExMmUzZTU1ZjczZmUwOWFiNDQ3MWM2NThmODgzMWFkOGI5OTI3NGM2OWU1M2Q3NGI1YWQxNDQ5NjllQGdyb3VwLmNhbGVuZGFyLmdvb2dsZS5jb20&src=Y19hZWI4ZDgxOTg1MjUzNDY0ZGVmYjMwMDRkZTlkNDhlNGQyZmE4MjNlZTkyMzc0ZDRiNWViYjBiZDlmYTY0ZGM4QGdyb3VwLmNhbGVuZGFyLmdvb2dsZS5jb20&src=Y18xNDlkMjQxMDkxYTJjYWFhMDM0OTUxYmNhYjllNTJjNjU1ZGQ4MjY1MTMzZGVlOWI4ZjQ3Y2JiMTQ0MDRhYjgxQGdyb3VwLmNhbGVuZGFyLmdvb2dsZS5jb20&color=%23d81b60&color=%23f6bf26&color=%23009688"
  },
  mobileCalendarUrl: {
    type: String,
    required: true,
    default: "https://calendar.google.com/calendar/embed?height=600&wkst=2&ctz=Europe%2FLisbon&showPrint=0&showTitle=0&title=Campus%20da%20Terra%20Events&mode=AGENDA&src=Y18wNjBkNGExMmUzZTU1ZjczZmUwOWFiNDQ3MWM2NThmODgzMWFkOGI5OTI3NGM2OWU1M2Q3NGI1YWQxNDQ5NjllQGdyb3VwLmNhbGVuZGFyLmdvb2dsZS5jb20&src=Y19hZWI4ZDgxOTg1MjUzNDY0ZGVmYjMwMDRkZTlkNDhlNGQyZmE4MjNlZTkyMzc0ZDRiNWViYjBiZDlmYTY0ZGM4QGdyb3VwLmNhbGVuZGFyLmdvb2dsZS5jb20&src=Y18xNDlkMjQxMDkxYTJjYWFhMDM0OTUxYmNhYjllNTJjNjU1ZGQ4MjY1MTMzZGVlOWI4ZjQ3Y2JiMTQ0MDRhYjgxQGdyb3VwLmNhbGVuZGFyLmdvb2dsZS5jb20&color=%23d81b60&color=%23f6bf26&color=%23009688"
  }
}, {
  timestamps: true
})

calendarSettingsSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    if (returnedObject._id) {
      returnedObject.id = returnedObject._id.toString()
    }
    delete returnedObject._id
    delete returnedObject.__v
  }
})

module.exports = mongoose.model('CalendarSettings', calendarSettingsSchema)
