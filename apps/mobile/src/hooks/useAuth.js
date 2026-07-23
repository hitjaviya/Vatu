// Mobile useAuth hook — mirrors packages/shared/hooks/useAuth.js with AsyncStorage
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventEmitter } from '../EventEmitter';

export const useAuth = () => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    // Initialize from AsyncStorage
    useEffect(() => {
        const loadAuth = async () => {
            try {
                const storedToken = await AsyncStorage.getItem('token');
                const storedUser = await AsyncStorage.getItem('user');
                if (storedToken && storedUser) {
                    setToken(storedToken);
                    setUser(JSON.parse(storedUser));
                }
            } catch {
                await AsyncStorage.multiRemove(['token', 'user']);
            }
            setLoading(false);
        };
        loadAuth();
    }, []);

    // Listen for auth changes
    useEffect(() => {
        const handleAuthChange = async () => {
            const newToken = await AsyncStorage.getItem('token');
            const newUser = await AsyncStorage.getItem('user');
            setToken(newToken);
            setUser(newUser ? JSON.parse(newUser) : null);
        };
        const unsubscribe = EventEmitter.on('authChange', handleAuthChange);
        return unsubscribe;
    }, []);

    const login = async (userData, authToken, refreshToken) => {
        await AsyncStorage.setItem('token', authToken);
        await AsyncStorage.setItem('user', JSON.stringify(userData));
        if (refreshToken) await AsyncStorage.setItem('refreshToken', refreshToken);
        setToken(authToken);
        setUser(userData);
        EventEmitter.emit('authChange');
    };

    const logout = async () => {
        await AsyncStorage.multiRemove(['token', 'user', 'refreshToken']);
        setToken(null);
        setUser(null);
        EventEmitter.emit('authChange');
    };

    const updateUser = async (userData) => {
        await AsyncStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
        EventEmitter.emit('authChange');
    };

    return {
        user,
        token,
        loading,
        isAuthenticated: !!token,
        login,
        logout,
        updateUser,
    };
};

export default useAuth;
