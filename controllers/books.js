const booksRouter = require('express').Router()
const Book = require('../models/book')
const User = require('../models/user')
const { userExtractor } = require('../utils/middleware')
const { exportBooks } = require('../utils/dataExport')

booksRouter.get('/', async (request, response) => {
  try {
    const page = parseInt(request.query.page) || 1
    const limit = parseInt(request.query.limit) || 18
    const skip = (page - 1) * limit

    const filterQuery = {}

    if (request.query.search) {
      const searchRegex = new RegExp(request.query.search, 'i')
      filterQuery.$or = [
        { title: searchRegex },
        { author: searchRegex }
      ]
    }

    if (request.query.language) {
      filterQuery.language = request.query.language
    }

    if (request.query.difficulty) {
      filterQuery.difficulty = request.query.difficulty
    }

    let sortQuery = { title: 1 }

    if (request.query.sort) {
      switch (request.query.sort) {
        case 'title-asc':
          sortQuery = { title: 1 }
          break
        case 'title-desc':
          sortQuery = { title: -1 }
          break
        case 'author-asc':
          sortQuery = { author: 1 }
          break
        case 'author-desc':
          sortQuery = { author: -1 }
          break
        case 'difficulty-asc':
          sortQuery = { title: 1 }
          break
        case 'difficulty-desc':
          sortQuery = { title: 1 }
          break
        default:
          sortQuery = { title: 1 }
      }
    }

    const totalBooks = await Book.countDocuments(filterQuery)

    let books
    if (request.query.sort && (request.query.sort === 'difficulty-asc' || request.query.sort === 'difficulty-desc')) {
      const sortDirection = request.query.sort === 'difficulty-asc' ? 1 : -1

      books = await Book.aggregate([
        { $match: filterQuery },
        {
          $addFields: {
            difficultyOrder: {
              $switch: {
                branches: [
                  { case: { $eq: ['$difficulty', 'Learning to Read'] }, then: 1 },
                  { case: { $eq: ['$difficulty', 'Beginner'] }, then: 2 },
                  { case: { $eq: ['$difficulty', 'Intermediate'] }, then: 3 },
                  { case: { $eq: ['$difficulty', 'Advanced'] }, then: 4 },
                  { case: { $eq: ['$difficulty', 'Expert'] }, then: 5 }
                ],
                default: 6
              }
            }
          }
        },
        { $sort: { difficultyOrder: sortDirection, title: 1 } },
        { $skip: skip },
        { $limit: limit }
      ])

      await Book.populate(books, [
        { path: 'user', select: 'username name' },
        { path: 'lending.borrower', select: 'username name' }
      ])
    } else {
      books = await Book.find(filterQuery)
        .sort(sortQuery)
        .skip(skip)
        .limit(limit)
        .populate('user', { username: 1, name: 1 })
        .populate('lending.borrower', { username: 1, name: 1 })
    }

    const User = require('../models/user')
    for (let book of books) {
      for (let historyEntry of book.lendingHistory) {
        if (historyEntry.borrower) {
          const borrowerUser = await User.findById(historyEntry.borrower).select('username name')
          historyEntry.borrower = borrowerUser
        }
      }
    }

    response.json({
      books,
      totalBooks,
      page,
      totalPages: Math.ceil(totalBooks / limit),
    })
  } catch {
    response.status(500).json({ error: 'Internal server error' })
  }
})



booksRouter.post('/', userExtractor, async (request, response) => {
  if (!request.user || request.user.role !== 'admin' && request.user.role !== 'tutor') {
    return response.status(403).json({ error: 'Only admins and tutors can add books' })
  }
  const body = request.body
  if (!body.title) {
    return response.status(400).json({ error: 'Title is required' })
  }

  const book = new Book({
    title: body.title,
    author: body.author || 'Unknown Author',
    url: body.url || '',
    user: request.user._id
  })

  const savedBook = await book.save()
  request.user.books = request.user.books.concat(savedBook._id)
  await request.user.save()
  response.status(201).json(savedBook)
})

booksRouter.delete('/:id', userExtractor, async (request, response) => {
  if (!request.user || (request.user.role !== 'admin' && request.user.role !== 'tutor')) {
    return response.status(403).json({ error: 'Only admins and tutors can delete books' })
  }


  const book = await Book.findById(request.params.id)

  if (!book) {
    return response.status(404).json({ error: 'Book not found' })
  }

  if (book.user.toString() === request.user._id.toString()) {
    await Book.findByIdAndDelete(book._id)
    response.status(204).end()
  } else {
    return response.status(403).json({ error: 'Unauthorized: can only delete your own books' })
  }
})

