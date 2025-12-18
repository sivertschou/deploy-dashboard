'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import Link from 'next/link';

interface VPS {
  id: number;
  name: string;
  ip_address: string;
  api_key: string;
  status: string;
  cpu_usage: number | null;
  memory_usage: number | null;
  disk_usage: number | null;
  last_seen: number | null;
}

export default function VPSPage() {
  const [vpsList, setVpsList] = useState<VPS[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showApiKey, setShowApiKey] = useState<string | null>(null);
  const [newVps, setNewVps] = useState({ name: '', ipAddress: '' });
  const [error, setError] = useState('');

  const fetchVps = async () => {
    try {
      const res = await fetch('/api/vps');
      const data = await res.json();
      setVpsList(data.vpsList || []);
    } catch (error) {
      console.error('Error fetching VPS:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVps();
    const interval = setInterval(fetchVps, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch('/api/vps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newVps),
      });

      const data = await res.json();

      if (res.ok) {
        setShowApiKey(data.vps.apiKey);
        setNewVps({ name: '', ipAddress: '' });
        fetchVps();
      } else {
        setError(data.error || 'Failed to add VPS');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this VPS?')) return;

    try {
      await fetch(`/api/vps/${id}`, { method: 'DELETE' });
      fetchVps();
    } catch (error) {
      console.error('Error deleting VPS:', error);
    }
  };

  const closeModal = () => {
    setShowAddModal(false);
    setShowApiKey(null);
    setError('');
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
        <div className="sm:flex sm:items-center sm:justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">VPS Servers</h1>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Add VPS Server
          </button>
        </div>

        {vpsList.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No VPS servers</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by adding a new VPS server.</p>
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {vpsList.map((vps) => (
                <li key={vps.id}>
                  <Link
                    href={`/vps/${vps.id}`}
                    className="block hover:bg-gray-50 transition duration-150"
                  >
                    <div className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-lg font-medium text-indigo-600 truncate">{vps.name}</p>
                            <div className="ml-2 flex-shrink-0 flex">
                              <span
                                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  vps.status === 'online'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {vps.status}
                              </span>
                            </div>
                          </div>
                          <div className="mt-2 sm:flex sm:justify-between">
                            <div className="sm:flex">
                              <p className="flex items-center text-sm text-gray-500">
                                {vps.ip_address}
                              </p>
                            </div>
                            <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                              <p>Last seen: {formatLastSeen(vps.last_seen)}</p>
                            </div>
                          </div>
                          {vps.status === 'online' && (
                            <div className="mt-2 flex gap-4 text-sm text-gray-500">
                              {vps.cpu_usage !== null && <span>CPU: {vps.cpu_usage.toFixed(1)}%</span>}
                              {vps.memory_usage !== null && (
                                <span>Memory: {vps.memory_usage.toFixed(1)}%</span>
                              )}
                              {vps.disk_usage !== null && <span>Disk: {vps.disk_usage.toFixed(1)}%</span>}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            handleDelete(vps.id);
                          }}
                          className="ml-4 px-3 py-1 text-sm text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(showAddModal || showApiKey) && (
          <div className="fixed z-10 inset-0 overflow-y-auto">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>
              <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    {showApiKey ? 'VPS Added Successfully' : 'Add VPS Server'}
                  </h3>
                  {showApiKey ? (
                    <div>
                      <p className="text-sm text-gray-600 mb-4">
                        Save this API key - it will only be shown once!
                      </p>
                      <div className="bg-gray-50 p-4 rounded border border-gray-200">
                        <code className="text-sm break-all">{showApiKey}</code>
                      </div>
                      <p className="text-sm text-gray-600 mt-4">
                        Use this API key when installing the agent on your VPS.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleAdd}>
                      {error && (
                        <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
                          {error}
                        </div>
                      )}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          VPS Name
                        </label>
                        <input
                          type="text"
                          required
                          value={newVps.name}
                          onChange={(e) => setNewVps({ ...newVps, name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="my-vps-1"
                        />
                      </div>
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          IP Address
                        </label>
                        <input
                          type="text"
                          required
                          value={newVps.ipAddress}
                          onChange={(e) => setNewVps({ ...newVps, ipAddress: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="192.168.1.1"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={closeModal}
                          className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 border border-gray-300 rounded-md"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md"
                        >
                          Add VPS
                        </button>
                      </div>
                    </form>
                  )}
                </div>
                {showApiKey && (
                  <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                    <button
                      onClick={closeModal}
                      className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 sm:ml-3 sm:w-auto sm:text-sm"
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
