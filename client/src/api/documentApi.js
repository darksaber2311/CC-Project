import { apiRequest } from './client.js';

export const documentApi = {
  listDocuments({ sensitivity = '', search = '', limit = 50, offset = 0 } = {}) {
    const params = new URLSearchParams();
    if (sensitivity) params.append('sensitivity', sensitivity);
    if (search) params.append('search', search);
    if (limit) params.append('limit', limit);
    if (offset) params.append('offset', offset);

    return apiRequest(`/documents?${params.toString()}`);
  },

  getDocumentDetails(id) {
    return apiRequest(`/documents/${id}`);
  },

  async downloadDocument(id, originalFilename) {
    const blob = await apiRequest(`/documents/${id}/download`, {
      responseType: 'blob'
    });

    // Create browser download link
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = originalFilename || `document-${id}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  uploadDocument(formData) {
    return apiRequest('/documents/upload', {
      method: 'POST',
      body: formData
    });
  },

  deleteDocument(id) {
    return apiRequest(`/documents/${id}`, {
      method: 'DELETE'
    });
  },

  grantPermission(documentId, targetUserId, permissionType) {
    return apiRequest(`/documents/${documentId}/permissions`, {
      method: 'POST',
      body: JSON.stringify({ targetUserId, permissionType })
    });
  },

  revokePermission(documentId, permissionId) {
    return apiRequest(`/documents/${documentId}/permissions/${permissionId}`, {
      method: 'DELETE'
    });
  },

  getDocumentAudit(documentId) {
    return apiRequest(`/documents/${documentId}/audit`);
  }
};
