import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

/**
 * Reusable Socket.io hook for connecting to the backend.
 * @param {string} url - The Socket.io server URL (optional, defaults to window.location)
 * @returns {{ socket, connected, emit, on, off }}
 */
export function useSocket(url) {
    const socketRef = useRef(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        const socket = io(url || window.location.origin, {
            transports: ['websocket', 'polling'],
            secure: true,
            rejectUnauthorized: false,
        });

        socket.on('connect', () => {
            console.log('[Socket] Connected:', socket.id);
            setConnected(true);
        });

        socket.on('disconnect', () => {
            console.log('[Socket] Disconnected');
            setConnected(false);
        });

        socket.on('connect_error', (err) => {
            console.error('[Socket] Connection error:', err.message);
        });

        socketRef.current = socket;

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [url]);

    const emit = useCallback((event, data) => {
        if (socketRef.current) {
            socketRef.current.emit(event, data);
        }
    }, []);

    const on = useCallback((event, handler) => {
        if (socketRef.current) {
            socketRef.current.on(event, handler);
        }
    }, []);

    const off = useCallback((event, handler) => {
        if (socketRef.current) {
            socketRef.current.off(event, handler);
        }
    }, []);

    return {
        socket: socketRef.current,
        connected,
        emit,
        on,
        off,
    };
}
