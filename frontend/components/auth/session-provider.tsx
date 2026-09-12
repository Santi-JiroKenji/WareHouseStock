"use client";
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, request } from '@/lib/inventory-api';

type User = {
    username: string;
    displayName: string
};

type Session = {
    user: User | null; loading: boolean; error: string;
    refresh: () => Promise<void>;
    login: (username: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
};

const Context = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            setUser(await request<User>('/auth/me')); setError('');
        }
        catch (e) {
            setUser(null);
            setError(e instanceof ApiError && e.status === 401 ? '' : e instanceof Error ? e.message : 'ตรวจสอบการเข้าสู่ระบบไม่ได้');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void refresh();
        const expired = () => { setUser(null); setError(''); };
        window.addEventListener('stockflow:unauthorized', expired);
        return () => window.removeEventListener('stockflow:unauthorized', expired);
    }, [refresh]);

    async function login(username: string, password: string) {
        const nextUser = await request<User>('/auth/login', { username, password });
        setUser(nextUser); setError('');
    }

    async function logout() {
        try { await request('/auth/logout', {}); }
        catch (e) { if (!(e instanceof ApiError && e.status === 401)) throw e; }
        setUser(null); setError('');
    }

    return <Context.Provider value={{ user, loading, error, refresh, login, logout }}>{children}</Context.Provider>;
}

export function useSession() {
    const session = useContext(Context);
    if (!session) throw new Error('SessionProvider is required');
    return session;
}

export function RequireSession({ children }: { children: React.ReactNode }) {
    const { user, loading, error, refresh } = useSession();
    const router = useRouter();
    useEffect(() => { if (!loading && !user && !error) router.replace('/login'); }, [loading, user, error, router]);
    if (loading || !user) return <div className="session-screen" role="status"><strong>StockFlow</strong>{error ? <><p role="alert">{error}</p><button className="button" onClick={() => void refresh()}>ลองเชื่อมต่ออีกครั้ง</button></> : <p>กำลังตรวจสอบการเข้าสู่ระบบ...</p>}</div>;
    return children;
}
