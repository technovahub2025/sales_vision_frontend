function normalizeApiBaseUrl(value) {
  const base = String(value || '').trim().replace(/\/*$/, '');
  if (!base) return 'http://localhost:3001/api';
  return base.endsWith('/api') ? base : `${base}/api`;
}

const apiBaseUrl = normalizeApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:3001',
);

function joinUrl(path) {
  return `${apiBaseUrl}${path}`;
}

export async function request(path, options = {}) {
  const response = await fetch(joinUrl(path), {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.success === false) {
    const message = payload?.message || `Request failed (${response.status})`;
    throw new Error(message);
  }

  return payload.data;
}

