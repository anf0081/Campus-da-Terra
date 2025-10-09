const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const loginRouter = require('express').Router()
const User = require('../models/user')

loginRouter.post('/', async (request, response) => {
  const { username, password, rememberMe } = request.body

  const user = await User.findOne({ username })
  const passwordCorrect = user === null
    ? false
    : await bcrypt.compare(password, user.passwordHash)

  if (!(user && passwordCorrect)) {
    return response.status(401).json({
      error: 'Invalid username or password'
    })
  }

  const userForToken = {
    username: user.username,
    id: user._id,
  }

  const tokenExpiration = rememberMe ? 60*60*24*30 : 60*60

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