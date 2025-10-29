// src/pages/MonitoringResults.jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  GitBranch, 
  Filter,
  Search,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import Button from '../components/UI/Button';
import StatusBadge from '../components/UI/StatusBadge';
import { useApi } from '../hooks/useApi';
import { monitoringAPI, repositoriesAPI } from '../services/api';

const MonitoringResults = () => {
  const { data: reposData, loading: reposLoading } = useApi(repositoriesAPI.getAll);
  const { data: resultsData, loading: resultsLoading, refetch: refetchResults } = useApi(() => 
    monitoringAPI.getAllResults(100)
  );
  
  const [filteredResults, setFilteredResults] = useState([]);
  const [filters, setFilters] = useState({
    status: 'all',
    repository: 'all',
    search: ''
  });

  const repositories = reposData?.repositories || [];
  const allResults = resultsData?.results || [];

  // Debug logs to check data
  useEffect(() => {
    console.log('Repositories:', repositories);
    console.log('All Results:', allResults);
    console.log('Filtered Results:', filteredResults);
  }, [repositories, allResults, filteredResults]);

  useEffect(() => {
    let filtered = allResults;

    // Filter by status
    if (filters.status !== 'all') {
      filtered = filtered.filter(result => result.status === filters.status);
    }

    // Filter by repository
    if (filters.repository !== 'all') {
      console.log('Filtering by repository:', filters.repository);
      filtered = filtered.filter(result => {
        console.log('Result repo_id:', result.repo_id, 'Filter repo:', filters.repository);
        return result.repo_id === filters.repository;
      });
    }

    // Filter by search
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(result => {
        const repo = repositories.find(r => r.id === result.repo_id);
        return (
          repo?.name.toLowerCase().includes(searchLower) ||
          result.root_cause?.toLowerCase().includes(searchLower) ||
          result.error_message?.toLowerCase().includes(searchLower) ||
          result.status?.toLowerCase().includes(searchLower)
        );
      });
    }

    setFilteredResults(filtered);
  }, [filters, allResults, repositories]);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failure':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusCount = (status) => {
    return allResults.filter(result => result.status === status).length;
  };

  const getRepoName = (repoId) => {
    const repo = repositories.find(r => r.id === repoId);
    return repo?.name || 'Unknown Repository';
  };

  const getRepoById = (repoId) => {
    return repositories.find(r => r.id === repoId);
  };

  // How status is determined (from your backend):
  // - 'success': no failed_run_id found
  // - 'failure': failed_run_id found but fix may or may not be applied
  // - 'error': exception occurred during monitoring

  if (reposLoading || resultsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Monitoring Results</h1>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">
            Showing {filteredResults.length} of {allResults.length} results
          </span>
          <Button onClick={refetchResults} loading={resultsLoading}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{allResults.length}</div>
          <div className="text-sm text-gray-500">Total Runs</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{getStatusCount('success')}</div>
          <div className="text-sm text-gray-500">Successful</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{getStatusCount('failure')}</div>
          <div className="text-sm text-gray-500">Failures</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-yellow-600">{getStatusCount('error')}</div>
          <div className="text-sm text-gray-500">Errors</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by repo, error, or root cause..."
                className="input-field pl-10"
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              className="input-field"
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            >
              <option value="all">All Statuses</option>
              <option value="success">Success</option>
              <option value="failure">Failure</option>
              <option value="error">Error</option>
            </select>
          </div>

          {/* Repository Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Repository</label>
            <select
              className="input-field"
              value={filters.repository}
              onChange={(e) => setFilters(prev => ({ ...prev, repository: e.target.value }))}
            >
              <option value="all">All Repositories</option>
              {repositories.map(repo => (
                <option key={repo.id} value={repo.id}>
                  {repo.name}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Filters */}
          <div className="flex items-end">
            <Button
              variant="secondary"
              onClick={() => setFilters({ status: 'all', repository: 'all', search: '' })}
              className="w-full"
            >
              <Filter className="w-4 h-4 mr-2" />
              Clear Filters
            </Button>
          </div>
        </div>

        {/* Active Filters Display */}
        {(filters.status !== 'all' || filters.repository !== 'all' || filters.search) && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center space-x-2 text-sm text-blue-700">
              <span>Active filters:</span>
              {filters.status !== 'all' && (
                <span className="bg-blue-100 px-2 py-1 rounded">Status: {filters.status}</span>
              )}
              {filters.repository !== 'all' && (
                <span className="bg-blue-100 px-2 py-1 rounded">
                  Repository: {getRepoById(filters.repository)?.name || filters.repository}
                </span>
              )}
              {filters.search && (
                <span className="bg-blue-100 px-2 py-1 rounded">Search: "{filters.search}"</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Results List */}
      <div className="card p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Results ({filteredResults.length})
        </h2>

        {filteredResults.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No results found</h3>
            <p className="mt-2 text-gray-500">
              {allResults.length === 0 
                ? "No monitoring results available. Start monitoring your repositories to see results here."
                : "No results match your current filters. Try adjusting your filters."
              }
            </p>
            {allResults.length === 0 && (
              <Link to="/repositories" className="mt-4 inline-block">
                <Button>View Repositories</Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredResults.map((result) => {
              const repo = getRepoById(result.repo_id);
              return (
                <div key={result.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(result.status)}
                      <StatusBadge status={result.status} />
                      <Link 
                        to={`/repositories/${result.repo_id}`}
                        className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900"
                      >
                        <GitBranch className="w-4 h-4" />
                        <span>{repo?.name || 'Unknown Repository'}</span>
                        {repo && !repo.is_active && (
                          <span className="text-xs text-yellow-600 bg-yellow-100 px-2 py-1 rounded">
                            Paused
                          </span>
                        )}
                      </Link>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <span className="text-sm text-gray-500">
                        <Calendar className="w-4 h-4 inline mr-1" />
                        {new Date(result.timestamp).toLocaleString()}
                      </span>
                      {result.fix_applied && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Fix Applied
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    {result.root_cause && (
                      <div>
                        <span className="font-medium text-gray-700">Root Cause:</span>
                        <p className="text-gray-600 mt-1">{result.root_cause}</p>
                      </div>
                    )}
                    
                    {result.error_message && (
                      <div>
                        <span className="font-medium text-red-700">Error:</span>
                        <p className="text-red-600 mt-1">{result.error_message}</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      {result.failed_run_id && (
                        <span>Run ID: {result.failed_run_id}</span>
                      )}
                      {result.commit_sha && (
                        <span>Commit: {result.commit_sha?.slice(0, 8)}</span>
                      )}
                      <span className={`px-2 py-1 rounded text-xs ${
                        result.status === 'success' ? 'bg-green-100 text-green-800' :
                        result.status === 'failure' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {result.status}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {result.issue_url && (
                        <a 
                          href={result.issue_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          <ExternalLink className="w-4 h-4 inline mr-1" />
                          View Issue
                        </a>
                      )}
                      <Link 
                        to={`/repositories/${result.repo_id}`}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        View Details
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MonitoringResults;