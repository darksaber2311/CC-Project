import { apiRequest } from './client.js';

export const evaluationApi = {
  runEvaluation() {
    return apiRequest('/evaluation/run', {
      method: 'POST'
    });
  },

  getResults() {
    return apiRequest('/evaluation/results');
  }
};
