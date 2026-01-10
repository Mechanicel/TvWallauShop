// frontend/src/utils/imageUrl.ts

import { API_BASE_URL, API_BASE_PATH, VERSIONED_API_BASE_PATH } from '@/contracts';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const stripSuffix = (url: string, suffix: string) =>
   url.replace(new RegExp(`${escapeRegExp(suffix)}\\/?$`), '');
const BACKEND_BASE_URL = stripSuffix(stripSuffix(API_BASE_URL, VERSIONED_API_BASE_PATH), API_BASE_PATH);

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
