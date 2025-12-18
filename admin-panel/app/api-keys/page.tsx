'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newKey, setNewKey] = useState({ name: '', key: '' });
  const [name, setName] = useState('');

  const fetchKeys = async () => {
    const res = await fetch('/api/api-keys');
    const data = await res.json();
    setApiKeys(data.apiKeys || []);
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    setNewKey({ name: data.apiKey.name, key: data.apiKey.key });
    setName('');
    fetchKeys();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this API key?')) return;
    await fetch(`/api/api-keys/${id}`, { method: 'DELETE' });
    fetchKeys();
  };

  return (
    <DashboardLayout>
      <div className="px-4">
        <div className="flex justify-between mb-8">
          <h1 className="text-3xl font-bold">API Keys</h1>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Create API Key
          </button>
        </div>

        <div className="bg-white shadow rounded-lg">
          <ul className="divide-y">
            {apiKeys.map((key) => (
              <li key={key.id} className="px-6 py-4 flex justify-between items-center">
                <div>
                  <p className="font-medium">{key.name}</p>
                  <p className="text-sm text-gray-500">
                    Created: {new Date(key.created_at * 1000).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(key.id)}
                  className="text-red-600 hover:text-red-900"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </div>

        {(showModal || newKey.key) && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-lg w-full">
              {newKey.key ? (
                <div>
                  <h3 className="text-lg font-bold mb-4">API Key Created</h3>
                  <p className="text-sm text-gray-600 mb-4">Save this key - it will only be shown once!</p>
                  <div className="bg-gray-50 p-4 rounded border">
                    <code className="text-sm break-all">{newKey.key}</code>
                  </div>
                  <button
                    onClick={() => {
                      setNewKey({ name: '', key: '' });
                      setShowModal(false);
                    }}
                    className="mt-4 w-full px-4 py-2 bg-indigo-600 text-white rounded-md"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <form onSubmit={handleCreate}>
                  <h3 className="text-lg font-bold mb-4">Create API Key</h3>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Key name"
                    className="w-full px-3 py-2 border rounded-md mb-4"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="flex-1 px-4 py-2 border rounded-md"
                    >
                      Cancel
                    </button>
                    <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md">
                      Create
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
