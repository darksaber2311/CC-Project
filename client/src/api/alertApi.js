import { apiRequest } from './client.js';

export const alertApi = {
  listAlerts({ severity = '', status = '', ruleId = '', page = 1, limit = 50 } = {}) {
    const params = new URLSearchParams();
    if (severity) params.append('severity', severity);
    if (status) params.append('status', status);
    if (ruleId) params.append('ruleId', ruleId);
    if (page) params.append('page', page);
    if (limit) params.append('limit', limit);

    return apiRequest(`/alerts?${params.toString()}`);
  },

  getAlertDetails(id) {
    return apiRequest(`/alerts/${id}`);
  },

  acknowledgeAlert(id) {
    return apiRequest(`/alerts/${id}/acknowledge`, {
      method: 'PATCH'
    });
  },

  resolveAlert(id, resolutionNote) {
    return apiRequest(`/alerts/${id}/resolve`, {
      method: 'PATCH',
      body: JSON.stringify({ resolutionNote })
    });
  }
};
