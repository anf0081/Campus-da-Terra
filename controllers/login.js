const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const loginRouter = require('express').Router()
const User = require('../models/user')
const rateLimit = require('express-rate-limit')
const logger = require('../utils/logger')

// Rate limiter: 10 login attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: 'Too many login attempts from this IP, please try again after 15 minutes',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skipSuccessfulRequests: true, // Don't count successful logins toward the limit
})

loginRouter.post('/', loginLimiter, async (request, response) => {
  const { username, password, rememberMe } = request.body
  const clientIp = request.ip || request.connection.remoteAddress

  const user = await User.findOne({ username })

  // Check if account is locked
  if (user && user.lockUntil && user.lockUntil > Date.now()) {
    const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / (1000 * 60))
    logger.info(`Failed login attempt for locked account: ${username} from IP: ${clientIp}`)
    return response.status(423).json({
      error: `Account is locked due to too many failed login attempts. Please try again in ${minutesLeft} minute(s).`
    })
  }

  const passwordCorrect = user === null
    ? false
    : await bcrypt.compare(password, user.passwordHash)

  if (!(user && passwordCorrect)) {
    // Log failed login attempt
    logger.info(`Failed login attempt for username: ${username} from IP: ${clientIp} at ${new Date().toISOString()}`)

    // Increment login attempts for existing user
    if (user) {
      user.loginAttempts = (user.loginAttempts || 0) + 1

      // Lock account after 5 failed attempts
      if (user.loginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 30 * 60 * 1000) // Lock for 30 minutes
        logger.warn(`Account locked for username: ${username} due to 5 failed login attempts from IP: ${clientIp}`)
      }

      await user.save()
    }

    return response.status(401).json({
      error: 'Invalid username or password'
    })
  }

  if (user.isArchived) {
    logger.info(`Archived account login attempt: ${username} from IP: ${clientIp}`)
    return response.status(403).json({
      error: 'This account has been archived. Please contact an administrator.'
    })
  }

  // Successful login - reset login attempts
  if (user.loginAttempts > 0 || user.lockUntil) {
    user.loginAttempts = 0
    user.lockUntil = undefined
    await user.save()
  }

  const userForToken = {
    username: user.username,
    id: user._id,
  }

  const tokenExpiration = rememberMe ? 60*60*24*7 : 60*60

  const token = jwt.sign(
    userForToken,
    process.env.SECRET,
    { expiresIn: tokenExpiration }
  )

  response
    .status(200)
    .send({
      token,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      isGAMember: user.isGAMember || false,
      id: user._id,
      contactNumber: user.contactNumber,
      parentStreetAddress: user.parentStreetAddress,
      parentCity: user.parentCity,
      parentPostalCode: user.parentPostalCode,
      parentCountry: user.parentCountry,
      parentNationality: user.parentNationality,
      parentPassportNumber: user.parentPassportNumber,
      parentPassportExpiryDate: user.parentPassportExpiryDate,
      parentNifNumber: user.parentNifNumber,
      emergencyContactRelationship: user.emergencyContactRelationship,
      emergencyContactName: user.emergencyContactName,
      emergencyContactNumber: user.emergencyContactNumber,
      rememberMe: rememberMe || false
    })
})

module.exports = loginRouter