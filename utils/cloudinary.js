const { v2: cloudinary } = require('cloudinary')
const { CloudinaryStorage } = require('multer-storage-cloudinary')
const multer = require('multer')
const crypto = require('crypto')

cloudinary.config()

const generateSecureFilename = (prefix) => {
  const randomId = crypto.randomBytes(8).toString('hex')
  const timestamp = Date.now()
  return `${prefix}-${randomId}-${timestamp}`
}

const profilePictureStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'cdt-student-profiles',
    allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'webp'],
    type: 'private',
    transformation: [
      { width: 400, height: 400, crop: 'fill', quality: 'auto' },
      { fetch_format: 'auto' }
    ],
    public_id: (_req, _file) => generateSecureFilename('profile')
  }
})

const portfolioStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'cdt-portfolios',
    allowed_formats: ['pdf'],
    type: 'private',
    resource_type: 'raw',
    public_id: (_req, _file) => `${generateSecureFilename('portfolio')}.pdf`,
    use_filename: false
  }
})

const documentStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'cdt-documents',
    type: 'private',
    resource_type: (_req, file) => {
      return file.mimetype.startsWith('image/') ? 'image' : 'raw'
    },
    public_id: (_req, _file) => generateSecureFilename('document'),
    format: (_req, file) => {
      if (file.mimetype === 'application/pdf') {
        return 'pdf'
      }
      if (file.mimetype === 'application/msword') {
        return 'doc'
      }
      if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        return 'docx'
      }
      return undefined
    }
  }
})

const invoiceStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'cdt-invoices',
    allowed_formats: ['pdf', 'jpg', 'jpeg', 'png'],
    type: 'private',
    resource_type: (_req, file) => {
      return file.mimetype.startsWith('image/') ? 'image' : 'raw'
    },
    public_id: (_req, file) => {
      const baseId = generateSecureFilename('receipt')
      if (file.mimetype === 'application/pdf') {
        return `${baseId}.pdf`
      } else if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg') {
        return `${baseId}.jpg`
      } else if (file.mimetype === 'image/png') {
        return `${baseId}.png`
      }
      return baseId
    },
    use_filename: false
  }
})

const uploadProfilePicture = multer({
  storage: profilePictureStorage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Only image files are allowed'), false)
    }
  }
})

const uploadPortfolio = multer({
  storage: portfolioStorage,
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true)
    } else {
      cb(new Error('Only PDF files are allowed for portfolios'), false)
    }
  }
})

const uploadDocument = multer({
  storage: documentStorage,
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    const allowedExtensions = /\.(pdf|doc|docx|jpg|jpeg|png)$/i
    const extname = allowedExtensions.test(file.originalname)

    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/jpg',
      'image/png'
    ]
    const mimetype = allowedMimeTypes.includes(file.mimetype)

    if (mimetype && extname) {
      cb(null, true)
    } else {
      cb(new Error('Only PDF, DOC, DOCX, JPG, JPEG, PNG files are allowed'), false)
    }
  }
})

const uploadInvoice = multer({
  storage: invoiceStorage,
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = /pdf|jpg|jpeg|png/
    const extname = allowedTypes.test(file.originalname.toLowerCase())
    const mimetype = allowedTypes.test(file.mimetype)

    if (mimetype && extname) {
      cb(null, true)
    } else {
      cb(new Error('Only PDF, JPG, JPEG, PNG files are allowed for invoices'), false)
    }
  }
})


const deleteFileByUrl = async (fileUrl, fileName) => {
  if (!fileUrl) return null

  try {
    const publicId = getPublicIdFromUrl(fileUrl)
    if (!publicId) {
      console.error('Could not extract publicId from URL:', fileUrl)
      return null
    }

    const publicIdsToTry = [publicId]
    const isImage = fileName && /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName)

    const primaryResourceType = isImage ? 'image' : 'raw'

    for (const publicId of publicIdsToTry) {

      const existenceChecks = [
        { resource_type: 'raw', type: 'private' },
        { resource_type: 'raw', type: 'upload' },
        { resource_type: 'raw' },
        { resource_type: 'image', type: 'private' },
        { resource_type: 'image', type: 'upload' },
        { resource_type: 'image' }
      ]

      let fileFound = false
      let actualFormat = null

      for (const check of existenceChecks) {
        try {
          const existsCheck = await cloudinary.api.resource(publicId, check)
          actualFormat = existsCheck.format
          fileFound = true
          break
        } catch {
          // Continue to next check
        }
      }

      if (!fileFound) {
        continue
      }

      const deletionAttempts = [
        { resource_type: primaryResourceType, type: 'upload' },
        { resource_type: primaryResourceType },
        actualFormat ? { resource_type: primaryResourceType, type: 'upload', format: actualFormat } : null,
        actualFormat ? { resource_type: primaryResourceType, format: actualFormat } : null,
        { resource_type: isImage ? 'raw' : 'image', type: 'upload' }
      ].filter(Boolean)

      for (let i = 0; i < deletionAttempts.length; i++) {
        const attempt = deletionAttempts[i]

        try {
          const result = await cloudinary.uploader.destroy(publicId, attempt)

          if (result && result.result === 'ok') {
            return result
          }
        } catch {
          // Continue to next deletion attempt
        }
      }
    }

    return { result: 'not found' }

  } catch (error) {
    console.error('Error in deleteFileByUrl:', error)
    throw error
  }
}

