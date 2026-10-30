# SecureDocs — Document Repository & Rule-Based Threat Detection Engine

> **College Research & Capstone Project Specification**  
> A secure, role-based document management web platform featuring application-level audit logging, a deterministic sliding-window threat detection pipeline, an explainable risk-scoring engine, and an empirical research evaluation harness.

---

## 1. Project Overview & Problem Statement

Modern enterprise document platforms often suffer from two extremes: either they are purely static repositories that lack real-time visibility into malicious behavior, or they rely on opaque, non-deterministic machine learning "black boxes" that are difficult to explain, verify, or defend in an academic viva or security audit.

**SecureDocs** implements a clean, defensible security architecture:
1. **Explicit Role-Based Access Control (RBAC)**: Enforced strictly on the server-side for every single document view, upload, download, and deletion. Hiding frontend controls is never relied upon as a security boundary.
2. **Privacy by Design**: Administrators can inspect system metadata, audit logs, and security alerts, but **cannot view or download protected document contents** unless explicitly granted permission by the document owner.
3. **Deterministic Sliding-Window Threat Detection**: Transparent rule-based analysis evaluating timestamped audit events over 5-minute sliding windows to detect brute-force credential stuffing, rapid exfiltration velocity, privilege escalation probing, and targeted confidential document breaches.
4. **Explainable Risk Scoring**: A bounded 0–100 risk scoring service categorizing threats into Low, Medium, High, and Critical severities with duplicate alert suppression.
5. **Empirical Research Benchmark**: A built-in evaluation harness executing reproducible ground-truth test scenarios (benign vs. malicious traffic) to calculate measured Precision, Recall, F1-Score, False-Positive Rate, Balanced Accuracy, and detection latency against a stateless single-event baseline detector.

---

## 2. Technology Stack & Design Decisions

- **Frontend**: React 18 with Vite, React Router v6, Tailwind CSS (cybersecurity dark theme), Lucide React icons, and Recharts.
- **Backend**: Node.js (`v25.6.1`) with Express.js.
- **Database**: Built-in `node:sqlite` (`DatabaseSync`) with Write-Ahead Logging (`WAL`) mode, foreign key enforcement (`PRAGMA foreign_keys = ON;`), busy timeouts, and ACID transactions.
  - *Engineering Trade-off Note*: Node.js 22.5+ provides native `node:sqlite`, removing the need for external C++ compilers (`node-gyp`), Python, or Visual Studio C++ build tools on Windows development environments. Node.js emits an `ExperimentalWarning: SQLite is an experimental feature` at startup, which is expected for Node.js 22–25.
- **Authentication**: Stateful server-side sessions stored in SQLite with `httpOnly`, `SameSite=Lax` cookies, rate limiting, and `bcryptjs` password hashing (cost factor 10).
- **File Storage**: Private filesystem vault (`server/storage/documents/`) situated outside the web root. Files are renamed to random UUIDs upon ingestion to prevent path traversal (`../`) and file overwrite attacks.
- **Automated Testing**: Node.js built-in test runner (`node --test`) paired with Supertest for end-to-end HTTP integration tests.

---

## 3. System Architecture

```
[ Browser / Client ] 
        │
        ▼ (HTTP + Session Cookie / Bearer Token)
[ Express API Gateway ] 
   ├── Security Headers (nosniff, DENY, XSS-block)
   ├── Rate Limiter (Brute-force protection on /api/auth/login)
   ├── Session Authentication Middleware
   └── RBAC & Document Access Guard
        │
   ┌────┴───────────────────────────┬───────────────────────────┐
   ▼                                ▼                           ▼
[ Document Service ]       [ Audit Logger Service ]    [ Threat Engine ]
   │ (Private Disk Vault)           │ (SQLite WAL)              │ (Sliding Windows)
   │ server/storage/documents/      │ audit_logs table          ├── Rule A (Logins)
   │ UUID Storage & Magic Bytes     │ Append-only API           ├── Rule B (Velocity)
                                    │                           ├── Rule C (Denied)
                                    ▼                           └── Rule D (Confidential)
                           [ Alert Management ]                 │
                                    ▲                           ▼
                                    └────────────── [ Risk Scoring (0-100) ]
```

---

## 4. Threat Detection Rules & Risk Scoring Model

### Sliding-Window Detection Rules

| Rule Identifier | Trigger Condition | Detection Window | Base Score | Severity Band |
| :--- | :--- | :--- | :--- | :--- |
| `RULE_FAILED_LOGINS` | $\ge 5$ failed login attempts for the same account | 5 Minutes | 30 | Medium |
| `RULE_EXCESSIVE_DOWNLOADS` | $\ge 10$ document downloads by the same user | 5 Minutes | 25 | Medium |
| `RULE_REPEATED_DENIED_ACCESS`| $\ge 3$ unauthorized access denials for the same user | 5 Minutes | 25 | Medium |
| `RULE_CONFIDENTIAL_VIOLATION`| $\ge 1$ unauthorized attempt on a **Confidential** asset | Instant / 5 Min | 40 | Medium |

