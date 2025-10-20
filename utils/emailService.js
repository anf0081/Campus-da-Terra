const sgMail = require('@sendgrid/mail')
const fetch = require('node-fetch')

// Initialize SendGrid with API key from environment variables
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY)
}

// Get sender email from environment or use default
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'noreply@campusdaterra.com'
const SENDER_NAME = process.env.SENDER_NAME || 'Campus da Terra'

/**
 * Send notification email to users
 * @param {Array} recipients - Array of email addresses
 * @param {Object} notificationData - Notification details
 * @param {string} notificationData.title - Notification title
 * @param {string} notificationData.message - Notification message
 * @param {string} notificationData.createdBy - Name of creator
 * @param {string} notificationData.attachmentUrl - Optional attachment URL
 * @param {string} notificationData.attachmentFileName - Optional attachment filename
 */
async function sendNotificationEmail(recipients, notificationData) {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('SendGrid API key not configured. Skipping email send.')
    return { success: false, error: 'SendGrid not configured' }
  }

  if (!recipients || recipients.length === 0) {
    console.warn('No recipients provided for notification email')
    return { success: false, error: 'No recipients' }
  }

  const { title, message, createdBy, attachmentUrl, attachmentFileName } = notificationData

  // Build email content
  const htmlContent = buildNotificationEmailHTML(title, message, createdBy, attachmentUrl, attachmentFileName)
  const textContent = buildNotificationEmailText(title, message, createdBy, attachmentUrl)

  try {
    const msg = {
      to: recipients,
      from: {
        email: SENDER_EMAIL,
        name: SENDER_NAME
      },
      subject: `New Notification: ${title}`,
      text: textContent,
      html: htmlContent
    }

    await sgMail.send(msg)
    console.log(`Notification email sent to ${recipients.length} recipient(s)`)
    return { success: true, count: recipients.length }
  } catch (error) {
    console.error('Error sending notification email:', error)
    if (error.response) {
      console.error('SendGrid error details:', error.response.body)
    }
    return { success: false, error: error.message }
  }
}

/**
 * Send document upload notification email
 * @param {string} recipientEmail - Parent's email address
 * @param {Object} documentData - Document upload details
 * @param {string} documentData.studentId - Student's ID for dashboard link
 * @param {string} documentData.studentName - Student's full name
 * @param {string} documentData.documentName - Name/description of document
 * @param {string} documentData.fileName - Actual filename
 * @param {string} documentData.uploadedBy - Name of uploader
 */
async function sendDocumentUploadEmail(recipientEmail, documentData) {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('SendGrid API key not configured. Skipping email send.')
    return { success: false, error: 'SendGrid not configured' }
  }

  if (!recipientEmail) {
    console.warn('No recipient email provided for document upload notification')
    return { success: false, error: 'No recipient' }
  }

  const { studentId, studentName, documentName, fileName, uploadedBy } = documentData

  const htmlContent = buildDocumentUploadEmailHTML(studentId, studentName, documentName, fileName, uploadedBy)
  const textContent = buildDocumentUploadEmailText(studentId, studentName, documentName, fileName, uploadedBy)

  try {
    const msg = {
      to: recipientEmail,
      from: {
        email: SENDER_EMAIL,
        name: SENDER_NAME
      },
      subject: `New Document Added to ${studentName}'s Dashboard`,
      text: textContent,
      html: htmlContent
    }

    await sgMail.send(msg)
    console.log(`Document upload email sent to ${recipientEmail}`)
    return { success: true }
  } catch (error) {
    console.error('Error sending document upload email:', error)
    if (error.response) {
      console.error('SendGrid error details:', error.response.body)
    }
    return { success: false, error: error.message }
  }
}

/**
 * Build HTML email template for notifications
 */