booksRouter.put('/:id', userExtractor, async (request, response) => {
  try {
    const { title, author, url, language, difficulty } = request.body || {}

    const updateBook = await Book.findById(request.params.id)
    if (!updateBook) {
      return response.status(404).end()
    }

    if (!request.user || (request.user.role !== 'admin' && request.user.role !== 'tutor')) {
      return response.status(403).json({ error: 'Only admins and tutors can update books' })
    }

    if (title !== undefined) updateBook.title = title
    if (author !== undefined) updateBook.author = author || 'Unknown Author'
    if (url !== undefined) updateBook.url = url
    if (language !== undefined) updateBook.language = language || ''
    if (difficulty !== undefined) {
      updateBook.difficulty = difficulty === '' ? undefined : difficulty
    }

    const savedBook = await updateBook.save()

    await savedBook.populate('user', { username: 1, name: 1 })
    await savedBook.populate('lending.borrower', { username: 1, name: 1 })

    const User = require('../models/user')
    for (let historyEntry of savedBook.lendingHistory) {
      if (historyEntry.borrower) {
        const borrowerUser = await User.findById(historyEntry.borrower).select('username name')
        historyEntry.borrower = borrowerUser
      }
    }

    response.json(savedBook)
  } catch (error) {
    response.status(500).json({ error: 'Failed to update book', details: error.message })
  }
})

booksRouter.put('/:id/lend', userExtractor, async (request, response) => {
  const { userId } = request.body
  const isAdminOrTutor = request.user.role === 'admin' || request.user.role === 'tutor'

  const borrowerId = (isAdminOrTutor && userId) ? userId : request.user._id

  const borrowedCount = await Book.countDocuments({
    'lending.isLent': true,
    'lending.borrower': borrowerId
  })

  if (borrowedCount >= 3) {
    const borrowerText = (isAdminOrTutor && userId) ? 'This user' : 'You'
    return response.status(400).json({ error: `${borrowerText} can only borrow up to 3 books at a time.` })
  }

  const book = await Book.findById(request.params.id)
  if (!book) {
    return response.status(404).json({ error: 'Book not found' })
  }

  if (book.lending.isLent) {
    return response.status(400).json({ error: 'Book is already lent out' })
  }

  const lentDate = new Date()
  const dueDate = new Date(lentDate)
  dueDate.setDate(lentDate.getDate() + 21)

  book.lending = {
    isLent: true,
    borrower: borrowerId,
    lentDate: lentDate,
    dueDate: dueDate
  }

  book.lendingHistory.push({
    borrower: borrowerId,
    lentDate: lentDate,
    dueDate: dueDate,
    returnedDate: null,
    isReturned: false
  })

  const savedBook = await book.save()

  const User = require('../models/user')
  for (let historyEntry of savedBook.lendingHistory) {
    if (historyEntry.borrower) {
      const borrowerUser = await User.findById(historyEntry.borrower).select('username name')
      historyEntry.borrower = borrowerUser
    }
  }

  response.json(savedBook)
})

booksRouter.put('/:id/return', userExtractor, async (request, response) => {
  const book = await Book.findById(request.params.id)
  if (!book) {
    return response.status(404).json({ error: 'Book not found' })
  }

  if (!book.lending.isLent) {
    return response.status(400).json({ error: 'Book is not currently lent out' })
  }

  if (!book.lending.borrower) {
    return response.status(400).json({ error: 'Book lending data is corrupted - no borrower found' })
  }

  const isBorrower = book.lending.borrower.toString() === request.user._id.toString()
  const isAdminOrTutor = request.user.role === 'admin' || request.user.role === 'tutor'

  if (!isBorrower && !isAdminOrTutor) {
    return response.status(403).json({ error: 'Unauthorized: only the borrower or an admin can return this book' })
  }

  if (isBorrower && !isAdminOrTutor) {
    book.lending.returnRequested = true
    book.lending.returnRequestDate = new Date()

    const savedBook = await book.save()
    await savedBook.populate('user', { username: 1, name: 1 })
    await savedBook.populate('lending.borrower', { username: 1, name: 1 })

    const User = require('../models/user')
    for (let historyEntry of savedBook.lendingHistory) {
      if (historyEntry.borrower) {
        const borrowerUser = await User.findById(historyEntry.borrower).select('username name')
        historyEntry.borrower = borrowerUser
      }
    }

    return response.json(savedBook)
  }

  const borrowerId = book.lending.borrower

  const currentHistoryEntry = book.lendingHistory.find(
    entry => entry.borrower.toString() === borrowerId.toString() && !entry.isReturned
  )

  if (currentHistoryEntry) {
    currentHistoryEntry.returnedDate = new Date()
    currentHistoryEntry.isReturned = true
  }

  book.lending = {
    isLent: false,
    borrower: null,
    lentDate: null,
    dueDate: null,
    returnRequested: false,
    returnRequestDate: null
  }

  const savedBook = await book.save()

  const User = require('../models/user')
  for (let historyEntry of savedBook.lendingHistory) {
    if (historyEntry.borrower) {
      const borrowerUser = await User.findById(historyEntry.borrower).select('username name')
      historyEntry.borrower = borrowerUser
    }
  }

  response.json(savedBook)
})

