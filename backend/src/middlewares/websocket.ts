// backend/src/websocket.ts
import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';

let io: Server | null = null;

export function initWebsocket(server: HttpServer) {
    io = new Server(server, {
        cors: {
            origin: 'http://localhost:3001', // dein Frontend
            methods: ['GET', 'POST'],
            credentials: true,
        },
    });

    io.on('connection', (socket) => {
        console.log('[WebSocket] Client connected:', socket.id);

        socket.on('disconnect', () => {
            console.log('[WebSocket] Client disconnected:', socket.id);
        });
    });

    console.log('[WebSocket] Socket.IO initialisiert');

    return io;
}

export function getIO(): Server {
    if (!io) {
        throw new Error(
            'Socket.io wurde noch nicht initialisiert. Ruf initWebsocket(server) in deiner Server-Setup-Datei auf.',
        );
    }
    return io;
}
