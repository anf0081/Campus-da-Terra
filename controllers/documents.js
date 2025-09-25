const documentsRouter = require('express').Router()
const Document = require('../models/document')
const { userExtractor } = require('../utils/middleware')
const {
  uploadDocument,
  deleteFileByUrl,
  deleteFileByPublicId,
  getPublicIdFromUrl,
  getSignedDocumentUrlWithType,
  getDownloadUrl
} = require('../utils/cloudinary')
const { exportDocuments } = require('../utils/dataExport')

documentsRouter.get('/', userExtractor, async (request, response) => {
  try {
    const documents = await Document.find({})
      .populate('createdBy', 'username name')
      .populate('documents.uploadedBy', 'username name')
      .sort({ order: 1, createdAt: 1 })

    response.json(documents)
  } catch {
    response.status(500).json({ error: 'Failed to fetch documents' })
  }
})

documentsRouter.post('/', userExtractor, async (request, response) => {
  try {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Access denied. Admin required.' })
    }

    const { title, description } = request.body

    if (!title) {
      return response.status(400).json({ error: 'Title is required' })
    }

    const document = new Document({
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
    response.status(500).json({ error: 'Failed to create document section' })
  }
})

documentsRouter.put('/:id', userExtractor, async (request, response) => {
  try {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Access denied. Admin required.' })
    }

    const { title, description } = request.body

    if (!title) {
      return response.status(400).json({ error: 'Title is required' })
    }

    const document = await Document.findByIdAndUpdate(
      request.params.id,
      { title, description },
      { new: true, runValidators: true }
    ).populate('createdBy', 'username name')
      .populate('documents.uploadedBy', 'username name')

    if (!document) {
      return response.status(404).json({ error: 'Document section not found' })
    }

    response.json(document)
  } catch {
    response.status(500).json({ error: 'Failed to update document section' })
  }
})

documentsRouter.delete('/:id', userExtractor, async (request, response) => {
  try {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Access denied. Admin required.' })
    }

    const document = await Document.findById(request.params.id)
    if (!document) {
      return response.status(404).json({ error: 'Document section not found' })
    }

    for (const doc of document.documents) {
      if (doc.fileUrl && !doc.documentUrl) {
        try {
          await deleteFileByUrl(doc.fileUrl, doc.fileName)
        } catch {
          // Ignore file deletion errors
        }
      }
    }

    await Document.findByIdAndDelete(request.params.id)
    response.status(204).end()
  } catch {
    response.status(500).json({ error: 'Failed to delete document section' })
  }
})

documentsRouter.post('/:id/files', userExtractor, uploadDocument.single('document'), async (request, response) => {
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

    const document = await Document.findById(request.params.id)
    if (!document) {
      return response.status(404).json({ error: 'Document section not found' })
    }


    const newDocument = {
      name,
      fileName: request.file.originalname,
      fileUrl: request.file.path,
      fileType: request.file.mimetype,
      uploadedBy: request.user._id,
      cloudinaryPublicId: request.file.filename
    }

    document.documents.push(newDocument)
    await document.save()

    const updatedDocument = await Document.findById(request.params.id)
      .populate('createdBy', 'username name')
      .populate('documents.uploadedBy', 'username name')

    response.json(updatedDocument)
  } catch {
    response.status(500).json({ error: 'Failed to add document' })
  }
})

documentsRouter.post('/:id/urls', userExtractor, async (request, response) => {
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

    const document = await Document.findById(request.params.id)
    if (!document) {
      return response.status(404).json({ error: 'Document section not found' })
    }

    const newDocument = {
      name,
      documentUrl: url,
      uploadedBy: request.user._id
    }

    document.documents.push(newDocument)
    await document.save()

    const updatedDocument = await Document.findById(request.params.id)
      .populate('createdBy', 'username name')
      .populate('documents.uploadedBy', 'username name')

    response.json(updatedDocument)
  } catch {
    response.status(500).json({ error: 'Failed to add URL document' })
  }
})