booksRouter.put('/:id/return-request/:action', userExtractor, async (request, response) => {
  const { action } = request.params

  if (!request.user || (request.user.role !== 'admin' && request.user.role !== 'tutor')) {
    return response.status(403).json({ error: 'Only admins and tutors can approve/deny return requests' })
  }

  if (action !== 'approve' && action !== 'deny') {
    return response.status(400).json({ error: 'Action must be "approve" or "deny"' })
  }

  const book = await Book.findById(request.params.id)
  if (!book) {
    return response.status(404).json({ error: 'Book not found' })
  }

  if (!book.lending.isLent || !book.lending.returnRequested) {
    return response.status(400).json({ error: 'No return request found for this book' })
  }

  if (action === 'approve') {
    const borrowerId = book.lending.borrower

    const currentHistoryEntry = book.lendingHistory.find(
      entry => entry.borrower.toString() === borrowerId.toString() && !entry.isReturned
    )

    if (currentHistoryEntry) {
      currentHistoryEntry.returnedDate = new Date()
      currentHistoryEntry.isReturned = true
    }

    book.lending = {
      isLent: false,
      borrower: null,
      lentDate: null,
      dueDate: null,
      returnRequested: false,
      returnRequestDate: null
    }
  } else {
    book.lending.returnRequested = false
    book.lending.returnRequestDate = null
  }

  const savedBook = await book.save()

  const User = require('../models/user')
  for (let historyEntry of savedBook.lendingHistory) {
    if (historyEntry.borrower) {
      const borrowerUser = await User.findById(historyEntry.borrower).select('username name')
      historyEntry.borrower = borrowerUser
    }
  }

  response.json(savedBook)
})

booksRouter.put('/:id/clear-history', userExtractor, async (request, response) => {
  const book = await Book.findById(request.params.id)
  if (!book) {
    return response.status(404).json({ error: 'Book not found' })
  }

  if (!request.user || (request.user.role !== 'admin' && request.user.role !== 'tutor')) {
    return response.status(403).json({ error: 'Only admins and tutors can clear borrowing history' })
  }

  book.lendingHistory = []

  const savedBook = await book.save()
  response.json(savedBook)
})


booksRouter.get('/export', userExtractor, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Permission denied - admin access required' })
    }

    const filters = {
      availability: req.query.availability
    }

    const exportData = await exportBooks(filters)

    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `books-export-${timestamp}.json`

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

    res.json(exportData)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

booksRouter.post('/import', userExtractor, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Permission denied - admin access required' })
    }

    const { books, duplicateHandling = 'skip' } = req.body
    const booksToImport = Array.isArray(books) ? books : [books]
    const results = {
      success: [],
      errors: [],
      duplicates: []
    }

    for (const bookData of booksToImport) {
      try {
        const cleanData = { ...bookData }
        if (cleanData.id) {
          delete cleanData.id
        }
        if (cleanData._id) {
          delete cleanData._id
        }

        if (!cleanData.title) {
          results.errors.push({
            title: cleanData.title || 'Unknown',
            error: 'Title is required'
          })
          continue
        }

        const existingBook = await Book.findOne({
          title: cleanData.title,
          author: cleanData.author || ''
        })

        if (existingBook) {
          if (duplicateHandling === 'skip') {
            results.duplicates.push({
              title: cleanData.title,
              message: 'Skipped - duplicate book found'
            })
            continue
          }
          results.duplicates.push({
            title: cleanData.title,
            message: 'Duplicate book found but no merge strategy for books'
          })
          continue
        }

        if (cleanData.lentTo && cleanData.lentToUsername) {
          const user = await User.findOne({ username: cleanData.lentToUsername })
          if (user) {
            cleanData.lentTo = user._id
          } else {
            cleanData.lentTo = null
            cleanData.lentDate = null
          }
        }
        delete cleanData.lentToUsername

        if (cleanData.lendingHistory && Array.isArray(cleanData.lendingHistory)) {
          const historyPromises = cleanData.lendingHistory.map(async (entry) => {
            if (entry.username) {
              const user = await User.findOne({ username: entry.username })
              if (user) {
                return {
                  user: user._id,
                  lentDate: entry.lentDate,
                  returnedDate: entry.returnedDate
                }
              }
            }
            return null
          })
          cleanData.lendingHistory = (await Promise.all(historyPromises)).filter(entry => entry !== null)
        }

        const book = new Book(cleanData)
        const savedBook = await book.save()

        results.success.push({
          title: savedBook.title,
          id: savedBook._id
        })
      } catch (error) {
        results.errors.push({
          title: bookData.title || 'Unknown',
          error: error.message
        })
      }
    }

    let message = `Books import completed: ${results.success.length} created`
    if (results.duplicates.length > 0) {
      message += `, ${results.duplicates.length} skipped`
    }

    res.status(200).json({
      message,
      results,
      summary: {
        total: booksToImport.length,
        created: results.success.length,
        skipped: results.duplicates.length,
        errors: results.errors.length
      }
    })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

booksRouter.get('/languages', async (request, response) => {
  try {
    const languages = await Book.distinct('language', { language: { $ne: '', $exists: true } })
    response.json(languages.filter(lang => lang && lang.trim() !== '').sort())
  } catch {
    response.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = booksRouter
