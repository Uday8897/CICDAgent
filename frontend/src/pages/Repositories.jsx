// src/pages/Repositories.jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  GitBranch, 
  Activity, 
  Play,
  Pause,
  Trash2,
  ExternalLink,
  AlertCircle,
  Calendar,
  User
} from 'lucide-react';
import Button from '../components/UI/Button';
import StatusBadge from '../components/UI/StatusBadge';
import { useApi } from '../hooks/useApi';
import { repositoriesAPI } from '../services/api';

const Repositories = () => {
  const { data, loading, error, refetch } = useApi(repositoriesAPI.getAll);
  const [actionLoading, setActionLoading] = useState(null);

  const repositories = data?.repositories || [];

  // Debug: Check repository data
  console.log('Repositories data:', repositories);

  const handleToggleActive = async (repoId, currentStatus, repoName) => {
    setActionLoading(repoId);
    try {
      const newStatus = !currentStatus;
      await repositoriesAPI.update(repoId, { is_active: newStatus });
      
      // Show confirmation message
      alert(`Monitoring ${newStatus ? 'resumed' : 'paused'} for ${repoName}`);
      
      refetch();
    } catch (error) {
      console.error('Error updating repository:', error);
      alert(`Error ${currentStatus ? 'pausing' : 'resuming'} monitoring: ${error.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (repoId, repoName) => {
    if (window.confirm(`Are you sure you want to delete ${repoName}?`)) {
      setActionLoading(repoId);
      try {
        await repositoriesAPI.delete(repoId);
        refetch();
      } catch (error) {
        console.error('Error deleting repository:', error);
        alert(`Error deleting repository: ${error.message}`);
      } finally {
        setActionLoading(null);
      }
    }
  };

  const handleTriggerMonitoring = async (repoId, repoName) => {
    setActionLoading(repoId);
    try {
      await repositoriesAPI.triggerMonitoring(repoId);
      alert(`Monitoring triggered for ${repoName}`);
    } catch (error) {
      console.error('Error triggering monitoring:', error);
      alert(`Error triggering monitoring: ${error.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
        <h3 className="mt-4 text-lg font-medium text-gray-900">Error loading repositories</h3>
        <p className="mt-2 text-gray-500">{error}</p>
        <Button onClick={refetch} className="mt-4">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Repositories</h1>
        <Link to="/add-repository">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Repository
          </Button>
        </Link>
      </div>

      {repositories.length === 0 ? (
        <div className="card p-12 text-center">
          <GitBranch className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No repositories</h3>
          <p className="mt-2 text-gray-500">
            Get started by adding your first repository to monitor.
          </p>
          <Link to="/repositories/add" className="mt-6 inline-block">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Repository
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {repositories.map((repo) => (
            <div key={repo.id} className="card p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <GitBranch className="w-8 h-8 text-blue-600" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{repo.name}</h3>
                    <p className="text-gray-600 text-sm">{repo.url}</p>
                    <div className="flex items-center space-x-4 mt-2">
                      <span className="text-sm text-gray-500">
                        <User className="w-4 h-4 inline mr-1" />
                        {repo.owner}
                      </span>
                      <span className="text-sm text-gray-500">
                        <Calendar className="w-4 h-4 inline mr-1" />
                        Added {new Date(repo.created_at).toLocaleDateString()}
                      </span>
                      {repo.last_monitored && (
                        <span className="text-sm text-gray-500">
                          <Activity className="w-4 h-4 inline mr-1" />
                          Last monitored {new Date(repo.last_monitored).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {/* Status Badge - Updated for pause/resume */}
                  <StatusBadge status={repo.is_active ? 'active' : 'paused'} />
                  
                  {/* Monitor Now Button - Disabled when paused */}
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={actionLoading === repo.id}
                    onClick={() => handleTriggerMonitoring(repo.id, repo.name)}
                    disabled={!repo.is_active}
                    title={!repo.is_active ? "Monitoring is paused" : "Trigger monitoring now"}
                  >
                    <Play className="w-4 h-4" />
                  </Button>

                  {/* Pause/Resume Button */}
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={actionLoading === repo.id}
                    onClick={() => handleToggleActive(repo.id, repo.is_active, repo.name)}
                    title={repo.is_active ? "Pause monitoring" : "Resume monitoring"}
                  >
                    {repo.is_active ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </Button>

                  {/* View on GitHub */}
                  <a href={repo.url} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="secondary" title="View on GitHub">
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </a>

                  {/* View Details */}
                  {repo.id ? (
                    <Link to={`/repositories/${repo.id}`}>
                      <Button size="sm" variant="secondary" title="View details">
                        View Details
                      </Button>
                    </Link>
                  ) : (
                    <Button size="sm" variant="secondary" disabled>
                      View Details
                    </Button>
                  )}

                  {/* Delete Button */}
                  <Button
                    size="sm"
                    variant="danger"
                    loading={actionLoading === repo.id}
                    onClick={() => handleDelete(repo.id, repo.name)}
                    title="Delete repository"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Additional status information */}
              {!repo.is_active && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-yellow-600" />
                    <span className="text-sm text-yellow-700">
                      Monitoring is paused. Resume to enable automatic monitoring.
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      {repositories.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Total: {repositories.length} repositories</span>
            <span>Active: {repositories.filter(r => r.is_active).length} monitoring</span>
            <span>Paused: {repositories.filter(r => !r.is_active).length} paused</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Repositories;