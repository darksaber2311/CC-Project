import { apiRequest } from './client.js';

export const authApi = {
  login(username, password) {
    return apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  },

  logout() {
    return apiRequest('/auth/logout', {
      method: 'POST'
    });
  },

  getMe() {
    return apiRequest('/auth/me');
  },

  getProfile() {
    return apiRequest('/auth/profile');
  },

  updateProfile(data) {
    return apiRequest('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }
};