const getPublicIdFromUrl = (url) => {
  if (!url) return null

  try {
    const urlParts = url.split('/')
    let uploadIndex = urlParts.indexOf('upload')
    if (uploadIndex === -1) {
      uploadIndex = urlParts.indexOf('image')
    }
    if (uploadIndex === -1) {
      uploadIndex = urlParts.indexOf('raw')
    }

    if (uploadIndex === -1) {
      return null
    }

    // For private images: .../upload/private/s--signature--/v1234567890/folder/publicId.ext
    // For signed images: .../image/private/s--signature--/v1234567890/folder/publicId.ext
    // For download URLs: .../raw/private/s--signature--/fl_attachment:filename/v1234567890/folder/publicId.ext
    let startIndex = uploadIndex + 1

    if (urlParts[startIndex] === 'private') {
      startIndex++
    }

    if (urlParts[startIndex] && urlParts[startIndex].startsWith('s--') && urlParts[startIndex].endsWith('--')) {
      startIndex++
    }

    while (urlParts[startIndex] && (
      urlParts[startIndex].startsWith('fl_') ||
      urlParts[startIndex].startsWith('f_') ||
      urlParts[startIndex].startsWith('attachment:') ||
      urlParts[startIndex].includes('attachment')
    )) {
      startIndex++
    }

    if (urlParts[startIndex] && urlParts[startIndex].match(/^v\d+$/)) {
      startIndex++
    }

    const publicIdParts = urlParts.slice(startIndex)

    if (publicIdParts.length === 0) {
      return null
    }

    const lastPart = publicIdParts[publicIdParts.length - 1]
    const cleanLastPart = lastPart.split('?')[0]
    const lastPartWithoutExt = cleanLastPart.split('.')[0]

    const publicIdWithoutExt = [...publicIdParts.slice(0, -1), lastPartWithoutExt].join('/')

    return publicIdWithoutExt
  } catch (error) {
    console.error('Error parsing Cloudinary URL:', url, error)
    return null
  }
}

const getSignedUrl = (publicId, options = {}) => {
  if (!publicId) {
    console.error('getSignedUrl: No publicId provided')
    return null
  }

  let normalizedPublicId = publicId
  if (typeof publicId !== 'string') {
    normalizedPublicId = String(publicId)
  }

  try {
    if (!cloudinary.config().cloud_name) {
      console.error('getSignedUrl: Cloudinary not properly configured')
      return null
    }

    const baseConfig = {
      type: 'private',
      sign_url: true,
      secure: true, // Force HTTPS URLs
      expires_at: Math.round(Date.now() / 1000) + (options.expiresIn || 3600),
      ...options
    }

    if (options.resource_type !== 'raw') {
      baseConfig.transformation = [
        { width: 400, height: 400, crop: 'fill', quality: 'auto' },
        { fetch_format: 'auto' }
      ]
    }

    const url = cloudinary.url(normalizedPublicId, baseConfig)

    return url
  } catch (error) {
    console.error('Error generating signed URL:', error)
    return null
  }
}

const getSignedDocumentUrl = (publicId, options = {}) => {
  if (!publicId) {
    console.error('getSignedDocumentUrl: No publicId provided')
    return null
  }

  return getSignedUrl(publicId, {
    resource_type: 'raw',
    ...options
  })
}

const getSignedDocumentUrlWithType = (publicId, fileName, options = {}) => {
  if (!publicId) {
    console.error('getSignedDocumentUrlWithType: No publicId provided')
    return null
  }

  let normalizedFileName = fileName
  if (fileName && typeof fileName !== 'string') {
    normalizedFileName = String(fileName)
  }

  const isImage = normalizedFileName && /\.(jpg|jpeg|png|gif|webp)$/i.test(normalizedFileName)

  return getSignedUrl(publicId, {
    resource_type: isImage ? 'image' : 'raw',
    ...options
  })
}

const getSignedPDFViewUrl = (publicId, options = {}) => {
  return getSignedUrl(publicId, {
    resource_type: 'raw',
    disposition: 'inline',
    ...options
  })
}

const getSignedUrlFromStoredUrl = (storedUrl, options = {}) => {
  if (!storedUrl) {
    return null
  }

  let normalizedStoredUrl = storedUrl
  if (typeof storedUrl !== 'string') {
    console.warn('getSignedUrlFromStoredUrl: storedUrl is not a string, converting:', storedUrl)
    normalizedStoredUrl = String(storedUrl)
  }

  const publicId = getPublicIdFromUrl(normalizedStoredUrl)
  if (!publicId) {
    return null
  }

  return getSignedUrl(publicId, options)
}

