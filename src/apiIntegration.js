import { apiUrl } from './api';

export async function generateShortenerResponse(prompt) {
  const res = await fetch(apiUrl('/api/generate'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to generate response');
  }

  return typeof data.content === 'string' ? data.content : data;
}
