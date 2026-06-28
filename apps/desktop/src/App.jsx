import React, { useState, useEffect } from 'react';
import { useAuth } from '@chat-app/shared/hooks/useAuth';
import { useSocket } from '@chat-app/shared/hooks/useSocket';
import AuthScreen from './components/AuthScreen';
import ChatLayout from './components/ChatLayout';
import './App.css';

function App() {
    const { isAuthenticated, loading } = useAuth();
    const { socket, connected } = useSocket();
    const [ready, setReady] = useState(false);
    console.log("/app authentication : ", isAuthenticated);
    useEffect(() => {
        if (!loading) {
            setReady(true);
        }
    }, [loading]);

    if (!ready) {
        return (
            <div className="loading-screen">
                <div className="loading-spinner"></div>
                <p>Loading ChatApp...</p>
            </div>
        );
    }

    return (
        <div className="app">
            {!isAuthenticated ? (
                <AuthScreen />
            ) : (
                <ChatLayout socket={socket} connected={connected} />
            )}
        </div>
    );
}

export default App;
