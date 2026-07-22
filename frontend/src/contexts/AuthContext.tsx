import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'user';
  company?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, refresh_token: string) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('access_token'));
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('access_token');
      if (storedToken) {
        try {
          const res = await fetch('/auth/me', {
            headers: { Authorization: `Bearer ${storedToken}` }
          });
          if (res.ok) {
            setUser(await res.json());
            setToken(storedToken);
          } else {
            // Try refresh token logic in a real app, here we just logout
            logout();
          }
        } catch (e) {
          logout();
        }
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  const login = async (newToken: string, refreshToken: string) => {
    localStorage.setItem('access_token', newToken);
    localStorage.setItem('refresh_token', refreshToken);
    setToken(newToken);
    
    // Fetch user details
    const res = await fetch('/auth/me', {
      headers: { Authorization: `Bearer ${newToken}` }
    });
    if (res.ok) {
      setUser(await res.json());
      navigate('/');
    } else {
      logout();
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setToken(null);
    setUser(null);
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