function buildNotificationEmailHTML(title, message, createdBy, attachmentUrl, attachmentFileName) {
  const hasAttachment = attachmentUrl && attachmentFileName

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #c1682e; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
    .message { background-color: white; padding: 20px; border-left: 4px solid #c1682e; margin: 20px 0; }
    .attachment { background-color: #fff3cd; padding: 15px; border-radius: 5px; margin-top: 20px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    .button { display: inline-block; padding: 12px 24px; background-color: #c1682e; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
    .unsubscribe { text-align: center; margin-top: 15px; font-size: 11px; color: #999; }
    .unsubscribe a { color: #c1682e; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Campus da Terra</h1>
      <p>New Notification</p>
    </div>
    <div class="content">
      <h2>${title}</h2>
      <div class="message">
        <p>${message.replace(/\n/g, '<br>')}</p>
      </div>
      <p><small>Posted by: ${createdBy}</small></p>
      ${hasAttachment ? `
      <div class="attachment">
        <strong>📎 Attachment:</strong> ${attachmentFileName}
        <p><small>Log in to your dashboard to view the attachment.</small></p>
      </div>
      ` : ''}
      <a href="${process.env.FRONTEND_URL || 'https://campusdaterra.com'}" class="button">View on Website</a>
    </div>
    <div class="footer">
      <p>This is an automated message from Campus da Terra.</p>
      <p>If you have any questions, please contact us.</p>
      <div class="unsubscribe">
        <p>Don't want to receive these emails? <a href="${process.env.FRONTEND_URL || 'https://campusdaterra.com'}/profile">Manage your email preferences</a></p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim()
}

/**
 * Build plain text email for notifications
 */
function buildNotificationEmailText(title, message, createdBy, attachmentUrl) {
  const hasAttachment = attachmentUrl

  return `
Campus da Terra - New Notification

${title}

${message}

Posted by: ${createdBy}

${hasAttachment ? 'This notification includes an attachment. Log in to your dashboard to view it.\n' : ''}
View on website: ${process.env.FRONTEND_URL || 'https://campusdaterra.com'}

---
This is an automated message from Campus da Terra.
To manage your email preferences, visit: ${process.env.FRONTEND_URL || 'https://campusdaterra.com'}/profile
  `.trim()
}

/**
 * Build HTML email template for document uploads
 */
function buildDocumentUploadEmailHTML(studentId, studentName, documentName, fileName, uploadedBy) {
  const dashboardUrl = `${process.env.FRONTEND_URL || 'https://campusdaterra.com'}/dashboard/${studentId}`

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #c1682e; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
    .document-info { background-color: white; padding: 20px; border-left: 4px solid #c1682e; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    .button { display: inline-block; padding: 12px 24px; background-color: #c1682e; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
    .unsubscribe { text-align: center; margin-top: 15px; font-size: 11px; color: #999; }
    .unsubscribe a { color: #c1682e; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Campus da Terra</h1>
      <p>New Document Upload</p>
    </div>
    <div class="content">
      <h2>New Document for ${studentName}</h2>
      <p>A new document has been added to ${studentName}'s dashboard.</p>
      <div class="document-info">
        <p><strong>Document:</strong> ${documentName}</p>
        <p><strong>File:</strong> ${fileName}</p>
        <p><strong>Uploaded by:</strong> ${uploadedBy}</p>
      </div>
      <a href="${dashboardUrl}" class="button">View Dashboard</a>
    </div>
    <div class="footer">
      <p>This is an automated message from Campus da Terra.</p>
      <p>If you have any questions, please contact us.</p>
      <div class="unsubscribe">
        <p>Don't want to receive these emails? <a href="${process.env.FRONTEND_URL || 'https://campusdaterra.com'}/profile">Manage your email preferences</a></p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim()
}

/**
 * Build plain text email for document uploads
 */
function buildDocumentUploadEmailText(studentId, studentName, documentName, fileName, uploadedBy) {
  const dashboardUrl = `${process.env.FRONTEND_URL || 'https://campusdaterra.com'}/dashboard/${studentId}`

  return `
Campus da Terra - New Document Upload

A new document has been added to ${studentName}'s dashboard.

Document: ${documentName}
File: ${fileName}
Uploaded by: ${uploadedBy}

View the document in your dashboard: ${dashboardUrl}

---
This is an automated message from Campus da Terra.
To manage your email preferences, visit: ${process.env.FRONTEND_URL || 'https://campusdaterra.com'}/profile
  `.trim()
}

/**
 * Send invoice/receipt upload notification email with attachment
 * @param {string} recipientEmail - Parent's email address
 * @param {Object} invoiceData - Invoice upload details
 * @param {string} invoiceData.studentId - Student's ID for dashboard link
 * @param {string} invoiceData.studentName - Student's full name
 * @param {string} invoiceData.receiptType - Type of receipt (receipt/donation_receipt)
 * @param {string} invoiceData.amount - Amount on receipt
 * @param {string} invoiceData.fileName - Actual filename
 * @param {string} invoiceData.fileUrl - Cloudinary URL of the file
 * @param {string} invoiceData.uploadedBy - Name of uploader
 */
async function sendInvoiceUploadEmail(recipientEmail, invoiceData) {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('SendGrid API key not configured. Skipping email send.')
    return { success: false, error: 'SendGrid not configured' }
  }

  if (!recipientEmail) {
    console.warn('No recipient email provided for invoice upload notification')
    return { success: false, error: 'No recipient' }
  }

  const { studentId, studentName, receiptType, fileName, fileUrl } = invoiceData

  const htmlContent = buildInvoiceUploadEmailHTML(studentId, studentName, receiptType, fileName)
  const textContent = buildInvoiceUploadEmailText(studentId, studentName, receiptType, fileName)

  try {
    // Fetch the file from Cloudinary and convert to base64
    const response = await fetch(fileUrl)
    const buffer = await response.buffer()
    const base64Content = buffer.toString('base64')

    const msg = {
      to: recipientEmail,
      from: {
        email: SENDER_EMAIL,
        name: SENDER_NAME
      },
      subject: `New ${receiptType === 'donation_receipt' ? 'Donation Receipt' : 'Receipt'} for ${studentName}`,
      text: textContent,
      html: htmlContent,
      attachments: [
        {
          content: base64Content,
          filename: fileName,
          type: 'application/pdf',
          disposition: 'attachment'
        }
      ]
    }

    await sgMail.send(msg)
    console.log(`Invoice upload email sent to ${recipientEmail}`)
    return { success: true }
  } catch (error) {
    console.error('Error sending invoice upload email:', error)
    if (error.response) {
      console.error('SendGrid error details:', error.response.body)
    }
    return { success: false, error: error.message }
  }
}

/**
 * Build HTML email template for invoice uploads
 */
function buildInvoiceUploadEmailHTML(studentId, studentName, receiptType, fileName) {
  const dashboardUrl = `${process.env.FRONTEND_URL || 'https://campusdaterra.com'}/dashboard/${studentId}`
  const receiptLabel = receiptType === 'donation_receipt' ? 'Donation Receipt' : 'Receipt'

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #c1682e; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
    .invoice-info { background-color: white; padding: 20px; border-left: 4px solid #c1682e; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    .button { display: inline-block; padding: 12px 24px; background-color: #c1682e; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
    .unsubscribe { text-align: center; margin-top: 15px; font-size: 11px; color: #999; }
    .unsubscribe a { color: #c1682e; text-decoration: none; }
    .attachment-note { background-color: #e8f5e9; padding: 15px; border-radius: 5px; margin-top: 20px; border-left: 4px solid #4caf50; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Campus da Terra</h1>
      <p>New ${receiptLabel}</p>
    </div>
    <div class="content">
      <h2>New ${receiptLabel} for ${studentName}</h2>
      <p>A new ${receiptLabel.toLowerCase()} has been uploaded to ${studentName}'s dashboard.</p>
      <div class="invoice-info">
        <p><strong>Type:</strong> ${receiptLabel}</p>
        <p><strong>File:</strong> ${fileName}</p>
      </div>
      <div class="attachment-note">
        <strong>📎 The ${receiptLabel.toLowerCase()} is attached to this email</strong>
        <p style="margin: 5px 0 0 0; font-size: 14px;">You can download it directly from this email or view it in your dashboard.</p>
      </div>
      <a href="${dashboardUrl}" class="button">View Dashboard</a>
    </div>
    <div class="footer">
      <p>This is an automated message from Campus da Terra.</p>
      <p>If you have any questions, please contact us.</p>
      <div class="unsubscribe">
        <p>Don't want to receive these emails? <a href="${process.env.FRONTEND_URL || 'https://campusdaterra.com'}/profile">Manage your email preferences</a></p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim()
}

/**
 * Build plain text email for invoice uploads
 */
function buildInvoiceUploadEmailText(studentId, studentName, receiptType, fileName) {
  const dashboardUrl = `${process.env.FRONTEND_URL || 'https://campusdaterra.com'}/dashboard/${studentId}`
  const receiptLabel = receiptType === 'donation_receipt' ? 'Donation Receipt' : 'Receipt'

  return `
Campus da Terra - New ${receiptLabel}

A new ${receiptLabel.toLowerCase()} has been uploaded for ${studentName}.

Type: ${receiptLabel}
File: ${fileName}

The ${receiptLabel.toLowerCase()} is attached to this email.

View in your dashboard: ${dashboardUrl}

---
This is an automated message from Campus da Terra.
To manage your email preferences, visit: ${process.env.FRONTEND_URL || 'https://campusdaterra.com'}/profile
  `.trim()
}

module.exports = {
  sendNotificationEmail,
  sendDocumentUploadEmail,
  sendInvoiceUploadEmail
}
