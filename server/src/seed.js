import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db, initDatabase, execute, queryOne } from './db.js';
import { config } from './config.js';

export function seedDatabase() {
  console.log('--- Initializing SecureDocs Database & Seeding ---');
  initDatabase();

  // Clear existing records to ensure deterministic seed
  db.exec(`
    DELETE FROM alert_events;
    DELETE FROM security_alerts;
    DELETE FROM audit_logs;
    DELETE FROM document_permissions;
    DELETE FROM documents;
    DELETE FROM sessions;
    DELETE FROM users;
  `);

  const passwordAdminHash = bcrypt.hashSync('Admin@123456', 10);
  const passwordUserHash = bcrypt.hashSync('User@123456', 10);

  // 1. Seed Users
  const adminId = '11111111-1111-4111-8111-111111111111';
  const aliceId = '22222222-2222-4222-8222-222222222222';
  const bobId = '33333333-3333-4333-8333-333333333333';
  const charlieId = '44444444-4444-4444-8444-444444444444';

  execute(`
    INSERT INTO users (id, username, email, password_hash, role, full_name, department, is_active)
    VALUES 
      (?, 'admin', 'admin@securedocs.local', ?, 'admin', 'SecOps Administrator', 'Cybersecurity Ops', 1),
      (?, 'alice', 'alice@securedocs.local', ?, 'user', 'Alice Johnson', 'Research & Development', 1),
      (?, 'bob', 'bob@securedocs.local', ?, 'user', 'Bob Miller', 'Legal & Compliance', 1),
      (?, 'charlie', 'charlie@securedocs.local', ?, 'user', 'Charlie Davis', 'Finance & Accounting', 1)
  `, adminId, passwordAdminHash, aliceId, passwordUserHash, bobId, passwordUserHash, charlieId, passwordUserHash);

  console.log('✓ Users created: admin, alice, bob, charlie');

  // 2. Ensure physical storage directory exists
  fs.mkdirSync(config.storagePath, { recursive: true });

  // 3. Seed Documents
  const docs = [
    {
      id: 'doc-0001-alice-confidential',
      original: 'Quantum_Cryptography_Proposal.pdf',
      owner: aliceId,
      ownerUsername: 'alice',
      sensitivity: 'confidential',
      mime: 'application/pdf',
      ext: '.pdf',
      desc: 'Confidential research proposal outlining post-quantum key exchange algorithms.',
      content: '%PDF-1.4\n% SecureDocs Confidential Research Document: Quantum Cryptography\nOwner: Alice Johnson\nSensitivity: Confidential\nThis document contains proprietary cryptographic research.\n%%EOF'
    },
    {
      id: 'doc-0002-alice-internal',
      original: 'Sprint_42_Architecture_Review.txt',
      owner: aliceId,
      ownerUsername: 'alice',
      sensitivity: 'internal',
      mime: 'text/plain',
      ext: '.txt',
      desc: 'Internal architecture notes covering RBAC boundary testing and session security.',
      content: 'SecureDocs Internal Review - Sprint 42\nParticipants: Alice Johnson, Bob Miller\nKey findings: Token binding and sliding window rate limits are working correctly.'
    },
    {
      id: 'doc-0003-alice-public',
      original: 'Threat_Modeling_Whitepaper.txt',
      owner: aliceId,
      ownerUsername: 'alice',
      sensitivity: 'public',
      mime: 'text/plain',
      ext: '.txt',
      desc: 'Publicly readable guide on threat modeling for college projects.',
      content: 'SecureDocs Threat Modeling Guide (Public Release)\nThis whitepaper outlines rule-based anomaly detection models.'
    },
    {
      id: 'doc-0004-bob-confidential',
      original: 'Compliance_Audit_2026.txt',
      owner: bobId,
      ownerUsername: 'bob',
      sensitivity: 'confidential',
      mime: 'text/plain',
      ext: '.txt',
      desc: 'Annual legal and regulatory compliance assessment report.',
      content: 'CONFIDENTIAL COMPLIANCE AUDIT 2026\nPrepared by: Bob Miller, Legal & Compliance\nScope: Data access controls, separation of duties, and audit trail completeness.'
    },
    {
      id: 'doc-0005-charlie-internal',
      original: 'Q3_Operating_Budget.txt',
      owner: charlieId,
      ownerUsername: 'charlie',
      sensitivity: 'internal',
      mime: 'text/plain',
      ext: '.txt',
      desc: 'Quarterly departmental operating budget and hardware allocations.',
      content: 'INTERNAL FINANCE RECORD\nDepartment: Finance\nPrepared by: Charlie Davis\nStatus: Approved'
    }
  ];

  for (const doc of docs) {
    const storedFilename = `${doc.id}${doc.ext}`;
    const filePath = path.join(config.storagePath, storedFilename);
    fs.writeFileSync(filePath, doc.content, 'utf8');
    const fileSize = Buffer.byteLength(doc.content, 'utf8');

    execute(`
      INSERT INTO documents (
        id, original_filename, stored_filename, owner_id, file_size, 
        mime_type, file_extension, sensitivity_level, description, storage_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, doc.id, doc.original, storedFilename, doc.owner, fileSize, doc.mime, doc.ext, doc.sensitivity, doc.desc, storedFilename);

    // Initial audit log for document upload
    execute(`
      INSERT INTO audit_logs (
        id, timestamp, actor_id, actor_username, action, 
        target_type, target_id, outcome, ip_address, user_agent, details_json
      ) VALUES (?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-2 hours'), ?, ?, 'DOCUMENT_UPLOAD', 'document', ?, 'success', '127.0.0.1', 'Mozilla/5.0 SeedScript', ?)
    `, crypto.randomUUID(), doc.owner, doc.ownerUsername, doc.id, JSON.stringify({ filename: doc.original, sensitivity: doc.sensitivity }));
  }

  console.log(`✓ Seeded ${docs.length} documents with physical storage files`);

  // 4. Seed an explicit Document Permission (Alice grants Bob 'view' and 'download' to Sprint Notes)
  const permId = crypto.randomUUID();
  execute(`
    INSERT INTO document_permissions (id, document_id, user_id, permission_type, granted_by)
    VALUES (?, 'doc-0002-alice-internal', ?, 'view', ?)
  `, permId, bobId, aliceId);

  const permId2 = crypto.randomUUID();
  execute(`
    INSERT INTO document_permissions (id, document_id, user_id, permission_type, granted_by)
    VALUES (?, 'doc-0002-alice-internal', ?, 'download', ?)
  `, permId2, bobId, aliceId);

  execute(`
    INSERT INTO audit_logs (
      id, timestamp, actor_id, actor_username, action, 
      target_type, target_id, outcome, ip_address, user_agent, details_json
    ) VALUES (?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-1 hour'), ?, 'alice', 'PERMISSION_GRANT', 'document', 'doc-0002-alice-internal', 'success', '127.0.0.1', 'Mozilla/5.0 SeedScript', ?)
  `, crypto.randomUUID(), aliceId, JSON.stringify({ grantee: 'bob', permissions: ['view', 'download'] }));

  console.log('✓ Granted Alice->Bob sharing permissions for Sprint Notes');

  // 5. Seed some initial audit events
  execute(`
    INSERT INTO audit_logs (
      id, timestamp, actor_id, actor_username, action, target_type, target_id, outcome, ip_address, user_agent, details_json
    ) VALUES 
      (?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-3 hours'), ?, 'admin', 'LOGIN_SUCCESS', 'session', NULL, 'success', '127.0.0.1', 'Mozilla/5.0', '{"method":"password"}'),
      (?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-2 hours'), ?, 'alice', 'LOGIN_SUCCESS', 'session', NULL, 'success', '127.0.0.1', 'Mozilla/5.0', '{"method":"password"}'),
      (?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-1 hour'), ?, 'bob', 'LOGIN_SUCCESS', 'session', NULL, 'success', '127.0.0.1', 'Mozilla/5.0', '{"method":"password"}')
  `, crypto.randomUUID(), adminId, crypto.randomUUID(), aliceId, crypto.randomUUID(), bobId);

  console.log('✓ Seeded initial audit logs');
  console.log('--- Database seeding completed successfully ---');
}

// Allow direct CLI execution: node src/seed.js
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seedDatabase();
}
