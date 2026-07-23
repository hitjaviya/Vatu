// Mobile useSocket hook — mirrors packages/shared/hooks/useSocket.js with AsyncStorage
import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventEmitter } from '../EventEmitter';

import { API_URL } from '../api';

const SOCKET_URL = API_URL.replace(/\/api$/, '');

export const useSocket = () => {
    const [socket, setSocket] = useState(null);
    const [connected, setConnected] = useState(false);
    const socketRef = useRef(null);

    useEffect(() => {
        const initSocket = async () => {
            const token = await AsyncStorage.getItem('token');

            if (!token) {
                if (socketRef.current) {
                    socketRef.current.close();
                    socketRef.current = null;
                    setSocket(null);
                    setConnected(false);
                }
                return;
            }

            if (socketRef.current && socketRef.current.connected) return;

            const newSocket = io(SOCKET_URL, {
                transports: ['websocket'],
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
            });

            socketRef.current = newSocket;
            setSocket(newSocket);

            newSocket.on('connect', () => {
                newSocket.emit('authenticate', token);
            });

            newSocket.on('disconnect', () => setConnected(false));

            newSocket.on('authenticated', () => setConnected(true));

            newSocket.on('auth:error', async () => {
                setConnected(false);
                const hasToken = !!(await AsyncStorage.getItem('token'));
                if (hasToken) {
                    await AsyncStorage.multiRemove(['token', 'user', 'refreshToken']);
                    EventEmitter.emit('authChange');
                }
            });
        };

        initSocket();

        const handleAuthChange = () => {
            if (socketRef.current) {
                socketRef.current.close();
                socketRef.current = null;
            }
            initSocket();
        };
        const unsubscribe = EventEmitter.on('authChange', handleAuthChange);

        return () => {
            unsubscribe();
            if (socketRef.current) socketRef.current.close();
        };
    }, []);

    return { socket, connected };
};

export default useSocket;
