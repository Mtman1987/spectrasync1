

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ManualLoginForm() {
  const [discordId, setDiscordId] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discordId, username }),
      });

      if (response.ok) {
        router.push('/dashboard');
        router.refresh();
      } else {
        const data = await response.json();
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 max-w-sm mx-auto">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
          {error}
        </div>
      )}
      <input
        type="text"
        placeholder="Discord ID"
        value={discordId}
        onChange={(e) => setDiscordId(e.target.value)}
        className="w-full px-3 py-2 border rounded text-sm text-black"
        required
      />
      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        className="w-full px-3 py-2 border rounded text-sm text-black"
        required
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full px-4 py-2 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 disabled:opacity-50"
      >
        {loading ? 'Logging in...' : 'Manual Login'}
      </button>
    </form>
  );
}
