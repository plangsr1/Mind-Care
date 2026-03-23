import React, { createContext, useState, useContext, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
 // Use the correct import for modern versions

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true); // NEW: Loading state

    useEffect(() => {
        setIsLoading(true);
        try {
            if (token) {
                const decodedUser = jwtDecode(token);
                // Check if token is expired
                if (decodedUser.exp * 1000 < Date.now()) {
                    localStorage.removeItem('token');
                    setToken(null);
                    setUser(null);
                } else {
                    setUser(decodedUser);
                }
            } else {
                setUser(null);
            }
        } catch (error) {
            console.error("Invalid or expired token", error);
            localStorage.removeItem('token');
            setToken(null);
            setUser(null);
        } finally {
            setIsLoading(false); // Done checking, set loading to false
        }
    }, [token]);

    const login = (newToken) => {
        localStorage.setItem('token', newToken);
        setToken(newToken);
    };

    const logout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ token, user, isLoading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    return useContext(AuthContext);
};

