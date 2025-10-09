const gaDocumentsRouter = require('express').Router()
const GADocument = require('../models/gaDocument')
const { userExtractor } = require('../utils/middleware')
const {
  uploadGADocument,
  deleteFileByUrl,
  deleteFileByPublicId,
  getPublicIdFromUrl,
  getSignedDocumentUrlWithType,
  getDownloadUrl
} = require('../utils/cloudinary')

// Get all GA document sections (accessible to GA members and admins)
gaDocumentsRouter.get('/', userExtractor, async (request, response) => {
  try {
    if (request.user.role !== 'admin' && !request.user.isGAMember) {
      return response.status(403).json({ error: 'Access denied. GA member or admin required.' })
    }

    const documents = await GADocument.find({})
      .populate('createdBy', 'username name')
      .populate('documents.uploadedBy', 'username name')
      .populate('documents.userUploads.uploadedBy', 'username name')
      .sort({ order: 1, createdAt: 1 })

    response.json(documents)
  } catch {
    response.status(500).json({ error: 'Failed to fetch GA documents' })
  }
})

// Create new GA document section (admin only)
gaDocumentsRouter.post('/', userExtractor, async (request, response) => {
  try {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Access denied. Admin required.' })
    }

    const { title, description } = request.body

    if (!title) {
      return response.status(400).json({ error: 'Title is required' })
    }

    const document = new GADocument({
      title,
      description,
      documents: [],
      createdBy: request.user._id,
      order: await getNextOrder()
    })

    const savedDocument = await document.save()
    await savedDocument.populate('createdBy', 'username name')

    response.status(201).json(savedDocument)
  } catch {
    response.status(500).json({ error: 'Failed to create GA document section' })
  }
})

// Update GA document section (admin only)
gaDocumentsRouter.put('/:id', userExtractor, async (request, response) => {
  try {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Access denied. Admin required.' })
    }

    const { title, description } = request.body

    if (!title) {
      return response.status(400).json({ error: 'Title is required' })
    }

    const document = await GADocument.findByIdAndUpdate(
      request.params.id,
      { title, description },
      { new: true, runValidators: true }
    ).populate('createdBy', 'username name')
      .populate('documents.uploadedBy', 'username name')
      .populate('documents.userUploads.uploadedBy', 'username name')

    if (!document) {
      return response.status(404).json({ error: 'GA document section not found' })
    }

    response.json(document)
  } catch {
    response.status(500).json({ error: 'Failed to update GA document section' })
  }
})

// Delete GA document section (admin only)
gaDocumentsRouter.delete('/:id', userExtractor, async (request, response) => {
  try {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Access denied. Admin required.' })
    }

    const document = await GADocument.findById(request.params.id)
    if (!document) {
      return response.status(404).json({ error: 'GA document section not found' })
    }

    // Delete all files associated with this section
    for (const doc of document.documents) {
      // Delete admin files
      if (doc.fileUrl && !doc.documentUrl) {
        try {
          await deleteFileByUrl(doc.fileUrl, doc.fileName)
        } catch {
          // Ignore file deletion errors
        }
      }
      // Delete user uploaded files
      if (doc.userUploads && doc.userUploads.length > 0) {
        for (const userUpload of doc.userUploads) {
          if (userUpload.fileUrl) {
            try {
              if (userUpload.cloudinaryPublicId) {
                await deleteFileByPublicId(userUpload.cloudinaryPublicId, userUpload.fileName)
              } else {
                await deleteFileByUrl(userUpload.fileUrl, userUpload.fileName)
              }
            } catch {
              // Ignore file deletion errors
            }
          }
        }
      }
    }

    await GADocument.findByIdAndDelete(request.params.id)
    response.status(204).end()
  } catch {
    response.status(500).json({ error: 'Failed to delete GA document section' })
  }
})

