// src/components/UI/StatusBadge.jsx
const StatusBadge = ({ status }) => {
  const statusConfig = {
    success: { color: 'bg-green-100 text-green-800', label: 'Success' },
    failure: { color: 'bg-red-100 text-red-800', label: 'Failure' },
    error: { color: 'bg-yellow-100 text-yellow-800', label: 'Error' },
    active: { color: 'bg-green-100 text-green-800', label: 'Active' },
    inactive: { color: 'bg-gray-100 text-gray-800', label: 'Inactive' },
  };

  const config = statusConfig[status] || statusConfig.inactive;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
};

export default StatusBadge;