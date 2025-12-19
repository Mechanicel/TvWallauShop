// frontend/src/services/socket.ts

import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

/**
 * Erstellt (einmal) eine Socket.IO-Verbindung zum Backend
 * und gibt immer dieselbe Instanz zurück.
 */
export function getSocket(): Socket {
   if (!socket) {
      const baseUrl = import.meta.env.VITE_API_WS_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

      socket = io(baseUrl, {
         withCredentials: true,
      });

      socket.on('connect', () => {
         console.log('[WebSocket] Verbunden mit', baseUrl, 'ID:', socket?.id);
      });

      socket.on('disconnect', () => {
         console.log('[WebSocket] Getrennt');
      });
   }

   return socket;
}
