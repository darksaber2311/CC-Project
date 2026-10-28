import { apiRequest } from './client.js';

export const activityApi = {
  getStats() {
    return apiRequest('/activity/stats');
  },

  getLogs({ page = 1, limit = 25, action = '', outcome = '', actor = '' } = {}) {
    const params = new URLSearchParams();
    if (page) params.append('page', page);
    if (limit) params.append('limit', limit);
    if (action) params.append('action', action);
    if (outcome) params.append('outcome', outcome);
    if (actor) params.append('actor', actor);

    return apiRequest(`/activity?${params.toString()}`);
  }
};
