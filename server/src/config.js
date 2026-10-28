import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRootDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(serverRootDir, '.env') });

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  sessionSecret: process.env.SESSION_SECRET || 'securedocs-default-secret-key-32chars-min',
  sessionExpiryHours: parseInt(process.env.SESSION_EXPIRY_HOURS || '24', 10),
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  
  // Storage paths
  dbPath: path.resolve(serverRootDir, process.env.DB_PATH || './storage/securedocs.db'),
  storagePath: path.resolve(serverRootDir, process.env.STORAGE_PATH || './storage/documents'),
  maxFileSizeBytes: (parseInt(process.env.MAX_FILE_SIZE_MB || '15', 10)) * 1024 * 1024,

  // Threat Detection Rules & Sliding Windows
  detection: {
    // Rule A: Repeated Failed Logins
    failedLogins: {
      threshold: 5,
      windowMinutes: 5,
      baseScore: 30,
      severity: 'medium',
      title: 'Repeated Failed Login Attempts Detected',
      ruleId: 'RULE_FAILED_LOGINS'
    },
    // Rule B: Excessive Downloads
    excessiveDownloads: {
      threshold: 10,
      windowMinutes: 5,
      baseScore: 25,
      severity: 'medium',
      title: 'Excessive Document Download Velocity Detected',
      ruleId: 'RULE_EXCESSIVE_DOWNLOADS'
    },
    // Rule C: Repeated Denied Access
    repeatedDeniedAccess: {
      threshold: 3,
      windowMinutes: 5,
      baseScore: 25,
      severity: 'medium',
      title: 'Repeated Unauthorized Access Attempts Detected',
      ruleId: 'RULE_REPEATED_DENIED_ACCESS'
    },
    // Rule D: Sensitive Document Access Violation
    confidentialViolation: {
      threshold: 1,
      windowMinutes: 5,
      baseScore: 40,
      severity: 'high',
      title: 'Unauthorized Confidential Document Access Attempt',
      ruleId: 'RULE_CONFIDENTIAL_VIOLATION'
    }
  },

  // Risk Score Severity Bands
  severityBands: {
    low: { min: 0, max: 24, label: 'Low' },
    medium: { min: 25, max: 49, label: 'Medium' },
    high: { min: 50, max: 74, label: 'High' },
    critical: { min: 75, max: 100, label: 'Critical' }
  }
};
