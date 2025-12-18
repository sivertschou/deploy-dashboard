'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import Link from 'next/link';

export default function VPSDetailPage() {
  const params = useParams();
  const [vps, setVps] = useState<any>(null);
  const [deployments, setDeployments] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const [vpsRes, deploymentsRes] = await Promise.all([
        fetch(`/api/vps/${params.id}`),
        fetch(`/api/deployments`),
      ]);
      const vpsData = await vpsRes.json();
      const deploymentsData = await deploymentsRes.json();

      setVps(vpsData.vps);
      setDeployments(
        deploymentsData.deployments?.filter((d: any) => d.vps_id === parseInt(params.id as string)) || []
      );
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [params.id]);

  if (!vps) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="px-4">
        <div className="mb-6">
          <Link href="/vps" className="text-indigo-600 hover:text-indigo-500">
            ← Back to VPS List
          </Link>
        </div>

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">{vps.name}</h1>
          <p className="text-gray-500">{vps.ip_address}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Status</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-gray-500">Status</dt>
                <dd>
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      vps.status === 'online'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {vps.status}
                  </span>
                </dd>
              </div>
              {vps.status === 'online' && (
                <>
                  <div>
                    <dt className="text-sm text-gray-500">CPU Usage</dt>
                    <dd className="text-lg font-medium">
                      {vps.cpu_usage !== null ? `${vps.cpu_usage.toFixed(1)}%` : 'N/A'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Memory Usage</dt>
                    <dd className="text-lg font-medium">
                      {vps.memory_usage !== null ? `${vps.memory_usage.toFixed(1)}%` : 'N/A'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Disk Usage</dt>
                    <dd className="text-lg font-medium">
                      {vps.disk_usage !== null ? `${vps.disk_usage.toFixed(1)}%` : 'N/A'}
                    </dd>
                  </div>
                </>
              )}
              <div>
                <dt className="text-sm text-gray-500">Last Seen</dt>
                <dd className="text-lg">
                  {vps.last_seen
                    ? new Date(vps.last_seen * 1000).toLocaleString()
                    : 'Never'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Deployments</h2>
            {deployments.length === 0 ? (
              <p className="text-gray-500">No deployments yet</p>
            ) : (
              <ul className="space-y-3">
                {deployments.map((deployment) => (
                  <li key={deployment.id}>
                    <Link
                      href={`/deployments/${deployment.id}`}
                      className="block p-3 border rounded hover:bg-gray-50"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{deployment.name}</span>
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            deployment.status === 'deployed'
                              ? 'bg-green-100 text-green-800'
                              : deployment.status === 'deploying'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {deployment.status}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-6 bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Configuration</h2>
          <div className="bg-gray-50 p-4 rounded border">
            <p className="text-sm text-gray-600 mb-2">API Key (keep secure):</p>
            <code className="text-sm break-all">{vps.api_key}</code>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            Use this API key when installing the agent on this VPS.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
