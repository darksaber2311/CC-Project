import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { documentService } from '../services/documentService.js';
import { config } from '../config.js';

export const documentRouter = Router();

// Multer memory storage configuration for file upload stream validation
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.maxFileSizeBytes
  }
});

// All document routes require authentication
documentRouter.use(requireAuth);

// POST /api/documents/upload
documentRouter.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No document file was uploaded' });
    }

    const { sensitivityLevel, description } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const doc = await documentService.uploadDocument({
      originalFilename: req.file.originalname,
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      ownerId: req.user.id,
      ownerUsername: req.user.username,
      sensitivityLevel: sensitivityLevel || 'internal',
      description,
      ipAddress,
      userAgent
    });

    res.status(201).json({
      success: true,
      message: 'Document successfully registered and stored',
      document: doc
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/documents - List documents accessible to user
documentRouter.get('/', (req, res, next) => {
  try {
    const { sensitivity, search, limit, offset } = req.query;
    const docs = documentService.listDocuments({
      user: req.user,
      sensitivity: sensitivity || null,
      search: search || '',
      limit: parseInt(limit || '50', 10),
      offset: parseInt(offset || '0', 10)
    });

    res.json({ documents: docs });
  } catch (err) {
    next(err);
  }
});

// GET /api/documents/:id - Get document details
documentRouter.get('/:id', (req, res, next) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const data = documentService.getDocumentDetails({
      id: req.params.id,
      user: req.user,
      ipAddress,
      userAgent,
      recordView: true
    });

    res.json(data);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// GET /api/documents/:id/download - Authorized file download
documentRouter.get('/:id/download', (req, res, next) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const { filePath, originalFilename, mimeType } = documentService.getDownloadFilePath({
      id: req.params.id,
      user: req.user,
      ipAddress,
      userAgent
    });

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(originalFilename)}"`);
    res.sendFile(filePath);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// DELETE /api/documents/:id - Delete document
documentRouter.delete('/:id', (req, res, next) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    documentService.deleteDocument({
      id: req.params.id,
      user: req.user,
      ipAddress,
      userAgent
    });

    res.json({ success: true, message: 'Document marked as deleted' });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// POST /api/documents/:id/permissions - Grant permission
documentRouter.post('/:id/permissions', (req, res, next) => {
  try {
    const { targetUserId, permissionType } = req.body;
    if (!targetUserId || !permissionType) {
      return res.status(400).json({ error: 'Target user ID and permission type are required' });
    }

    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = documentService.grantPermission({
      documentId: req.params.id,
      granterUser: req.user,
      targetUserId,
      permissionType,
      ipAddress,
      userAgent
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/documents/:id/permissions/:permissionId - Revoke permission
documentRouter.delete('/:id/permissions/:permissionId', (req, res, next) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = documentService.revokePermission({
      documentId: req.params.id,
      granterUser: req.user,
      permissionId: req.params.permissionId,
      ipAddress,
      userAgent
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/documents/:id/audit - Document-specific audit trail
documentRouter.get('/:id/audit', (req, res, next) => {
  try {
    // Check view permission first
    documentService.getDocumentDetails({
      id: req.params.id,
      user: req.user,
      recordView: false
    });

    const logs = documentService.getDocumentAuditLogs(req.params.id);
    res.json({ logs });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});
