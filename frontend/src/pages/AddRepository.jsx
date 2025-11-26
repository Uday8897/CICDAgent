// src/pages/AddRepository.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, GitBranch, Shield, AlertCircle } from 'lucide-react';
import Button from '../components/UI/Button';
import { repositoriesAPI } from '../services/api';

const AddRepository = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    url: '',
    access_token: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('Adding repository:', formData.url);
      const response = await repositoriesAPI.add(formData);
      console.log('Repository added successfully:', response.data);
      navigate('/repositories');
    } catch (err) {
      console.error('Error adding repository:', err);
      const errorMessage = err.message || 'Failed to add repository. Please check the URL and access token.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Validate GitHub URL format
  const isValidGitHubUrl = (url) => {
    if (!url) return true; // Don't show error when empty
    try {
      const parsed = new URL(url);
      return parsed.hostname === 'github.com' && parsed.pathname.split('/').filter(Boolean).length >= 2;
    } catch {
      return false;
    }
  };

  const isFormValid = formData.url && formData.access_token && isValidGitHubUrl(formData.url);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center space-x-4 mb-6">
        <button
          onClick={() => navigate('/repositories')}
          className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Add Repository</h1>
      </div>

      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <p className="text-red-700 text-sm font-medium">Error</p>
              </div>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          )}

          {/* Repository URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              GitHub Repository URL
            </label>
            <div className="relative">
              <GitBranch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="url"
                required
                placeholder="https://github.com/owner/repository"
                className={`input-field pl-10 ${
                  formData.url && !isValidGitHubUrl(formData.url) ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
                }`}
                value={formData.url}
                onChange={(e) => handleChange('url', e.target.value)}
              />
            </div>
            {formData.url && !isValidGitHubUrl(formData.url) && (
              <p className="text-red-600 text-sm mt-1">
                Please enter a valid GitHub repository URL (e.g., https://github.com/owner/repo)
              </p>
            )}
            <p className="text-sm text-gray-500 mt-1">
              Enter the full URL of the GitHub repository you want to monitor
            </p>
          </div>

          {/* Access Token */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              GitHub Access Token
            </label>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="password"
                required
                placeholder="ghp_... or github_pat_..."
                className="input-field pl-10"
                value={formData.access_token}
                onChange={(e) => handleChange('access_token', e.target.value)}
              />
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Your token needs <strong>repo</strong> and <strong>workflow</strong> permissions
            </p>
          </div>

          {/* Permissions Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-800 mb-2">Required Permissions</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• <strong>repo</strong> - Full control of private repositories</li>
              <li>• <strong>workflow</strong> - Update GitHub Action workflows</li>
              <li>• <strong>read:org</strong> - Read org and team membership</li>
              <li>• <strong>read:user</strong> - Read user profile data</li>
            </ul>
            <div className="mt-3 p-3 bg-blue-100 rounded">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> The access token is securely stored and only used for monitoring and fixing workflows.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/repositories')}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={loading}
              disabled={!isFormValid || loading}
            >
              Add Repository
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddRepository;