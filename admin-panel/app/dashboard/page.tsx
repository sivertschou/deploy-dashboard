'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import Link from 'next/link';

interface VPS {
  id: number;
  name: string;
  ip_address: string;
  status: string;
  cpu_usage: number | null;
  memory_usage: number | null;
  disk_usage: number | null;
  last_seen: number | null;
}

interface Deployment {
  id: number;
  vps_id: number;
  name: string;
  status: string;
  created_at: number;
  deployed_at: number | null;
}

export default function DashboardPage() {
  const [vpsList, setVpsList] = useState<VPS[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [vpsRes, deploymentsRes] = await Promise.all([
          fetch('/api/vps'),
          fetch('/api/deployments'),
        ]);

        const vpsData = await vpsRes.json();
        const deploymentsData = await deploymentsRes.json();

        setVpsList(vpsData.vpsList || []);
        setDeployments(deploymentsData.deployments?.slice(0, 5) || []);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-100 text-green-800';
      case 'offline':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getDeploymentStatusColor = (status: string) => {
    switch (status) {
      case 'deployed':
        return 'bg-green-100 text-green-800';
      case 'deploying':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatLastSeen = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const seconds = Math.floor(Date.now() / 1000 - timestamp);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  if (loading) {
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
      <div className="px-4 sm:px-0">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total VPS</dt>
                    <dd className="text-lg font-medium text-gray-900">{vpsList.length}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Online VPS</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {vpsList.filter((v) => v.status === 'online').length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Deployments</dt>
                    <dd className="text-lg font-medium text-gray-900">{deployments.length}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg leading-6 font-medium text-gray-900">VPS Servers</h3>
            </div>
            <div className="px-4 py-5 sm:p-6">
              {vpsList.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">No VPS servers configured</p>
                  <Link
                    href="/vps"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    Add VPS Server
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {vpsList.map((vps) => (
                    <div key={vps.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">{vps.name}</h4>
                        <p className="text-sm text-gray-500">{vps.ip_address}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Last seen: {formatLastSeen(vps.last_seen)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                            vps.status
                          )}`}
                        >
                          {vps.status}
                        </span>
                        {vps.status === 'online' && (
                          <div className="mt-2 text-xs text-gray-500">
                            {vps.cpu_usage !== null && <div>CPU: {vps.cpu_usage.toFixed(1)}%</div>}
                            {vps.memory_usage !== null && <div>RAM: {vps.memory_usage.toFixed(1)}%</div>}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <Link
                    href="/vps"
                    className="block text-center text-sm text-indigo-600 hover:text-indigo-500 mt-4"
                  >
                    View all VPS servers
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Deployments</h3>
            </div>
            <div className="px-4 py-5 sm:p-6">
              {deployments.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">No deployments yet</p>
                  <Link
                    href="/deployments"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    Create Deployment
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {deployments.map((deployment) => (
                    <div key={deployment.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">{deployment.name}</h4>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatDate(deployment.created_at)}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDeploymentStatusColor(
                          deployment.status
                        )}`}
                      >
                        {deployment.status}
                      </span>
                    </div>
                  ))}
                  <Link
                    href="/deployments"
                    className="block text-center text-sm text-indigo-600 hover:text-indigo-500 mt-4"
                  >
                    View all deployments
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
