/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { fetcher, API_BASE } from '../lib/api';

interface Repo {
  id: string;
  fullName: string;
  owner: string;
  name: string;
}

interface Installation {
  id: string;
  repos: Repo[];
}

interface Maintainer {
  id: string;
  username: string;
  avatarUrl: string;
  installations: Installation[];
}

interface AuthContextType {
  user: Maintainer | null;
  isLoading: boolean;
  logout: () => void;
  loginUrl: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useQuery<Maintainer>({
    queryKey: ['auth', 'me'],
    queryFn: () => fetcher('/auth/me', { credentials: 'include' }),
    retry: false, // Don't retry if 'me' fails (probably just not logged in)
  });

  const logoutMutation = useMutation({
    mutationFn: () => fetcher('/auth/logout', { method: 'POST', credentials: 'include' }),
    onSuccess: () => {
      window.location.href = '/';
    },
  });

  const value = {
    user: user ?? null,
    isLoading,
    logout: () => logoutMutation.mutate(),
    loginUrl: `${API_BASE}/auth/github`,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
