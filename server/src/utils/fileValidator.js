import path from 'node:path';
import fs from 'node:fs';

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.txt', '.docx', '.png', '.jpg', '.jpeg']);

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg'
]);

/**
 * Validates file magic bytes (file signature) against expected formats.
 */
export function validateFileSignature(buffer, extension) {
  if (!buffer || buffer.length === 0) return false;

  const ext = extension.toLowerCase();

  if (ext === '.pdf') {
    // Starts with %PDF
    return buffer.length >= 4 &&
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46;
  }

  if (ext === '.png') {
    // 89 50 4E 47 0D 0A 1A 0A
    return buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4E &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0D &&
      buffer[5] === 0x0A &&
      buffer[6] === 0x1A &&
      buffer[7] === 0x0A;
  }

  if (ext === '.jpg' || ext === '.jpeg') {
    // FF D8 FF
    return buffer.length >= 3 &&
      buffer[0] === 0xFF &&
      buffer[1] === 0xD8 &&
      buffer[2] === 0xFF;
  }

  if (ext === '.docx') {
    // PK\x03\x04 (ZIP format)
    return buffer.length >= 4 &&
      buffer[0] === 0x50 &&
      buffer[1] === 0x4B &&
      buffer[2] === 0x03 &&
      buffer[3] === 0x04;
  }

  if (ext === '.txt') {
    // Text: verify no null bytes or binary control characters in first 512 bytes
    const sampleLength = Math.min(buffer.length, 512);
    for (let i = 0; i < sampleLength; i++) {
      const byte = buffer[i];
      if (byte === 0x00) return false; // Null byte indicates binary
    }
    return true;
  }

  return false;
}

/**
 * Sanitizes and validates filename, extensions and path traversal attempts.
 */
export function validateFilename(originalName) {
  if (!originalName || typeof originalName !== 'string') {
    throw new Error('Invalid filename provided');
  }

  // Path traversal check
  if (originalName.includes('..') || originalName.includes('/') || originalName.includes('\\')) {
    throw new Error('Path traversal attempt detected in filename');
  }

  const ext = path.extname(originalName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`File extension '${ext}' is not permitted. Allowed: ${Array.from(ALLOWED_EXTENSIONS).join(', ')}`);
  }

  // Sanitize filename to alphanumeric and safe characters
  const baseName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_\-\. ]/g, '_');
  return {
    sanitizedName: `${baseName}${ext}`,
    extension: ext
  };
}

export function isAllowedMimeType(mime) {
  return ALLOWED_MIME_TYPES.has(mime);
}
