import { useState, useEffect } from 'react';

export const useAuth = () => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    // Initialize from localStorage
    useEffect(() => {
        console.log("LOCAL STORAGE DATA : ", localStorage);
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');
        if (storedToken && storedUser) {
            try {
                setToken(storedToken);
                setUser(JSON.parse(storedUser));
            } catch {
                // Corrupted data — clear it and start fresh
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            }
        }
        setLoading(false);
    }, []);

    // Listen for auth changes from other parts of the app
    useEffect(() => {
        const handleAuthChange = () => {
            console.log("LOCAL STORAGE DATA (authChange) : ", localStorage);
            const newToken = localStorage.getItem('token');
            const newUser = localStorage.getItem('user');
            setToken(newToken);
            setUser(newUser ? JSON.parse(newUser) : null);
        };
        window.addEventListener('authChange', handleAuthChange);
        return () => window.removeEventListener('authChange', handleAuthChange);
    }, []);

    const login = (userData, authToken, refreshToken) => {
        localStorage.setItem('token', authToken);
        localStorage.setItem('user', JSON.stringify(userData));
        if (refreshToken) {
            localStorage.setItem('refreshToken', refreshToken);
        }
        setToken(authToken);
        setUser(userData);
        window.dispatchEvent(new Event('authChange'));
    };

    const logout = () => {
        console.log("LOCAL STORAGE DATA (logout) : ", localStorage);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('email');
        localStorage.removeItem('password');
        setToken(null);
        setUser(null);
        window.dispatchEvent(new Event('authChange'));
    };

    const updateUser = (userData) => {
        console.log("LOCAL STORAGE DATA (updateUser) : ", localStorage);
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
        window.dispatchEvent(new Event('authChange'));
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
