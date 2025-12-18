'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import Link from 'next/link';

interface Deployment {
  id: number;
  vps_id: number;
  name: string;
  status: string;
  created_at: number;
  deployed_at: number | null;
}

interface VPS {
  id: number;
  name: string;
  status: string;
}

export default function DeploymentsPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [vpsList, setVpsList] = useState<VPS[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    vpsId: '',
    name: '',
    dockerCompose: '',
    envVars: '',
  });
  const [error, setError] = useState('');

  const fetchData = async () => {
    try {
      const [deploymentsRes, vpsRes] = await Promise.all([
        fetch('/api/deployments'),
        fetch('/api/vps'),
      ]);
      const deploymentsData = await deploymentsRes.json();
      const vpsData = await vpsRes.json();
      setDeployments(deploymentsData.deployments || []);
      setVpsList(vpsData.vpsList || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const envVars = formData.envVars
        ? Object.fromEntries(
            formData.envVars.split('\n').map((line) => {
              const [key, ...values] = line.split('=');
              return [key.trim(), values.join('=').trim()];
            })
          )
        : {};

      const res = await fetch(`/api/vps/${formData.vpsId}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          dockerCompose: formData.dockerCompose,
          envVars,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setShowModal(false);
        setFormData({ vpsId: '', name: '', dockerCompose: '', envVars: '' });
        fetchData();
      } else {
        setError(data.error || 'Failed to create deployment');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    }
  };

  const getVpsName = (vpsId: number) => {
    const vps = vpsList.find((v) => v.id === vpsId);
    return vps?.name || 'Unknown';
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
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
        <div className="sm:flex sm:items-center sm:justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Deployments</h1>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            New Deployment
          </button>
        </div>

        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {deployments.map((deployment) => (
              <li key={deployment.id}>
                <Link
                  href={`/deployments/${deployment.id}`}
                  className="block hover:bg-gray-50 px-4 py-4 sm:px-6"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-lg font-medium text-indigo-600">{deployment.name}</p>
                        <span
                          className={`px-2 text-xs font-semibold rounded-full ${
                            deployment.status === 'deployed'
                              ? 'bg-green-100 text-green-800'
                              : deployment.status === 'deploying'
                              ? 'bg-blue-100 text-blue-800'
                              : deployment.status === 'failed'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {deployment.status}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-gray-500">
                        <p>VPS: {getVpsName(deployment.vps_id)}</p>
                        <p>Created: {formatDate(deployment.created_at)}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {showModal && (
          <div className="fixed z-10 inset-0 overflow-y-auto">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75"></div>
              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
                <form onSubmit={handleSubmit}>
                  <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Create Deployment</h3>
                    {error && (
                      <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
                        {error}
                      </div>
                    )}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          VPS Server
                        </label>
                        <select
                          required
                          value={formData.vpsId}
                          onChange={(e) => setFormData({ ...formData, vpsId: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        >
                          <option value="">Select VPS</option>
                          {vpsList
                            .filter((vps) => vps.status === 'online')
                            .map((vps) => (
                              <option key={vps.id} value={vps.id}>
                                {vps.name}
                              </option>
                            ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Deployment Name
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          placeholder="my-app"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Docker Compose YAML
                        </label>
                        <textarea
                          required
                          rows={10}
                          value={formData.dockerCompose}
                          onChange={(e) => setFormData({ ...formData, dockerCompose: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm"
                          placeholder="version: '3.8'..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Environment Variables (optional)
                        </label>
                        <textarea
                          rows={4}
                          value={formData.envVars}
                          onChange={(e) => setFormData({ ...formData, envVars: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm"
                          placeholder="KEY=value"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                    <button
                      type="submit"
                      className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 sm:ml-3 sm:w-auto"
                    >
                      Deploy
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-gray-700 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