const getDownloadUrl = (publicId, fileName, options = {}) => {
  if (!publicId) {
    console.error('getDownloadUrl: No publicId provided')
    return null
  }

  try {
    let normalizedFileName = fileName
    if (fileName && typeof fileName !== 'string') {
      normalizedFileName = String(fileName)
    }

    const isImage = normalizedFileName && /\.(jpg|jpeg|png|gif|webp)$/i.test(normalizedFileName)
    let fileExtension = ''
    if (normalizedFileName) {
      const extensionMatch = normalizedFileName.match(/\.([^.]+)$/)
      if (extensionMatch) {
        fileExtension = extensionMatch[1].toLowerCase()
      }
    }

    const downloadOptions = {
      resource_type: isImage ? 'image' : 'raw',
      sign_url: true,
      secure: true,
      type: 'private',
      expires_at: Math.round(Date.now() / 1000) + (options.expiresIn || 3600),
      ...options
    }

    if (normalizedFileName) {
      downloadOptions.attachment = normalizedFileName
    } else {
      downloadOptions.flags = 'attachment'
    }

    if (!isImage && fileExtension) {
      downloadOptions.format = fileExtension
    }

    const url = cloudinary.url(publicId, downloadOptions)

    return url
  } catch (error) {
    console.error('Error generating download URL:', error)
    return null
  }
}


const deleteFileByPublicId = async (publicId, fileName) => {
  if (!publicId) return null

  try {
    const isImage = fileName && /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName)
    const primaryResourceType = isImage ? 'image' : 'raw'
    const existenceChecks = [
      { resource_type: primaryResourceType, type: 'private' },
      { resource_type: primaryResourceType, type: 'upload' },
      { resource_type: primaryResourceType },
      { resource_type: isImage ? 'raw' : 'image', type: 'private' },
      { resource_type: isImage ? 'raw' : 'image', type: 'upload' },
      { resource_type: isImage ? 'raw' : 'image' }
    ]

    let actualParams = null

    for (const check of existenceChecks) {
      try {
        await cloudinary.api.resource(publicId, check)
        actualParams = check
        break
      } catch {
        // Continue to next check
      }
    }

    if (!actualParams) {
      return { result: 'not found' }
    }

    const result = await cloudinary.uploader.destroy(publicId, actualParams)
    return result

  } catch (error) {
    console.error('Error in deleteFileByPublicId:', error)
    throw error
  }
}

const validateFileUrl = async (fileUrl, fileName = null) => {
  if (!fileUrl) {
    return { isValid: false, error: 'No URL provided' }
  }

  if (fileUrl === 'FILE_MISSING_REQUIRES_REUPLOAD') {
    return { isValid: false, error: 'File missing from backup - requires re-upload', suggestion: 'Re-upload the original file after import' }
  }


  if (!fileUrl.includes('cloudinary.com')) {
    return { isValid: true, isExternal: true, message: 'External URL - validation skipped' }
  }

  try {
    const publicId = getPublicIdFromUrl(fileUrl)
    if (!publicId) {
      return { isValid: false, error: 'Could not extract public ID from Cloudinary URL' }
    }

    const isImage = fileName && /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName)
    const primaryResourceType = isImage ? 'image' : 'raw'
    const existenceChecks = [
      { resource_type: primaryResourceType, type: 'private' },
      { resource_type: primaryResourceType, type: 'upload' },
      { resource_type: primaryResourceType },
      { resource_type: isImage ? 'raw' : 'image', type: 'private' },
      { resource_type: isImage ? 'raw' : 'image', type: 'upload' },
      { resource_type: isImage ? 'raw' : 'image' }
    ]

    for (const check of existenceChecks) {
      try {
        const resource = await cloudinary.api.resource(publicId, check)
        return {
          isValid: true,
          isExternal: false,
          resource: {
            publicId: resource.public_id,
            resourceType: resource.resource_type,
            type: resource.type,
            format: resource.format,
            bytes: resource.bytes,
            createdAt: resource.created_at
          }
        }
      } catch {
        // Continue to next check
        continue
      }
    }

    return {
      isValid: false,
      error: 'File not found on Cloudinary',
      suggestion: 'File may have been deleted or moved. Please re-upload the file.'
    }

  } catch (error) {
    return {
      isValid: false,
      error: `Error validating file: ${error.message}`,
      suggestion: 'Please check the file URL and re-upload if necessary.'
    }
  }
}

module.exports = {
  cloudinary,
  uploadProfilePicture,
  uploadPortfolio,
  uploadDocument,
  uploadInvoice,
  deleteFileByUrl,
  deleteFileByPublicId,
  getPublicIdFromUrl,
  getSignedUrl,
  getSignedDocumentUrl,
  getSignedDocumentUrlWithType,
  getSignedPDFViewUrl,
  getSignedUrlFromStoredUrl,
  getDownloadUrl,
  validateFileUrl
}