documentsRouter.delete('/:id/files/:fileId', userExtractor, async (request, response) => {
  try {
    if (request.user.role !== 'admin') {
      return response.status(403).json({ error: 'Access denied. Admin required.' })
    }

    const document = await Document.findById(request.params.id)
    if (!document) {
      return response.status(404).json({ error: 'Document section not found' })
    }

    const fileIndex = document.documents.findIndex(doc => doc._id.toString() === request.params.fileId)
    if (fileIndex === -1) {
      return response.status(404).json({ error: 'Document not found' })
    }

    const fileToDelete = document.documents[fileIndex]

    if (fileToDelete.fileUrl && !fileToDelete.documentUrl) {
      try {
        if (fileToDelete.cloudinaryPublicId) {
          await deleteFileByPublicId(fileToDelete.cloudinaryPublicId, fileToDelete.fileName)
        } else {
          await deleteFileByUrl(fileToDelete.fileUrl, fileToDelete.fileName)
        }
      } catch {
        // Ignore file deletion errors
      }
    }

    document.documents.splice(fileIndex, 1)
    await document.save()

    const updatedDocument = await Document.findById(request.params.id)
      .populate('createdBy', 'username name')
      .populate('documents.uploadedBy', 'username name')

    response.json(updatedDocument)
  } catch {
    response.status(500).json({ error: 'Failed to remove document' })
  }
})

documentsRouter.get('/:id/files/:fileId/url', userExtractor, async (request, response) => {
  try {
    const document = await Document.findById(request.params.id)
    if (!document) {
      return response.status(404).json({ error: 'Document section not found' })
    }

    const file = document.documents.find(doc => doc._id.toString() === request.params.fileId)
    if (!file) {
      return response.status(404).json({ error: 'Document not found' })
    }

    const publicId = getPublicIdFromUrl(file.fileUrl)

    if (!publicId) {
      if (!file.fileUrl) {
        return response.status(404).json({
          error: 'File URL missing - document may need to be re-uploaded',
          suggestion: 'This document appears to be corrupted after database restore. Please re-upload the file.'
        })
      }
      return response.json({ url: file.fileUrl })
    }

    let downloadUrl = getDownloadUrl(publicId, file.fileName, {
      expiresIn: 3600
    })

    if (!downloadUrl) {
      downloadUrl = getSignedDocumentUrlWithType(publicId, file.fileName, {
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

documentsRouter.get('/export', userExtractor, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Permission denied - admin access required' })
    }

    const exportData = await exportDocuments()

    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `documents-export-${timestamp}.json`

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

    res.json(exportData)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

documentsRouter.post('/import', userExtractor, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Permission denied - admin access required' })
    }

    const { documents, duplicateHandling = 'skip' } = req.body
    const documentsToImport = Array.isArray(documents) ? documents : [documents]
    const results = {
      success: [],
      errors: [],
      duplicates: []
    }

    for (const documentData of documentsToImport) {
      try {
        const cleanData = { ...documentData }
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

        const existingDocument = await Document.findOne({
          title: cleanData.title
        })

        if (existingDocument) {
          if (duplicateHandling === 'skip') {
            results.duplicates.push({
              title: cleanData.title,
              message: 'Skipped - duplicate section found'
            })
            continue
          }
          results.duplicates.push({
            title: cleanData.title,
            message: 'Duplicate section found but no merge strategy for document sections'
          })
          continue
        }

        cleanData.order = await getNextOrder()

        if (cleanData.documents) {
          cleanData.documents = cleanData.documents.map(doc => {
            const cleanDoc = { ...doc }
            delete cleanDoc._fileNote
            if (cleanDoc.id) {
              delete cleanDoc.id
            }
            if (cleanDoc._id) {
              delete cleanDoc._id
            }
            return cleanDoc
          })
        }

        const document = new Document(cleanData)
        const savedDocument = await document.save()

        results.success.push({
          title: savedDocument.title,
          id: savedDocument._id
        })
      } catch (error) {
        results.errors.push({
          title: documentData.title || 'Unknown',
          error: error.message
        })
      }
    }

    let message = `Documents import completed: ${results.success.length} sections created`
    if (results.duplicates.length > 0) {
      message += `, ${results.duplicates.length} skipped`
    }

    res.status(200).json({
      message,
      results,
      summary: {
        total: documentsToImport.length,
        created: results.success.length,
        skipped: results.duplicates.length,
        errors: results.errors.length
      }
    })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

async function getNextOrder() {
  const lastDocument = await Document.findOne().sort({ order: -1 })
  return lastDocument ? lastDocument.order + 1 : 0
}

module.exports = documentsRouter