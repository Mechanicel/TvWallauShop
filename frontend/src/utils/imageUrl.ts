// frontend/src/utils/imageUrl.ts

import { API_BASE_URL } from './constants';

// API_BASE_URL ist z.B. "http://localhost:3000/api"
// Wir schneiden das "/api" hinten ab, um die Backend-Base-URL zu bekommen.
const BACKEND_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, '');

export function resolveImageUrl(imageUrl: string | null | undefined): string {
  if (!imageUrl) {
    // Fallback – passe den Pfad ggf. an deine Struktur an
    return '/assets/placeholder.png';
  }

  // Wenn bereits eine absolute URL kommt, nichts verändern
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }

  // Relativen Pfad an die Backend-Base anhängen
  return `${BACKEND_BASE_URL}${imageUrl}`;
}
