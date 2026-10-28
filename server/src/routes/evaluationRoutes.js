import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { evaluationService } from '../services/evaluationService.js';

export const evaluationRouter = Router();

evaluationRouter.use(requireAuth);
evaluationRouter.use(requireRole('admin'));

let latestResults = null;

// POST /api/evaluation/run - Trigger test harness execution
evaluationRouter.post('/run', async (req, res, next) => {
  try {
    const results = await evaluationService.runEvaluation();
    latestResults = results;
    res.json(results);
  } catch (err) {
    next(err);
  }
});

// GET /api/evaluation/results - Retrieve latest or run fresh
evaluationRouter.get('/results', async (req, res, next) => {
  try {
    if (!latestResults) {
      latestResults = await evaluationService.runEvaluation();
    }
    res.json(latestResults);
  } catch (err) {
    next(err);
  }
});
