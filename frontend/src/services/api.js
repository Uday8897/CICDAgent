// src/services/api.js - Complete version with all methods
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Add error interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    if (error.response) {
      // Server responded with error status
      throw new Error(error.response.data.detail || error.response.data.message || 'API Error');
    } else if (error.request) {
      // Request made but no response received
      throw new Error('Network error: Unable to connect to server');
    } else {
      // Something else happened
      throw new Error('Request failed: ' + error.message);
    }
  }
);

export const repositoriesAPI = {
  // Get all repositories
  getAll: async () => {
    const response = await api.get('/repositories');
    // Transform _id to id for frontend consistency
    const repositories = response.data.map(repo => ({
      ...repo,
      id: repo._id || repo.id // Use _id if id doesn't exist
    }));
    return { 
      data: { 
        repositories 
      } 
    };
  },

  // Add repository - ADD THIS MISSING METHOD
  add: async (repoData) => {
    console.log('Adding repository:', repoData.url);
    const response = await api.post('/repositories', repoData);
    const repo = response.data;
    // Transform _id to id
    return { 
      data: {
        ...repo,
        id: repo._id || repo.id
      }
    };
  },

  // Get repository by ID
  get: async (id) => {
    const response = await api.get(`/repositories/${id}`);
    const repo = response.data;
    // Transform _id to id
    return { 
      data: {
        ...repo,
        id: repo._id || repo.id
      }
    };
  },

  // Update repository
  update: async (id, updateData) => {
    const response = await api.put(`/repositories/${id}`, updateData);
    const repo = response.data;
    return { 
      data: {
        ...repo,
        id: repo._id || repo.id
      }
    };
  },

  // Delete repository - ADD THIS MISSING METHOD
  delete: async (id) => {
    const response = await api.delete(`/repositories/${id}`);
    return { data: { success: true } };
  },

  // Get monitoring results for a repository
  getResults: async (repoId) => {
    const response = await api.get(`/repositories/${repoId}/results`);
    // Transform results if needed
    const results = response.data.map(result => ({
      ...result,
      id: result._id || result.id,
      repo_id: result.repo_id // Keep as is for filtering
    }));
    return { data: { results } };
  },

  // Trigger monitoring for a repository - ADD THIS MISSING METHOD
  triggerMonitoring: async (repoId) => {
    const response = await api.post(`/repositories/${repoId}/monitor`);
    return { data: response.data };
  },

  // Get all monitoring results (convenience method)
  getAllResults: async (limit = 100) => {
    const response = await api.get('/monitoring/results', {
      params: { limit }
    });
    const results = response.data.map(result => ({
      ...result,
      id: result._id || result.id,
      repo_id: result.repo_id
    }));
    return { data: { results } };
  }
};

export const statsAPI = {
  getStats: async () => {
    const response = await api.get('/stats');
    return { data: response.data };
  },
  getRecentActivity: async (limit = 10) => {
    const response = await api.get('/monitoring/results', {
      params: { limit }
    });
    const results = response.data.map(result => ({
      ...result,
      id: result._id || result.id,
      repo_id: result.repo_id
    }));
    return { data: { results } };
  }
};

export const monitoringAPI = {
  getAllResults: async (limit = 100) => {
    const response = await api.get('/monitoring/results', {
      params: { limit }
    });
    const results = response.data.map(result => ({
      ...result,
      id: result._id || result.id,
      repo_id: result.repo_id
    }));
    return { data: { results } };
  },

  // Additional monitoring methods if needed
  getResultsByRepo: async (repoId, limit = 50) => {
    const response = await api.get(`/repositories/${repoId}/results`, {
      params: { limit }
    });
    const results = response.data.map(result => ({
      ...result,
      id: result._id || result.id,
      repo_id: result.repo_id
    }));
    return { data: { results } };
  }
};

// Scheduler API for checking status
export const schedulerAPI = {
  getStatus: async () => {
    const response = await api.get('/scheduler/status');
    return { data: response.data };
  }
};

export default api;