### Verified Rule Behaviors
Each rule has been verified independently via automated tests:
1. **Below-Threshold Suppression**: 4 failed logins, 9 downloads, or 2 access denials produce zero alerts.
2. **Threshold Triggering**: The 5th failed login, 10th download, 3rd access denial, or 1st confidential access triggers the exact alert with the specified base score.
3. **Time Window Decay**: Events older than the 5-minute sliding window do not count toward active thresholds.
4. **Duplicate Suppression**: Subsequent events occurring within the active alert window are appended to the existing alert (`alert_events` table) rather than generating duplicate alert records.

### Risk Aggregation Formula
$$\text{Raw Risk Score} = \sum_{r \in \text{Active Triggered Rules}} \text{Base Score}_r + \text{Sensitivity Modifiers}$$
$$\text{Final Risk Score} = \min(100, \text{Raw Risk Score})$$

- **Severity Classification Matrix**:
  - **Low**: 0–24
  - **Medium**: 25–49
  - **High**: 50–74
  - **Critical**: 75–100

*(Note: Single isolated violations such as Rule D yield 40 points, falling accurately into the Medium band. When correlated with multiple failures or repeated denials, aggregated scores exceed 50, escalating to High or Critical severity).*

---

## 5. Audit Logging Architecture & Actual Protection

### Actual Security Guarantees
- **Application-Level Append-Only Access**: The Express application exposes strictly read-only endpoints (`GET /api/activity`, `GET /api/documents/:id/audit`). There are no `POST`, `PUT`, `PATCH`, or `DELETE` endpoints for audit records.
- **Actor Attribution**: Every security-relevant event (login success/failure, logout, document upload, download, delete, permission grant/revoke, access denial, alert triage) is recorded with UTC timestamps, actor username, IP address, user agent, target ID, outcome, and structured metadata.
- **Sensitive Data Exclusion**: Passwords, session tokens, and raw document contents are explicitly excluded from audit logs.

### Honest Security Limitations (Audit Findings)
> [!IMPORTANT]
> The audit logs are stored in a standard SQLite database table (`audit_logs`) on the local filesystem (`server/storage/securedocs.db`). 
> **SecureDocs does not use cryptographic hash-chains (e.g. Merkle trees) or Write-Once-Read-Many (WORM) hardware.** 
> An operator or attacker with direct host operating system access to the SQLite file can modify or delete records using standard database tools. Claims of cryptographic immutability have been removed from documentation to reflect the actual implementation honestly.

---

## 6. Research Evaluation Methodology & Limitations

The `/evaluation` module provides reproducible, empirical benchmark verification:

### Mathematical Metric Definitions
$$\text{Precision} = \frac{TP}{TP + FP}, \quad \text{Recall (Sensitivity)} = \frac{TP}{TP + FN}$$
$$F_1 = 2 \times \frac{\text{Precision} \times \text{Recall}}{\text{Precision} + \text{Recall}}$$
$$\text{False Positive Rate (FPR)} = \frac{FP}{FP + TN}, \quad \text{Specificity} = \frac{TN}{TN + FP}$$
$$\text{Balanced Accuracy} = \frac{\text{Sensitivity} + \text{Specificity}}{2} = \frac{\frac{TP}{TP + FN} + \frac{TN}{TN + FP}}{2}$$

### Ground Truth Mapping (8 Scenarios)
- **Positive Scenarios (Malicious Threats — Ground Truth: Positive)**:
  1. *Scenario M1 (Credential Stuffing)*: 5 rapid failed logins within 1 minute.
  2. *Scenario M2 (Confidential Exfiltration Attempt)*: Unauthorized access attempt to confidential research.
  3. *Scenario M3 (Privilege Escalation Probing)*: 3 consecutive access denials on protected documents.
  4. *Scenario M4 (Bulk Data Exfiltration)*: 10 rapid document downloads within 2 minutes.
- **Negative Scenarios (Benign Normal Activity — Ground Truth: Negative)**:
  5. *Scenario B1 (Accidental Password Typo)*: Single bad password followed by valid sign-in.
  6. *Scenario B2 (Normal Download Velocity)*: User downloading 2 files with normal spacing.
  7. *Scenario B3 (Authorized Metadata Inspection)*: Reading permitted internal documents.
  8. *Scenario B4 (Profile Settings Update)*: Updating profile settings and logging out.

