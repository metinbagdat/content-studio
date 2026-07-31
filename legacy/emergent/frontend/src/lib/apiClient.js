import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const apiClient = axios.create({ baseURL: API });

apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem("cs_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

apiClient.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401 && !window.location.pathname.includes("/login")) {
            localStorage.removeItem("cs_token");
            window.location.href = "/login";
        }
        return Promise.reject(err);
    }
);

export function apiError(err) {
    const detail = err.response?.data?.detail;
    if (detail == null) return err.message || "Bir hata oluştu";
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map((e) => e?.msg || JSON.stringify(e)).join(" ");
    return String(detail);
}

export default apiClient;
