import React, { useState, useEffect } from 'react';
import { useAuth } from '@chat-app/shared/hooks/useAuth';
import { useSocket } from '@chat-app/shared/hooks/useSocket';
import { AuthScreen, ChatLayout } from '@chat-app/ui';
import './App.css';

function App() {
    const { isAuthenticated, loading } = useAuth();
    const { socket, connected } = useSocket();
    const [ready, setReady] = useState(false);

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
