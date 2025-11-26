// src/pages/Settings.jsx
import { useState } from 'react';
import { 
  Settings as SettingsIcon,
  Bell,
  Shield,
  Database,
  RefreshCw,
  Save,
  Trash2
} from 'lucide-react';
import Button from '../components/UI/Button';

const Settings = () => {
  const [settings, setSettings] = useState({
    monitoring: {
      interval: 300,
      autoFix: true,
      createIssues: true,
      maxRetries: 3
    },
    notifications: {
      email: true,
      slack: false,
      webhook: false,
      onFailure: true,
      onFix: true,
      onError: false
    },
    security: {
      encryptTokens: true,
      autoLogout: 30,
      auditLog: true
    }
  });
  
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSaving(false);
    // In a real app, you would save to your backend
  };

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset all settings to default?')) {
      setSettings({
        monitoring: {
          interval: 300,
          autoFix: true,
          createIssues: true,
          maxRetries: 3
        },
        notifications: {
          email: true,
          slack: false,
          webhook: false,
          onFailure: true,
          onFix: true,
          onError: false
        },
        security: {
          encryptTokens: true,
          autoLogout: 30,
          auditLog: true
        }
      });
    }
  };

  const updateSetting = (section, key, value) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <div className="flex items-center space-x-2">
          <Button variant="secondary" onClick={handleReset}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset to Default
          </Button>
          <Button onClick={handleSave} loading={saving}>
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Monitoring Settings */}
      <div className="card p-6">
        <div className="flex items-center space-x-3 mb-6">
          <SettingsIcon className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">Monitoring Settings</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Monitoring Interval (seconds)
            </label>
            <input
              type="number"
              min="60"
              max="3600"
              className="input-field"
              value={settings.monitoring.interval}
              onChange={(e) => updateSetting('monitoring', 'interval', parseInt(e.target.value))}
            />
            <p className="text-sm text-gray-500 mt-1">
              How often to check repositories for failures (60-3600 seconds)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Maximum Retry Attempts
            </label>
            <input
              type="number"
              min="1"
              max="10"
              className="input-field"
              value={settings.monitoring.maxRetries}
              onChange={(e) => updateSetting('monitoring', 'maxRetries', parseInt(e.target.value))}
            />
            <p className="text-sm text-gray-500 mt-1">
              Number of times to retry failed monitoring attempts
            </p>
          </div>
        </div>

        <div className="space-y-4 mt-6">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">Automatic Fixes</label>
              <p className="text-sm text-gray-500">
                Automatically attempt to fix detected issues when possible
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.monitoring.autoFix}
              onChange={(e) => updateSetting('monitoring', 'autoFix', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">Create GitHub Issues</label>
              <p className="text-sm text-gray-500">
                Automatically create GitHub issues for unfixable problems
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.monitoring.createIssues}
              onChange={(e) => updateSetting('monitoring', 'createIssues', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="card p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Bell className="w-6 h-6 text-green-600" />
          <h2 className="text-xl font-semibold text-gray-900">Notification Settings</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">Email Notifications</label>
              <p className="text-sm text-gray-500">
                Receive notifications via email
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.notifications.email}
              onChange={(e) => updateSetting('notifications', 'email', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">Slack Integration</label>
              <p className="text-sm text-gray-500">
                Send notifications to Slack channels
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.notifications.slack}
              onChange={(e) => updateSetting('notifications', 'slack', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">Webhook Notifications</label>
              <p className="text-sm text-gray-500">
                Send notifications to custom webhook URLs
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.notifications.webhook}
              onChange={(e) => updateSetting('notifications', 'webhook', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Notification Triggers</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">On Workflow Failure</label>
                <p className="text-sm text-gray-500">
                  Notify when a workflow fails
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.notifications.onFailure}
                onChange={(e) => updateSetting('notifications', 'onFailure', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">On Automatic Fix</label>
                <p className="text-sm text-gray-500">
                  Notify when an automatic fix is applied
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.notifications.onFix}
                onChange={(e) => updateSetting('notifications', 'onFix', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">On System Error</label>
                <p className="text-sm text-gray-500">
                  Notify when the monitoring system encounters an error
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.notifications.onError}
                onChange={(e) => updateSetting('notifications', 'onError', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Security Settings */}
      <div className="card p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Shield className="w-6 h-6 text-red-600" />
          <h2 className="text-xl font-semibold text-gray-900">Security Settings</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">Encrypt Access Tokens</label>
              <p className="text-sm text-gray-500">
                Encrypt GitHub access tokens in the database
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.security.encryptTokens}
              onChange={(e) => updateSetting('security', 'encryptTokens', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">Auto Logout (minutes)</label>
              <p className="text-sm text-gray-500">
                Automatically log out after period of inactivity
              </p>
            </div>
            <input
              type="number"
              min="5"
              max="240"
              className="input-field w-20"
              value={settings.security.autoLogout}
              onChange={(e) => updateSetting('security', 'autoLogout', parseInt(e.target.value))}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">Audit Logging</label>
              <p className="text-sm text-gray-500">
                Log all system activities for security auditing
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.security.auditLog}
              onChange={(e) => updateSetting('security', 'auditLog', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
          </div>
        </div>
      </div>

      {/* Data Management */}
      <div className="card p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Database className="w-6 h-6 text-purple-600" />
          <h2 className="text-xl font-semibold text-gray-900">Data Management</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">Delete Old Monitoring Data</label>
              <p className="text-sm text-gray-500">
                Automatically delete monitoring results older than 90 days
              </p>
            </div>
            <Button variant="secondary">
              <Trash2 className="w-4 h-4 mr-2" />
              Cleanup Now
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">Export All Data</label>
              <p className="text-sm text-gray-500">
                Download all monitoring data as JSON
              </p>
            </div>
            <Button variant="secondary">
              Export Data
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;