### Baseline Comparator Definition & Confusion Matrix
- **Stateless Baseline Detector**: A naive single-event detector that flags an alert immediately on *any* isolated login failure or access denial, without time-window decay or velocity tracking.
- **Measured Confusion Matrix on 8 Scenarios**:
  - **SecureDocs Engine**: $TP = 4, TN = 4, FP = 0, FN = 0$
    - Precision: $100.0\%$, Recall: $100.0\%$, F1-Score: $100.0\%$, FPR: $0.0\%$, Balanced Accuracy: $100.0\%$
  - **Stateless Baseline**: $TP = 3, TN = 3, FP = 1, FN = 1$
    - Baseline flags B1's single typo as an attack ($FP = 1$).
    - Baseline fails to detect M4 because all 10 downloads succeed ($outcome = 'success'$) and it lacks a download velocity counter ($FN = 1$).
    - Precision: $3 / 4 = 75.0\%$, Recall: $3 / 4 = 75.0\%$, F1-Score: $75.0\%$, FPR: $25.0\%$, Balanced Accuracy: $75.0\%$

### Benchmark Scope Limitation
> [!WARNING]
> **Scope Limitation**: The research benchmark executes a controlled suite of 8 synthetic test scenarios with isolated synthetic actor accounts. While this empirically demonstrates the architectural advantage of sliding-window state tracking over naive single-event checking, **it does not constitute generalizable statistical accuracy across unconstrained, real-world network traffic.**

---

## 7. Pre-Seeded Demonstration Accounts

For viva presentation and testing, the deterministic database seed provides pre-configured accounts:

| Username | Password | Role | Department | Default Permissions |
| :--- | :--- | :--- | :--- | :--- |
| `admin` | `Admin@123456` | `admin` | Cybersecurity Ops | System overview, alerts triage, user management, evaluation |
| `alice` | `User@123456` | `user` | Research & Development | Owns Quantum Cryptography (Confidential), Sprint Notes (Internal) |
| `bob` | `User@123456` | `user` | Legal & Compliance | Owns Compliance Audit (Confidential); granted access to Sprint Notes |
| `charlie` | `User@123456` | `user` | Finance & Accounting | Owns Operating Budget (Internal) |

> **Viva Shortcut**: The login page includes 1-click **Demo Quick-Fill buttons** to switch between Admin, Alice, Bob, and Charlie without typing passwords manually.

---

## 8. Quick Start & Execution Guide (Windows)

### Prerequisites
- Node.js `v22.5.0` or higher (`v25.6.1` recommended)
- npm `10.0.0` or higher

### Step 1: Install Dependencies
```powershell
# From project root:
npm --prefix server install
npm --prefix client install
```

### Step 2: Initialize & Seed Database
```powershell
# Creates storage folders, SQLite schema, demo accounts, and files:
npm run seed
```

### Step 3: Run Automated Test Suite
```powershell
# Executes all 52 tests across all 6 test suites:
npm test
```

### Step 4: Build & Launch Application
```powershell
# Build client production bundle:
npm run build

# Start the unified SecureDocs server:
npm start
```
Open your web browser and navigate to:
👉 **`http://localhost:5000`**

*(Optional Development Mode: Run `npm run server` in one terminal and `npm run client` in another for Vite hot-module reload at `http://localhost:5173`)*

---

## 9. College Viva Defense & FAQ

### Q1: Why use server-side sessions instead of JWTs in localStorage?
> **Answer**: Storing authentication tokens in `localStorage` leaves them vulnerable to Cross-Site Scripting (XSS) attacks. SecureDocs uses server-side sessions stored in SQLite with `HttpOnly` and `SameSite=Lax` cookies. JavaScript cannot read `HttpOnly` cookies, and session invalidation on logout is immediate and deterministic on the server.

### Q2: Why doesn't the Administrator see document contents by default?
> **Answer**: This embodies the **Principle of Least Privilege** and **Separation of Duties**. An administrator is responsible for managing users, monitoring audit logs, and triaging security incidents, but does not possess an inherent "need-to-know" regarding proprietary or confidential research documents owned by other users. Access must be explicitly granted by the document owner.

### Q3: How are path-traversal attacks prevented during file upload and download?
> **Answer**: When files are uploaded, their original filename is sanitized and stored only as metadata in the database. On disk, files are saved using cryptographically random UUIDs (`${uuid}.${extension}`) inside a dedicated folder outside the web root. Path traversal characters (`../`, `..\`) are strictly forbidden.

### Q4: How does SecureDocs suppress duplicate security alerts?
> **Answer**: We maintain an `alert_events` relationship table linking each security alert to the exact audit log entries that triggered it. If an open or acknowledged alert already exists within the sliding window, new anomalous logs are appended to the existing alert rather than spamming administrators with duplicate alerts.

### Q5: What are the acknowledged limitations of this prototype?
> **Answer**: 
> 1. *Encryption at Rest*: Files are stored in a private directory with OS-level access control, but filesystem-level encryption (e.g. AES-256 envelope encryption with KMS) is omitted to keep the project self-contained and runnable on standard Windows machines.
> 2. *Audit Log Immutability*: Protection is enforced at the application layer through append-only endpoints; direct root operating system access to the SQLite file is not prevented by cryptographic WORM hardware.
> 3. *Evaluation Sample Size*: Benchmark metrics reflect an 8-scenario controlled ground truth suite designed to validate detector behavior, not unconstrained open-world accuracy.