// Add file document (admin only)
gaDocumentsRouter.post('/:id/files', userExtractor, uploadGADocument.single('document'), async (request, response) => {
  try {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Access denied. Admin required.' })
    }

    if (!request.file) {
      return response.status(400).json({ error: 'No file uploaded' })
    }

    const { name } = request.body
    if (!name) {
      return response.status(400).json({ error: 'Document name is required' })
    }

    const document = await GADocument.findById(request.params.id)
    if (!document) {
      return response.status(404).json({ error: 'GA document section not found' })
    }

    const newDocument = {
      name,
      fileName: request.file.originalname,
      fileUrl: request.file.path,
      fileType: request.file.mimetype,
      contentType: 'file',
      uploadedBy: request.user._id,
      cloudinaryPublicId: request.file.filename
    }

    document.documents.push(newDocument)
    await document.save()

    const updatedDocument = await GADocument.findById(request.params.id)
      .populate('createdBy', 'username name')
      .populate('documents.uploadedBy', 'username name')
      .populate('documents.userUploads.uploadedBy', 'username name')

    response.json(updatedDocument)
  } catch {
    response.status(500).json({ error: 'Failed to add document' })
  }
})

// Add URL document (admin only)
gaDocumentsRouter.post('/:id/urls', userExtractor, async (request, response) => {
  try {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Access denied. Admin required.' })
    }

    const { name, url } = request.body
    if (!name || !url) {
      return response.status(400).json({ error: 'Document name and URL are required' })
    }

    try {
      new URL(url)
    } catch {
      return response.status(400).json({ error: 'Invalid URL format' })
    }

    const document = await GADocument.findById(request.params.id)
    if (!document) {
      return response.status(404).json({ error: 'GA document section not found' })
    }

    const newDocument = {
      name,
      documentUrl: url,
      contentType: 'file',
      uploadedBy: request.user._id
    }

    document.documents.push(newDocument)
    await document.save()

    const updatedDocument = await GADocument.findById(request.params.id)
      .populate('createdBy', 'username name')
      .populate('documents.uploadedBy', 'username name')
      .populate('documents.userUploads.uploadedBy', 'username name')

    response.json(updatedDocument)
  } catch {
    response.status(500).json({ error: 'Failed to add URL document' })
  }
})

// Add text content (admin only)
gaDocumentsRouter.post('/:id/text', userExtractor, async (request, response) => {
  try {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Access denied. Admin required.' })
    }

    const { name, textContent } = request.body
    if (!name || !textContent) {
      return response.status(400).json({ error: 'Name and text content are required' })
    }

    const document = await GADocument.findById(request.params.id)
    if (!document) {
      return response.status(404).json({ error: 'GA document section not found' })
    }

    const newDocument = {
      name,
      textContent,
      contentType: 'text',
      uploadedBy: request.user._id
    }

    document.documents.push(newDocument)
    await document.save()

    const updatedDocument = await GADocument.findById(request.params.id)
      .populate('createdBy', 'username name')
      .populate('documents.uploadedBy', 'username name')
      .populate('documents.userUploads.uploadedBy', 'username name')

    response.json(updatedDocument)
  } catch {
    response.status(500).json({ error: 'Failed to add text content' })
  }
})

// Add user upload area (admin only)
gaDocumentsRouter.post('/:id/upload-area', userExtractor, async (request, response) => {
  try {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Access denied. Admin required.' })
    }

    const { name, description } = request.body
    if (!name) {
      return response.status(400).json({ error: 'Upload area name is required' })
    }

    const document = await GADocument.findById(request.params.id)
    if (!document) {
      return response.status(404).json({ error: 'GA document section not found' })
    }

    const newDocument = {
      name,
      textContent: description || '',
      contentType: 'upload_area',
      allowUserUploads: true,
      userUploads: [],
      uploadedBy: request.user._id
    }

    document.documents.push(newDocument)
    await document.save()

    const updatedDocument = await GADocument.findById(request.params.id)
      .populate('createdBy', 'username name')
      .populate('documents.uploadedBy', 'username name')
      .populate('documents.userUploads.uploadedBy', 'username name')

    response.json(updatedDocument)
  } catch {
    response.status(500).json({ error: 'Failed to add upload area' })
  }
})

