// src/pages/RepositoryDetail.jsx - Enhanced with better pause/resume
import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  GitBranch, 
  Calendar, 
  User, 
  Activity,
  Play,
  Pause,
  Trash2,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react';
import Button from '../components/UI/Button';
import StatusBadge from '../components/UI/StatusBadge';
import { useApi } from '../hooks/useApi';
import { repositoriesAPI } from '../services/api';

const RepositoryDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // Fetch specific repository by ID
  const { data: repoData, loading: repoLoading, error: repoError, refetch: refetchRepo } = useApi(
    () => repositoriesAPI.get(id),
    [id]
  );
  
  const { data: resultsData, loading: resultsLoading, error: resultsError, refetch: refetchResults } = useApi(
    () => repositoriesAPI.getResults(id),
    [id]
  );
  
  const [actionLoading, setActionLoading] = useState(false);
  const [monitoringStatus, setMonitoringStatus] = useState('idle');

  const repository = repoData;
  const results = resultsData?.results || [];

  const handleToggleActive = async () => {
    if (!repository) return;
    
    setActionLoading(true);
    try {
      const newStatus = !repository.is_active;
      await repositoriesAPI.update(repository.id, { is_active: newStatus });
      
      // Show status message
      setMonitoringStatus(newStatus ? 'resumed' : 'paused');
      setTimeout(() => setMonitoringStatus('idle'), 3000);
      
      refetchRepo();
    } catch (error) {
      console.error('Error updating repository:', error);
      setMonitoringStatus('error');
      setTimeout(() => setMonitoringStatus('idle'), 3000);
    } finally {
      setActionLoading(false);
    }
  };

  const handleTriggerMonitoring = async () => {
    if (!repository.is_active) {
      alert('Monitoring is paused. Please resume monitoring first.');
      return;
    }
    
    setActionLoading(true);
    setMonitoringStatus('monitoring');
    try {
      await repositoriesAPI.triggerMonitoring(id);
      // Refetch results after a short delay
      setTimeout(() => {
        refetchResults();
        setMonitoringStatus('completed');
        setTimeout(() => setMonitoringStatus('idle'), 2000);
      }, 3000);
    } catch (error) {
      console.error('Error triggering monitoring:', error);
      setMonitoringStatus('error');
      setTimeout(() => setMonitoringStatus('idle'), 3000);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this repository?')) {
      setActionLoading(true);
      try {
        await repositoriesAPI.delete(id);
        navigate('/repositories');
      } catch (error) {
        console.error('Error deleting repository:', error);
      } finally {
        setActionLoading(false);
      }
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failure':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getMonitoringStatusMessage = () => {
    switch (monitoringStatus) {
      case 'monitoring':
        return 'Monitoring in progress...';
      case 'completed':
        return 'Monitoring completed!';
      case 'paused':
        return 'Monitoring paused';
      case 'resumed':
        return 'Monitoring resumed';
      case 'error':
        return 'Error occurred';
      default:
        return null;
    }
  };

  if (repoLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (repoError || !repository) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
        <h3 className="mt-4 text-lg font-medium text-gray-900">Repository not found</h3>
        <p className="mt-2 text-gray-500">
          {repoError || "The repository you're looking for doesn't exist."}
        </p>
        <Link to="/repositories" className="mt-6 inline-block">
          <Button variant="secondary">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Repositories
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Message */}
      {monitoringStatus !== 'idle' && (
        <div className={`p-4 rounded-lg ${
          monitoringStatus === 'error' ? 'bg-red-50 border border-red-200' :
          monitoringStatus === 'completed' ? 'bg-green-50 border border-green-200' :
          'bg-blue-50 border border-blue-200'
        }`}>
          <div className="flex items-center space-x-2">
            {monitoringStatus === 'monitoring' && (
              <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
            )}
            {monitoringStatus === 'completed' && (
              <CheckCircle className="w-4 h-4 text-green-600" />
            )}
            {monitoringStatus === 'error' && (
              <AlertCircle className="w-4 h-4 text-red-600" />
            )}
            <span className={`text-sm font-medium ${
              monitoringStatus === 'error' ? 'text-red-800' :
              monitoringStatus === 'completed' ? 'text-green-800' :
              'text-blue-800'
            }`}>
              {getMonitoringStatusMessage()}
            </span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link to="/repositories">
            <Button variant="secondary" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{repository.name}</h1>
            <p className="text-gray-600">{repository.url}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            loading={actionLoading && monitoringStatus === 'monitoring'}
            onClick={handleTriggerMonitoring}
            disabled={!repository.is_active}
            title={!repository.is_active ? "Monitoring is paused" : "Trigger monitoring now"}
          >
            <Play className="w-4 h-4 mr-2" />
            Monitor Now
          </Button>
          
          <Button
            variant={repository.is_active ? "secondary" : "primary"}
            loading={actionLoading}
            onClick={handleToggleActive}
          >
            {repository.is_active ? (
              <>
                <Pause className="w-4 h-4 mr-2" />
                Pause Monitoring
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Resume Monitoring
              </>
            )}
          </Button>
          
          <a href={repository.url} target="_blank" rel="noopener noreferrer">
            <Button variant="secondary">
              <ExternalLink className="w-4 h-4 mr-2" />
              View on GitHub
            </Button>
          </a>
          
          <Button
            variant="danger"
            loading={actionLoading}
            onClick={handleDelete}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Repository Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6">
          <div className="flex items-center space-x-3">
            <GitBranch className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-gray-500">Repository</p>
              <p className="text-lg font-semibold text-gray-900">{repository.name}</p>
            </div>
          </div>
        </div>
        
        <div className="card p-6">
          <div className="flex items-center space-x-3">
            <User className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-sm font-medium text-gray-500">Owner</p>
              <p className="text-lg font-semibold text-gray-900">{repository.owner}</p>
            </div>
          </div>
        </div>
        
        <div className="card p-6">
          <div className="flex items-center space-x-3">
            <Activity className="w-8 h-8 text-purple-600" />
            <div>
              <p className="text-sm font-medium text-gray-500">Status</p>
              <div className="flex items-center space-x-2">
                <StatusBadge status={repository.is_active ? 'active' : 'paused'} />
                <span className="text-sm text-gray-500">
                  {repository.is_active ? 'Monitoring active' : 'Monitoring paused'}
                </span>
              </div>
              {repository.last_monitored && (
                <p className="text-xs text-gray-400 mt-1">
                  Last monitored: {new Date(repository.last_monitored).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Monitoring Status Card */}
      {!repository.is_active && (
        <div className="card p-6 bg-yellow-50 border border-yellow-200">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-6 h-6 text-yellow-600" />
            <div>
              <h3 className="text-lg font-medium text-yellow-800">Monitoring Paused</h3>
              <p className="text-yellow-700">
                Automatic monitoring is currently paused for this repository. 
                You can still trigger manual monitoring or resume automatic monitoring.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Monitoring Results */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Monitoring Results</h2>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">
              {results.length} result{results.length !== 1 ? 's' : ''}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={refetchResults}
              loading={resultsLoading}
            >
              Refresh
            </Button>
          </div>
        </div>

        {resultsLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : resultsError ? (
          <div className="text-center py-8">
            <AlertCircle className="mx-auto h-8 w-8 text-red-500" />
            <p className="mt-2 text-red-600">Error loading results: {resultsError}</p>
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No monitoring results</h3>
            <p className="mt-2 text-gray-500">
              {repository.is_active 
                ? "Trigger monitoring to see results for this repository."
                : "Monitoring is paused. Resume monitoring or trigger manual monitoring to see results."
              }
            </p>
            <Button 
              onClick={handleTriggerMonitoring} 
              className="mt-4"
              disabled={!repository.is_active}
            >
              <Play className="w-4 h-4 mr-2" />
              Monitor Now
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {results.map((result) => (
              <div key={result.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(result.status)}
                    <StatusBadge status={result.status} />
                    <span className="text-sm text-gray-500">
                      {new Date(result.timestamp).toLocaleString()}
                    </span>
                  </div>
                  {result.fix_applied && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Fix Applied
                    </span>
                  )}
                </div>
                
                {result.root_cause && (
                  <div className="mb-3">
                    <p className="text-sm font-medium text-gray-700">Root Cause:</p>
                    <p className="text-sm text-gray-600 mt-1">{result.root_cause}</p>
                  </div>
                )}
                
                {result.error_message && (
                  <div className="mb-3">
                    <p className="text-sm font-medium text-red-700">Error:</p>
                    <p className="text-sm text-red-600 mt-1">{result.error_message}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  {result.failed_run_id && (
                    <div>
                      <span className="font-medium text-gray-700">Failed Run ID:</span>
                      <span className="ml-2 text-gray-600">{result.failed_run_id}</span>
                    </div>
                  )}
                  
                  {result.commit_sha && (
                    <div>
                      <span className="font-medium text-gray-700">Commit SHA:</span>
                      <span className="ml-2 text-gray-600 font-mono text-xs">
                        {result.commit_sha.slice(0, 8)}
                      </span>
                    </div>
                  )}
                  
                  {result.issue_url && (
                    <div>
                      <span className="font-medium text-gray-700">Issue:</span>
                      <a 
                        href={result.issue_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="ml-2 text-blue-600 hover:text-blue-800"
                      >
                        View Issue
                      </a>
                    </div>
                  )}
                </div>
                
                {result.logs_snippet && (
                  <div className="mt-3">
                    <p className="text-sm font-medium text-gray-700 mb-2">Logs Snippet:</p>
                    <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto max-h-32">
                      {result.logs_snippet}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RepositoryDetail;