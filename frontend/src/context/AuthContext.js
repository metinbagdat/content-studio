import { createContext, useContext, useEffect, useState } from "react";
import apiClient from "@/lib/apiClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null); // null = checking, false = anon, obj = auth
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem("cs_token");
        if (!token) {
            setUser(false);
            setLoading(false);
            return;
        }
        apiClient
            .get("/auth/me")
            .then((res) => setUser(res.data))
            .catch(() => {
                localStorage.removeItem("cs_token");
                setUser(false);
            })
            .finally(() => setLoading(false));
    }, []);

    const login = (token, userData) => {
        localStorage.setItem("cs_token", token);
        setUser(userData);
    };

    const logout = () => {
        localStorage.removeItem("cs_token");
        setUser(false);
        window.location.href = "/login";
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