// User upload to upload area (GA members only)
gaDocumentsRouter.post('/:id/documents/:docId/user-upload', userExtractor, uploadGADocument.single('document'), async (request, response) => {
  try {
    if (!request.user.isGAMember && request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Access denied. GA member required.' })
    }

    if (!request.file) {
      return response.status(400).json({ error: 'No file uploaded' })
    }

    const { userDescription } = request.body

    const document = await GADocument.findById(request.params.id)
    if (!document) {
      return response.status(404).json({ error: 'GA document section not found' })
    }

    const docItem = document.documents.id(request.params.docId)
    if (!docItem) {
      return response.status(404).json({ error: 'Document not found' })
    }

    if (docItem.contentType !== 'upload_area' || !docItem.allowUserUploads) {
      return response.status(400).json({ error: 'This document does not allow user uploads' })
    }

    const userUpload = {
      fileName: request.file.originalname,
      fileUrl: request.file.path,
      fileType: request.file.mimetype,
      cloudinaryPublicId: request.file.filename,
      uploadedBy: request.user._id,
      userDescription: userDescription || ''
    }

    docItem.userUploads.push(userUpload)
    await document.save()

    const updatedDocument = await GADocument.findById(request.params.id)
      .populate('createdBy', 'username name')
      .populate('documents.uploadedBy', 'username name')
      .populate('documents.userUploads.uploadedBy', 'username name')

    response.json(updatedDocument)
  } catch {
    response.status(500).json({ error: 'Failed to upload file' })
  }
})

// Delete document (admin only)
gaDocumentsRouter.delete('/:id/documents/:docId', userExtractor, async (request, response) => {
  try {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Access denied. Admin required.' })
    }

    const document = await GADocument.findById(request.params.id)
    if (!document) {
      return response.status(404).json({ error: 'GA document section not found' })
    }

    const docItem = document.documents.id(request.params.docId)
    if (!docItem) {
      return response.status(404).json({ error: 'Document not found' })
    }

    // Delete associated files
    if (docItem.fileUrl && !docItem.documentUrl) {
      try {
        if (docItem.cloudinaryPublicId) {
          await deleteFileByPublicId(docItem.cloudinaryPublicId, docItem.fileName)
        } else {
          await deleteFileByUrl(docItem.fileUrl, docItem.fileName)
        }
      } catch {
        // Ignore file deletion errors
      }
    }

    // Delete user uploaded files if it's an upload area
    if (docItem.userUploads && docItem.userUploads.length > 0) {
      for (const userUpload of docItem.userUploads) {
        if (userUpload.fileUrl) {
          try {
            if (userUpload.cloudinaryPublicId) {
              await deleteFileByPublicId(userUpload.cloudinaryPublicId, userUpload.fileName)
            } else {
              await deleteFileByUrl(userUpload.fileUrl, userUpload.fileName)
            }
          } catch {
            // Ignore file deletion errors
          }
        }
      }
    }

    document.documents.pull(request.params.docId)
    await document.save()

    const updatedDocument = await GADocument.findById(request.params.id)
      .populate('createdBy', 'username name')
      .populate('documents.uploadedBy', 'username name')
      .populate('documents.userUploads.uploadedBy', 'username name')

    response.json(updatedDocument)
  } catch {
    response.status(500).json({ error: 'Failed to remove document' })
  }
})

// Delete user upload (admin or the user who uploaded it)
gaDocumentsRouter.delete('/:id/documents/:docId/user-uploads/:uploadId', userExtractor, async (request, response) => {
  try {
    const document = await GADocument.findById(request.params.id)
    if (!document) {
      return response.status(404).json({ error: 'GA document section not found' })
    }

    const docItem = document.documents.id(request.params.docId)
    if (!docItem) {
      return response.status(404).json({ error: 'Document not found' })
    }

    const userUpload = docItem.userUploads.id(request.params.uploadId)
    if (!userUpload) {
      return response.status(404).json({ error: 'User upload not found' })
    }

    // Check if user can delete this upload (admin or the uploader)
    if (request.user.role !== 'admin' && userUpload.uploadedBy.toString() !== request.user._id.toString()) {
      return response.status(403).json({ error: 'Access denied. You can only delete your own uploads.' })
    }

    // Delete the file from storage
    if (userUpload.fileUrl) {
      try {
        if (userUpload.cloudinaryPublicId) {
          await deleteFileByPublicId(userUpload.cloudinaryPublicId, userUpload.fileName)
        } else {
          await deleteFileByUrl(userUpload.fileUrl, userUpload.fileName)
        }
      } catch {
        // Ignore file deletion errors
      }
    }

    docItem.userUploads.pull(request.params.uploadId)
    await document.save()

    const updatedDocument = await GADocument.findById(request.params.id)
      .populate('createdBy', 'username name')
      .populate('documents.uploadedBy', 'username name')
      .populate('documents.userUploads.uploadedBy', 'username name')

    response.json(updatedDocument)
  } catch {
    response.status(500).json({ error: 'Failed to remove user upload' })
  }
})

