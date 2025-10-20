require('dotenv').config()
const { sendNotificationEmail, sendDocumentUploadEmail, sendInvoiceUploadEmail } = require('../utils/emailService')

/**
 * Test script to verify SendGrid email configuration
 * Usage: node scripts/testEmail.js <your-email@example.com>
 */

async function testNotificationEmail(recipientEmail) {
  console.log('Testing notification email...')
  console.log(`Recipient: ${recipientEmail}`)
  console.log(`From: ${process.env.SENDER_EMAIL}`)
  console.log(`SendGrid API Key configured: ${process.env.SENDGRID_API_KEY ? 'Yes' : 'No'}`)
  console.log('---')

  const testData = {
    title: 'Test Notification - Email System Working!',
    message: 'This is a test notification to verify that your SendGrid email integration is working correctly.\n\nIf you received this email, everything is set up properly! 🎉',
    createdBy: 'System Test',
    attachmentUrl: null,
    attachmentFileName: null
  }

  try {
    const result = await sendNotificationEmail([recipientEmail], testData)

    if (result.success) {
      console.log('✅ SUCCESS! Notification email sent successfully!')
      console.log(`Sent to ${result.count} recipient(s)`)
      console.log('\nCheck your email inbox (and spam folder) for the test email.')
    } else {
      console.log('❌ FAILED to send notification email')
      console.log(`Error: ${result.error}`)
    }

    return result.success
  } catch (error) {
    console.error('❌ ERROR sending notification email:', error.message)
    if (error.response) {
      console.error('SendGrid error details:', JSON.stringify(error.response.body, null, 2))
    }
    return false
  }
}

async function testDocumentUploadEmail(recipientEmail) {
  console.log('\nTesting document upload email...')
  console.log(`Recipient: ${recipientEmail}`)
  console.log('---')

  const testData = {
    studentId: '68d1f732f53c3aaa971c719c',
    studentName: 'Test Student',
    documentName: 'Sample Report Card',
    fileName: 'report-card-2024.pdf',
    uploadedBy: 'Test Admin'
  }

  try {
    const result = await sendDocumentUploadEmail(recipientEmail, testData)

    if (result.success) {
      console.log('✅ SUCCESS! Document upload email sent successfully!')
      console.log('\nCheck your email inbox (and spam folder) for the test email.')
    } else {
      console.log('❌ FAILED to send document upload email')
      console.log(`Error: ${result.error}`)
    }

    return result.success
  } catch (error) {
    console.error('❌ ERROR sending document upload email:', error.message)
    if (error.response) {
      console.error('SendGrid error details:', JSON.stringify(error.response.body, null, 2))
    }
    return false
  }
}

async function testInvoiceUploadEmail(recipientEmail) {
  console.log('\nTesting invoice upload email with attachment...')
  console.log(`Recipient: ${recipientEmail}`)
  console.log('---')

  const testData = {
    studentId: '68d1f732f53c3aaa971c719c',
    studentName: 'Test Student',
    receiptType: 'receipt',
    amount: '250.00',
    fileName: 'receipt-january-2024.pdf',
    fileUrl: 'https://res.cloudinary.com/dtv7vllhf/image/upload/v1234567890/test-receipt.pdf',
    uploadedBy: 'Test Admin'
  }

  try {
    const result = await sendInvoiceUploadEmail(recipientEmail, testData)

    if (result.success) {
      console.log('✅ SUCCESS! Invoice email sent successfully!')
      console.log('\nCheck your email inbox (and spam folder) for the test email with attachment.')
    } else {
      console.log('❌ FAILED to send invoice email')
      console.log(`Error: ${result.error}`)
    }

    return result.success
  } catch (error) {
    console.error('❌ ERROR sending invoice email:', error.message)
    if (error.response) {
      console.error('SendGrid error details:', JSON.stringify(error.response.body, null, 2))
    }
    return false
  }
}

async function runTests() {
  console.log('=================================')
  console.log('SendGrid Email Test Script')
  console.log('=================================\n')

  // Get email from command line argument
  const testEmail = process.argv[2]

  if (!testEmail) {
    console.error('❌ ERROR: Please provide a test email address')
    console.log('\nUsage: node scripts/testEmail.js your-email@example.com')
    console.log('Example: node scripts/testEmail.js test@gmail.com')
    process.exit(1)
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(testEmail)) {
    console.error('❌ ERROR: Invalid email address format')
    process.exit(1)
  }

  // Check if SendGrid is configured
  if (!process.env.SENDGRID_API_KEY) {
    console.error('❌ ERROR: SENDGRID_API_KEY not found in .env file')
    console.log('\nPlease add your SendGrid API key to the .env file:')
    console.log('SENDGRID_API_KEY="your-api-key-here"')
    process.exit(1)
  }

  if (!process.env.SENDER_EMAIL) {
    console.error('⚠️  WARNING: SENDER_EMAIL not configured, using default')
  }

  console.log('Environment Configuration:')
  console.log(`- SENDGRID_API_KEY: ${process.env.SENDGRID_API_KEY.substring(0, 10)}...`)
  console.log(`- SENDER_EMAIL: ${process.env.SENDER_EMAIL || 'noreply@campusdaterra.com (default)'}`)
  console.log(`- SENDER_NAME: ${process.env.SENDER_NAME || 'Campus da Terra (default)'}`)
  console.log(`- FRONTEND_URL: ${process.env.FRONTEND_URL || 'https://campusdaterra.com (default)'}\n`)

  // Run tests
  const test1Success = await testNotificationEmail(testEmail)

  if (test1Success) {
    // Wait a bit before sending second email
    await new Promise(resolve => setTimeout(resolve, 2000))
    const test2Success = await testDocumentUploadEmail(testEmail)

    if (test2Success) {
      // Wait before sending third email
      await new Promise(resolve => setTimeout(resolve, 2000))
      await testInvoiceUploadEmail(testEmail)
    }
  }

  console.log('\n=================================')
  console.log('Test Complete!')
  console.log('=================================')
  console.log('\nIf you received the emails, your setup is working correctly! 🎉')
  console.log('If not, check:')
  console.log('1. Your SendGrid API key is correct')
  console.log('2. Your sender email is verified in SendGrid')
  console.log('3. Check your spam/junk folder')
  console.log('4. Check SendGrid Activity dashboard for delivery status')
  console.log('\nNote: Invoice email includes a PDF attachment from Cloudinary')
}

// Run the tests
runTests().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
