const origin = window.location.origin;
const devBackend = origin.includes(':5173') ? origin.replace(/:5173$/, ':5000') : origin;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || devBackend;

export function apiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL.replace(/\/$/, '')}${normalizedPath}`;
}

export function apiRedirectUrl(shortCode) {
  return `${API_BASE_URL.replace(/\/$/, '')}/${shortCode}`;
}