// Get file URL (for downloads)
gaDocumentsRouter.get('/:id/documents/:docId/url', userExtractor, async (request, response) => {
  try {
    if (request.user.role !== 'admin' && !request.user.isGAMember) {
      return response.status(403).json({ error: 'Access denied. GA member or admin required.' })
    }

    const document = await GADocument.findById(request.params.id)
    if (!document) {
      return response.status(404).json({ error: 'GA document section not found' })
    }

    const docItem = document.documents.id(request.params.docId)
    if (!docItem) {
      return response.status(404).json({ error: 'Document not found' })
    }

    if (docItem.contentType === 'text' || docItem.contentType === 'upload_area') {
      return response.status(400).json({ error: 'This document type does not have a file URL' })
    }

    const publicId = getPublicIdFromUrl(docItem.fileUrl)

    if (!publicId) {
      if (!docItem.fileUrl) {
        return response.status(404).json({
          error: 'File URL missing - document may need to be re-uploaded'
        })
      }
      return response.json({ url: docItem.fileUrl })
    }

    let downloadUrl = getDownloadUrl(publicId, docItem.fileName, {
      expiresIn: 3600
    })

    if (!downloadUrl) {
      downloadUrl = getSignedDocumentUrlWithType(publicId, docItem.fileName, {
        expiresIn: 3600
      })
    }

    if (!downloadUrl) {
      return response.status(500).json({ error: 'Failed to generate secure URL' })
    }

    response.json({ url: downloadUrl })
  } catch {
    response.status(500).json({ error: 'Failed to get document URL' })
  }
})

// Get user upload file URL
gaDocumentsRouter.get('/:id/documents/:docId/user-uploads/:uploadId/url', userExtractor, async (request, response) => {
  try {
    if (request.user.role !== 'admin' && !request.user.isGAMember) {
      return response.status(403).json({ error: 'Access denied. GA member or admin required.' })
    }

    const document = await GADocument.findById(request.params.id)
    if (!document) {
      return response.status(404).json({ error: 'GA document section not found' })
    }

    const docItem = document.documents.id(request.params.docId)
    if (!docItem) {
      return response.status(404).json({ error: 'Document not found' })
    }

    const userUpload = docItem.userUploads.id(request.params.uploadId)
    if (!userUpload) {
      return response.status(404).json({ error: 'User upload not found' })
    }

    const publicId = getPublicIdFromUrl(userUpload.fileUrl)

    if (!publicId) {
      if (!userUpload.fileUrl) {
        return response.status(404).json({
          error: 'File URL missing - document may need to be re-uploaded'
        })
      }
      return response.json({ url: userUpload.fileUrl })
    }

    let downloadUrl = getDownloadUrl(publicId, userUpload.fileName, {
      expiresIn: 3600
    })

    if (!downloadUrl) {
      downloadUrl = getSignedDocumentUrlWithType(publicId, userUpload.fileName, {
        expiresIn: 3600
      })
    }

    if (!downloadUrl) {
      return response.status(500).json({ error: 'Failed to generate secure URL' })
    }

    response.json({ url: downloadUrl })
  } catch {
    response.status(500).json({ error: 'Failed to get user upload URL' })
  }
})

async function getNextOrder() {
  const lastDocument = await GADocument.findOne().sort({ order: -1 })
  return lastDocument ? lastDocument.order + 1 : 0
}

module.exports = gaDocumentsRouter