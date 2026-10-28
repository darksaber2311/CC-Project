import { apiRequest } from './client.js';

export const userApi = {
  getActiveUsers() {
    return apiRequest('/users/active');
  },

  getAllUsers() {
    return apiRequest('/users');
  },

  toggleUserStatus(id, isActive) {
    return apiRequest(`/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive })
    });
  }
};
