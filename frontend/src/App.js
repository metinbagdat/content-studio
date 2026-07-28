import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Articles from "@/pages/Articles";
import ArticleDetail from "@/pages/ArticleDetail";
import ReviewQueue from "@/pages/ReviewQueue";
import Schedule from "@/pages/Schedule";
import Analytics from "@/pages/Analytics";
import Observability from "@/pages/Observability";

function Protected({ children }) {
    const { user, loading } = useAuth();
    if (loading)
        return (
            <div className="flex h-screen items-center justify-center bg-[#0f1011] text-[#8A8F98]">
                Yükleniyor...
            </div>
        );
    if (!user) return <Navigate to="/login" replace />;
    return <Layout>{children}</Layout>;
}

function App() {
    return (
        <div className="App">
            <AuthProvider>
                <BrowserRouter>
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/" element={<Protected><Dashboard /></Protected>} />
                        <Route path="/articles" element={<Protected><Articles /></Protected>} />
                        <Route path="/articles/:id" element={<Protected><ArticleDetail /></Protected>} />
                        <Route path="/review" element={<Protected><ReviewQueue /></Protected>} />
                        <Route path="/schedule" element={<Protected><Schedule /></Protected>} />
                        <Route path="/analytics" element={<Protected><Analytics /></Protected>} />
                        <Route path="/observability" element={<Protected><Observability /></Protected>} />
                    </Routes>
                </BrowserRouter>
                <Toaster position="top-right" theme="dark" />
            </AuthProvider>
        </div>
    );
}

export default App;
