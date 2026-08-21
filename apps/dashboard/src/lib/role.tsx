'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Role = 'admin' | 'user';

export interface Auth {
 role: Role;
 userId: string;
 userName: string;
 orgId: string | null; // null for admins (they see all orgs)
 orgName: string | null;
}

const DEFAULT_AUTH: Auth = {
 role: 'user',
 userId: 'usr_sarah',
 userName: 'Sarah Chen',
 orgId: 'org_a',
 orgName: 'Acme Construction',
};

const AuthContext = createContext<{
 auth: Auth;
 setAuth: (a: Auth) => void;
} | null>(null);

const STORAGE_KEY = 'sthyra-auth';

export function AuthProvider({ children }: { children: ReactNode }) {
 const [auth, setAuthState] = useState<Auth>(DEFAULT_AUTH);

 useEffect(() => {
 try {
 const raw = localStorage.getItem(STORAGE_KEY);
 if (raw) setAuthState(JSON.parse(raw));
 } catch {}
 }, []);

 const setAuth = (a: Auth) => {
 setAuthState(a);
 try {
 localStorage.setItem(STORAGE_KEY, JSON.stringify(a));
 document.cookie = `sthyra-role=${a.role}; path=/; max-age=31536000`;
 document.cookie = `sthyra-org=${a.orgId ?? ''}; path=/; max-age=31536000`;
 } catch {}
 };

 return (
 <AuthContext.Provider value={{ auth, setAuth }}>
 {children}
 </AuthContext.Provider>
 );
}

export function useAuth() {
 const ctx = useContext(AuthContext);
 if (!ctx) throw new Error('useAuth must be inside AuthProvider');
 return ctx;
}

export function isAdmin(auth: Auth): boolean {
 return auth.role === 'admin';
}
