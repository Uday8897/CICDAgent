// src/pages/Dashboard.jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  GitBranch, 
  Activity, 
  CheckCircle, 
  XCircle,
  Plus
} from 'lucide-react';
import StatsCard from '../components/Stats/StatsCard';
import { useApi } from '../hooks/useApi';
import { statsAPI, repositoriesAPI } from '../services/api';
import Button from '../components/UI/Button';
const Dashboard = () => {
  const { data: statsData, loading: statsLoading } = useApi(statsAPI.getStats);
  const { data: reposData, loading: reposLoading } = useApi(repositoriesAPI.getAll);
  
  const [recentActivity, setRecentActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);

  useEffect(() => {
    const fetchRecentActivity = async () => {
      if (reposData?.repositories?.length > 0) {
        setActivityLoading(true);
        try {
          const activities = [];
          // Get recent results from all monitoring results endpoint
          const allResultsResponse = await repositoriesAPI.getAllResults(10);
          const recentResults = allResultsResponse.data.results || [];
          
          // Map results with repository info
          for (const result of recentResults.slice(0, 5)) {
            const repo = reposData.repositories.find(r => r.id === result.repo_id);
            if (repo) {
              activities.push({
                ...result,
                repoName: repo.name
              });
            }
          }
          setRecentActivity(activities);
        } catch (error) {
          console.error('Error fetching recent activity:', error);
        } finally {
          setActivityLoading(false);
        }
      }
    };

    fetchRecentActivity();
  }, [reposData]);

  if (statsLoading || reposLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const stats = statsData || {};
  const repositories = reposData?.repositories || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <Link to="/repositories/add">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Repository
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Repositories"
          value={stats.total_repositories || 0}
          icon={GitBranch}
          trend="up"
        />
        <StatsCard
          title="Active Repositories"
          value={stats.active_repositories || 0}
          icon={Activity}
        />
        <StatsCard
          title="Successful Fixes"
          value={stats.successful_fixes || 0}
          icon={CheckCircle}
          trend="up"
        />
        <StatsCard
          title="Failures Detected"
          value={stats.failures_detected || 0}
          icon={XCircle}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <div className="space-y-4">
            {activityLoading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : recentActivity.length > 0 ? (
              recentActivity.map((activity, index) => (
                <div key={activity.id || index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-2 h-2 rounded-full ${
                      activity.status === 'success' ? 'bg-green-500' :
                      activity.status === 'failure' ? 'bg-red-500' : 'bg-yellow-500'
                    }`} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{activity.repoName}</p>
                      <p className="text-sm text-gray-500">
                        {activity.root_cause || activity.status || 'Monitoring completed'}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm text-gray-400">
                    {new Date(activity.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">No recent activity</p>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link
              to="/add-repository"
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <GitBranch className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Add Repository</p>
                  <p className="text-sm text-gray-500">Monitor a new GitHub repository</p>
                </div>
              </div>
            </Link>
            
            <Link
              to="/repositories"
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Activity className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">View All Repositories</p>
                  <p className="text-sm text-gray-500">Manage your monitored repositories</p>
                </div>
              </div>
            </Link>

            <Link
              to="/monitoring"
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Monitoring Results</p>
                  <p className="text-sm text-gray-500">View all monitoring results</p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;