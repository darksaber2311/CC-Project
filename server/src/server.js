import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { authenticateSession } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/authRoutes.js';
import { activityRouter } from './routes/activityRoutes.js';
import { documentRouter } from './routes/documentRoutes.js';
import { userRouter } from './routes/userRoutes.js';
import { alertRouter } from './routes/alertRoutes.js';
import { evaluationRouter } from './routes/evaluationRoutes.js';

export const app = express();

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Cross-Origin Resource Sharing
app.use(cors({
  origin: config.clientUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(config.sessionSecret));

// Authenticate session for all requests
app.use(authenticateSession);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'SecureDocs Security & Document Management API'
  });
});

// Auth Routes
app.use('/api/auth', authRouter);

// Activity & Audit Routes
app.use('/api/activity', activityRouter);

// Document Management Routes
app.use('/api/documents', documentRouter);

// User Management Routes
app.use('/api/users', userRouter);

// Security Alerts Routes
app.use('/api/alerts', alertRouter);

// Research Evaluation Routes
app.use('/api/evaluation', evaluationRouter);

// Serve Client Static Build in Production
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, '../../client/dist');

if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Global Error Handler
app.use(errorHandler);

// If run directly, listen on port
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  app.listen(config.port, () => {
    console.log(`[SecureDocs Server] Running on http://localhost:${config.port}`);
    console.log(`[SecureDocs Server] CORS configured for ${config.clientUrl}`);
  });
}
