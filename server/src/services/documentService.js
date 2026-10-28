import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { db, execute, query, queryOne, transaction } from '../db.js';
import { config } from '../config.js';
import { validateFilename, validateFileSignature, isAllowedMimeType } from '../utils/fileValidator.js';
import { auditService } from './auditService.js';
import { detectionEngine } from './detectionEngine.js';

export const documentService = {
  /**
   * Upload and register a new document.
   */
  async uploadDocument({
    originalFilename,
    buffer,
    mimeType,
    ownerId,
    ownerUsername,
    sensitivityLevel = 'internal',
    description = '',
    ipAddress = null,
    userAgent = null
  }) {
    if (!buffer || buffer.length === 0) {
      throw new Error('Empty file payload received');
    }

    if (buffer.length > config.maxFileSizeBytes) {
      throw new Error(`File size exceeds maximum allowable limit (${config.maxFileSizeBytes / (1024 * 1024)}MB)`);
    }

    const { sanitizedName, extension } = validateFilename(originalFilename);

    if (!isAllowedMimeType(mimeType)) {
      throw new Error(`MIME type '${mimeType}' is not supported`);
    }

    // Verify magic bytes signature
    const isValidSignature = validateFileSignature(buffer, extension);
    if (!isValidSignature) {
      throw new Error(`File content signature does not match declared extension '${extension}'`);
    }

    const validSensitivities = ['public', 'internal', 'confidential'];
    const normalizedSensitivity = sensitivityLevel.toLowerCase();
    if (!validSensitivities.includes(normalizedSensitivity)) {
      throw new Error(`Invalid sensitivity level. Allowed: ${validSensitivities.join(', ')}`);
    }

    const documentId = crypto.randomUUID();
    const storedFilename = `${documentId}${extension}`;
    const destinationPath = path.join(config.storagePath, storedFilename);

    // Write file to private storage outside web root
    fs.writeFileSync(destinationPath, buffer);

    execute(`
      INSERT INTO documents (
        id, original_filename, stored_filename, owner_id, file_size, 
        mime_type, file_extension, sensitivity_level, description, storage_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, documentId, sanitizedName, storedFilename, ownerId, buffer.length, mimeType, extension, normalizedSensitivity, (description || '').trim(), storedFilename);

    // Log upload in audit trail
    auditService.logEvent({
      actorId: ownerId,
      actorUsername: ownerUsername,
      action: 'DOCUMENT_UPLOAD',
      targetType: 'document',
      targetId: documentId,
      outcome: 'success',
      ipAddress,
      userAgent,
      details: {
        filename: sanitizedName,
        size: buffer.length,
        sensitivity: normalizedSensitivity
      }
    });

    return queryOne('SELECT * FROM documents WHERE id = ?', documentId);
  },

  /**
   * List documents accessible to the requesting user.
   */
  listDocuments({ user, sensitivity = null, search = '', limit = 50, offset = 0 }) {
    const isAdmin = user.role === 'admin';
    let sql;
    const params = [];

    if (isAdmin) {
      // Admin sees metadata of all active documents
      sql = `
        SELECT d.id, d.original_filename, d.owner_id, d.file_size, d.mime_type, 
               d.file_extension, d.sensitivity_level, d.description, d.created_at,
               u.username as owner_username, u.full_name as owner_name,
               1 as can_view_meta,
               (d.owner_id = ?) as is_owner,
               EXISTS(SELECT 1 FROM document_permissions WHERE document_id = d.id AND user_id = ? AND permission_type = 'download') as has_download_grant,
               EXISTS(SELECT 1 FROM document_permissions WHERE document_id = d.id AND user_id = ? AND permission_type = 'view') as has_view_grant
        FROM documents d
        JOIN users u ON d.owner_id = u.id
        WHERE d.is_deleted = 0
      `;
      params.push(user.id, user.id, user.id);
    } else {
      // Standard user sees documents they own, public documents, or explicitly shared documents
      sql = `
        SELECT DISTINCT d.id, d.original_filename, d.owner_id, d.file_size, d.mime_type, 
               d.file_extension, d.sensitivity_level, d.description, d.created_at,
               u.username as owner_username, u.full_name as owner_name,
               1 as can_view_meta,
               (d.owner_id = ?) as is_owner,
               (d.owner_id = ? OR d.sensitivity_level = 'public' OR EXISTS(
                 SELECT 1 FROM document_permissions WHERE document_id = d.id AND user_id = ? AND permission_type = 'download'
               )) as has_download_grant,
               (d.owner_id = ? OR d.sensitivity_level = 'public' OR EXISTS(
                 SELECT 1 FROM document_permissions WHERE document_id = d.id AND user_id = ? AND permission_type = 'view'
               )) as has_view_grant
        FROM documents d
        JOIN users u ON d.owner_id = u.id
        LEFT JOIN document_permissions dp ON d.id = dp.document_id AND dp.user_id = ?
        WHERE d.is_deleted = 0 
          AND (d.owner_id = ? OR d.sensitivity_level = 'public' OR dp.id IS NOT NULL)
      `;
      params.push(user.id, user.id, user.id, user.id, user.id, user.id, user.id);
    }

    if (sensitivity) {
      sql += ' AND d.sensitivity_level = ?';
      params.push(sensitivity);
    }

    if (search) {
      sql += ' AND (d.original_filename LIKE ? OR d.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY d.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return query(sql, ...params);
  },

  /**
   * Retrieves single document metadata with RBAC verification.
   */
  getDocumentDetails({ id, user, ipAddress, userAgent, recordView = true }) {
    const doc = queryOne(`
      SELECT d.*, u.username as owner_username, u.full_name as owner_name
      FROM documents d
      JOIN users u ON d.owner_id = u.id
      WHERE d.id = ? AND d.is_deleted = 0
    `, id);

    if (!doc) {
      const err = new Error('Document not found or has been removed');
      err.status = 404;
      throw err;
    }

    const isOwner = doc.owner_id === user.id;
    const isPublic = doc.sensitivity_level === 'public';
    const isAdmin = user.role === 'admin';

    // Check explicit permissions
    const permissions = query(`
      SELECT dp.id, dp.user_id, dp.permission_type, dp.granted_at, 
             u.username, u.full_name
      FROM document_permissions dp
      JOIN users u ON dp.user_id = u.id
      WHERE dp.document_id = ?
    `, id);

    const userHasViewGrant = permissions.some(p => p.user_id === user.id && p.permission_type === 'view');
    const userHasDownloadGrant = permissions.some(p => p.user_id === user.id && p.permission_type === 'download');

    // Access evaluation:
    // Can view metadata: Admin, Owner, Public, or Grantee
    const canViewMeta = isAdmin || isOwner || isPublic || userHasViewGrant || userHasDownloadGrant;
    const canViewContent = isOwner || isPublic || userHasViewGrant;
    const canDownload = isOwner || isPublic || userHasDownloadGrant;

    if (!canViewMeta) {
      // UNAUTHORIZED ATTEMPT - Trigger Audit Log & Threat Detection
      const logId = auditService.logEvent({
        actorId: user.id,
        actorUsername: user.username,
        action: 'ACCESS_DENIED',
        targetType: 'document',
        targetId: id,
        outcome: 'denied',
        ipAddress,
        userAgent,
        details: {
          sensitivity: doc.sensitivity_level,
          filename: doc.original_filename,
          reason: 'Insufficient document permission'
        }
      });

      // Threat engine evaluation
      if (doc.sensitivity_level === 'confidential') {
        detectionEngine.checkConfidentialViolation(user.id, user.username, id, logId);
      }
      detectionEngine.checkDeniedAccess(user.id, user.username, id, doc.sensitivity_level, logId);

      const err = new Error('Access denied: You do not have permission to access this document');
      err.status = 403;
      throw err;
    }

    if (recordView) {
      auditService.logEvent({
        actorId: user.id,
        actorUsername: user.username,
        action: 'DOCUMENT_VIEW',
        targetType: 'document',
        targetId: id,
        outcome: 'success',
        ipAddress,
        userAgent,
        details: { sensitivity: doc.sensitivity_level, filename: doc.original_filename }
      });
    }

    return {
      document: doc,
      permissions: {
        isOwner,
        isAdmin,
        canViewContent,
        canDownload,
        sharedPermissions: permissions
      }
    };
  },

  /**
   * Authorizes and serves file download stream.
   */
  getDownloadFilePath({ id, user, ipAddress, userAgent }) {
    const doc = queryOne('SELECT * FROM documents WHERE id = ? AND is_deleted = 0', id);
    if (!doc) {
      const err = new Error('Document not found');
      err.status = 404;
      throw err;
    }

    const isOwner = doc.owner_id === user.id;
    const isPublic = doc.sensitivity_level === 'public';
    const hasDownloadGrant = queryOne(`
      SELECT 1 FROM document_permissions 
      WHERE document_id = ? AND user_id = ? AND permission_type = 'download'
    `, id, user.id);

    // Admin without explicit permission CANNOT download document contents (Privacy Requirement)
    const canDownload = isOwner || isPublic || Boolean(hasDownloadGrant);

    if (!canDownload) {
      const logId = auditService.logEvent({
        actorId: user.id,
        actorUsername: user.username,
        action: 'ACCESS_DENIED',
        targetType: 'document',
        targetId: id,
        outcome: 'denied',
        ipAddress,
        userAgent,
        details: {
          actionAttempted: 'DOWNLOAD',
          sensitivity: doc.sensitivity_level,
          filename: doc.original_filename
        }
      });

      if (doc.sensitivity_level === 'confidential') {
        detectionEngine.checkConfidentialViolation(user.id, user.username, id, logId);
      }
      detectionEngine.checkDeniedAccess(user.id, user.username, id, doc.sensitivity_level, logId);

      const err = new Error('Access denied: You do not have permission to download this document');
      err.status = 403;
      throw err;
    }

    const filePath = path.join(config.storagePath, doc.stored_filename);
    if (!fs.existsSync(filePath)) {
      const err = new Error('Physical file is missing from private storage');
      err.status = 500;
      throw err;
    }

    // Log successful download
    const logId = auditService.logEvent({
      actorId: user.id,
      actorUsername: user.username,
      action: 'DOCUMENT_DOWNLOAD',
      targetType: 'document',
      targetId: id,
      outcome: 'success',
      ipAddress,
      userAgent,
      details: { filename: doc.original_filename, sensitivity: doc.sensitivity_level }
    });

    // Check Rule B (Excessive downloads velocity)
    detectionEngine.checkExcessiveDownloads(user.id, user.username, id, logId);

    return {
      filePath,
      originalFilename: doc.original_filename,
      mimeType: doc.mime_type
    };
  },

  /**
   * Delete a document (Owner or authorized admin).
   */
  deleteDocument({ id, user, ipAddress, userAgent }) {
    const doc = queryOne('SELECT * FROM documents WHERE id = ? AND is_deleted = 0', id);
    if (!doc) {
      const err = new Error('Document not found');
      err.status = 404;
      throw err;
    }

    if (doc.owner_id !== user.id && user.role !== 'admin') {
      auditService.logEvent({
        actorId: user.id,
        actorUsername: user.username,
        action: 'ACCESS_DENIED',
        targetType: 'document',
        targetId: id,
        outcome: 'denied',
        ipAddress,
        userAgent,
        details: { reason: 'Must be document owner to delete' }
      });

      const err = new Error('Permission denied: You can only delete documents you own');
      err.status = 403;
      throw err;
    }

    execute("UPDATE documents SET is_deleted = 1, updated_at = datetime('now', 'utc') WHERE id = ?", id);

    auditService.logEvent({
      actorId: user.id,
      actorUsername: user.username,
      action: 'DOCUMENT_DELETE',
      targetType: 'document',
      targetId: id,
      outcome: 'success',
      ipAddress,
      userAgent,
      details: { filename: doc.original_filename }
    });

    return { success: true };
  },

  /**
   * Grant document access to a user.
   */
  grantPermission({ documentId, granterUser, targetUserId, permissionType, ipAddress, userAgent }) {
    const doc = queryOne('SELECT * FROM documents WHERE id = ? AND is_deleted = 0', documentId);
    if (!doc) throw new Error('Document not found');

    if (doc.owner_id !== granterUser.id && granterUser.role !== 'admin') {
      throw new Error('Only the document owner or an administrator can grant permissions');
    }

    const targetUser = queryOne('SELECT id, username FROM users WHERE id = ? AND is_active = 1', targetUserId);
    if (!targetUser) throw new Error('Target user does not exist or is suspended');

    if (targetUser.id === doc.owner_id) {
      throw new Error('The owner already has complete document access');
    }

    const permId = crypto.randomUUID();
    execute(`
      INSERT OR REPLACE INTO document_permissions (id, document_id, user_id, permission_type, granted_by)
      VALUES (?, ?, ?, ?, ?)
    `, permId, documentId, targetUserId, permissionType, granterUser.id);

    auditService.logEvent({
      actorId: granterUser.id,
      actorUsername: granterUser.username,
      action: 'PERMISSION_GRANT',
      targetType: 'document',
      targetId: documentId,
      outcome: 'success',
      ipAddress,
      userAgent,
      details: {
        granteeId: targetUserId,
        granteeUsername: targetUser.username,
        permissionType,
        document: doc.original_filename
      }
    });

    return { success: true, permissionId: permId };
  },

  /**
   * Revoke permission from a user.
   */
  revokePermission({ documentId, granterUser, permissionId, ipAddress, userAgent }) {
    const perm = queryOne('SELECT * FROM document_permissions WHERE id = ? AND document_id = ?', permissionId, documentId);
    if (!perm) throw new Error('Permission record not found');

    const doc = queryOne('SELECT * FROM documents WHERE id = ?', documentId);
    if (doc.owner_id !== granterUser.id && granterUser.role !== 'admin') {
      throw new Error('Only the document owner or an administrator can revoke permissions');
    }

    execute('DELETE FROM document_permissions WHERE id = ?', permissionId);

    auditService.logEvent({
      actorId: granterUser.id,
      actorUsername: granterUser.username,
      action: 'PERMISSION_REVOKE',
      targetType: 'document',
      targetId: documentId,
      outcome: 'success',
      ipAddress,
      userAgent,
      details: {
        revokedPermissionId: permissionId,
        revokedUserId: perm.user_id,
        permissionType: perm.permission_type
      }
    });

    return { success: true };
  },

  /**
   * Get audit log history for a specific document.
   */
  getDocumentAuditLogs(documentId) {
    const rows = query(`
      SELECT id, timestamp, actor_username, action, outcome, details_json
      FROM audit_logs
      WHERE target_id = ?
      ORDER BY timestamp DESC
      LIMIT 20
    `, documentId);

    return rows.map(r => ({
      ...r,
      details: r.details_json ? JSON.parse(r.details_json) : {}
    }));
  }
};
