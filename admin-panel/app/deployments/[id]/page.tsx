'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';

export default function DeploymentDetailPage() {
  const params = useParams();
  const [deployment, setDeployment] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const [depRes, logsRes] = await Promise.all([
        fetch(`/api/deployments/${params.id}`),
        fetch(`/api/deployments/${params.id}/logs`),
      ]);
      const depData = await depRes.json();
      const logsData = await logsRes.json();
      setDeployment(depData.deployment);
      setLogs(logsData.logs || []);
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [params.id]);

  if (!deployment) return <DashboardLayout><div>Loading...</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="px-4">
        <h1 className="text-3xl font-bold mb-4">{deployment.name}</h1>
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm text-gray-500">Status</dt>
              <dd className="text-lg font-medium">{deployment.status}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Created</dt>
              <dd className="text-lg">{new Date(deployment.created_at * 1000).toLocaleString()}</dd>
            </div>
          </dl>
        </div>
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Deployment Logs</h2>
          <div className="bg-gray-900 text-gray-100 p-4 rounded font-mono text-sm max-h-96 overflow-y-auto">
            {logs.map((log) => (
              <div key={log.id} className="mb-1">
                <span className="text-gray-500">[{new Date(log.timestamp * 1000).toLocaleTimeString()}]</span>{' '}
                <span className={log.level === 'error' ? 'text-red-400' : ''}>{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
