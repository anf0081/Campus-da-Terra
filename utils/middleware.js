const logger = require('./logger')
const User = require('../models/user')
const jwt = require('jsonwebtoken')

const tokenExtractor = (request, response, next) => {
  const authorization = request.get('authorization')
  if (authorization && authorization.startsWith('Bearer ')) {
    request.token = authorization.replace('Bearer ', '')
  } else {
    request.token = null
  }
  next()
}

const userExtractor = async (request, response, next) => {
  try {
    // Try to get token from Authorization header first, then from query params
    let token = request.get('authorization')?.replace('Bearer ', '')
    if (!token && request.query.token) {
      token = request.query.token
    }

    if (!token) {
      return response.status(401).json({ error: 'Token missing' })
    }

    const decodedToken = jwt.verify(token, process.env.SECRET)
    if (!decodedToken.id) return response.status(401).json({ error: 'Token invalid' })

    const user = await User.findById(decodedToken.id)
    if (!user) return response.status(401).json({ error: 'User not found' })

    request.user = user
    next()
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return response.status(401).json({ error: 'Token invalid' })
    }
    if (error.name === 'TokenExpiredError') {
      return response.status(401).json({ error: 'Token expired' })
    }
    next(error)
  }
}

const requestLogger = (request, response, next) => {
  logger.info('Method:', request.method)
  logger.info('Path:  ', request.path)
  logger.info('Body:  ', request.body)
  logger.info('---')
  next()
}
const unknownEndpoint = (request, response) => {
  response.status(404).send({ error: 'Unknown Endpoint' })
}
const errorHandler = (error, request, response, next) => {
  logger.error(error.message)

  if (error.name === 'CastError') {
    return response.status(400).send({ error: `Invalid ${error.path}: "${error.value}" is not a valid ${error.kind}` })
  } else if (error.name === 'ValidationError') {
    return response.status(400).json({ error: error.message })
  } else if (error.name === 'MongoServerError' && error.message.includes('E11000 duplicate key error')) {
    return response.status(400).json({ error: 'Expected `username` to be unique' })
  } else if (error.name ===  'JsonWebTokenError') {
    return response.status(401).json({ error: 'Token invalid' })
  } else if (error.name === 'TokenExpiredError') {
    return response.status(401).json({ error: 'Token expired' })
  } else if (error.name === 'TypeError' && error.message.includes('Cannot read properties')) {
    return response.status(401).json({ error: 'Token missing' })
  }
  next(error)
}

module.exports = {
  requestLogger,
  unknownEndpoint,
  errorHandler,
  tokenExtractor,
  userExtractor
}
