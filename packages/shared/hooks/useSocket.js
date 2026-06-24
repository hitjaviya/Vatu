import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

// Use environment variable - automatically switches between dev and production
const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

export const useSocket = () => {
    const [socket, setSocket] = useState(null);
    const [connected, setConnected] = useState(false);
    const socketRef = useRef(null);

    useEffect(() => {
        const initSocket = () => {
            const token = localStorage.getItem('token');

            // If no token, disconnect any existing socket
            if (!token) {
                if (socketRef.current) {
                    socketRef.current.close();
                    socketRef.current = null;
                    setSocket(null);
                    setConnected(false);
                }
                return;
            }

            // Don't create a new socket if one already exists and is connected
            if (socketRef.current && socketRef.current.connected) {
                return;
            }

            // Create socket connection
            const newSocket = io(SOCKET_URL, {
                transports: ['websocket'],
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
            });

            socketRef.current = newSocket;
            setSocket(newSocket);

            // Connection events
            newSocket.on('connect', () => {
                console.log('Socket connected');
                // Don't set connected to true yet, wait for authentication

                // Authenticate socket
                newSocket.emit('authenticate', token);
            });

            newSocket.on('disconnect', () => {
                console.log('Socket disconnected');
                setConnected(false);
            });

            newSocket.on('authenticated', (data) => {
                console.log('Socket authenticated:', data);
                // Now we can set connected to true
                setConnected(true);
            });

            newSocket.on('auth:error', (error) => {
                console.error('Socket auth error:', error);
                setConnected(false);
                
                // If socket authentication fails, clear invalid session and force redirect to login
                const hasToken = !!localStorage.getItem('token');
                if (hasToken) {
                    console.warn('Socket authentication failed. Clearing invalid session token...');
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    localStorage.removeItem('refreshToken');
                    window.dispatchEvent(new Event('authChange'));
                }
            });
        };

        // Initialize socket on mount
        initSocket();

        // Listen for auth changes
        const handleAuthChange = () => {
            console.log('Auth changed, reinitializing socket...');
            // Close existing socket if any
            if (socketRef.current) {
                socketRef.current.close();
                socketRef.current = null;
            }
            // Reinitialize
            initSocket();
        };

        window.addEventListener('authChange', handleAuthChange);

        // Cleanup on unmount
        return () => {
            window.removeEventListener('authChange', handleAuthChange);
            if (socketRef.current) {
                socketRef.current.close();
            }
        };
    }, []); // Empty dependency array - we handle changes via events

    return { socket, connected };
};

export default useSocket;
