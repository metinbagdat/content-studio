import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Loader2 } from "lucide-react";
import apiClient, { apiError } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Login() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState("admin@egitim.today");
    const [password, setPassword] = useState("admin123");
    const [loading, setLoading] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { data } = await apiClient.post("/auth/login", { email, password });
            login(data.token, data.user);
            navigate("/");
        } catch (err) {
            toast.error(apiError(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0f1011] flex">
            <div
                className="hidden lg:block w-1/2 bg-cover bg-center relative"
                style={{ backgroundImage: "url(https://images.unsplash.com/photo-1578662996442-48f60103fc96?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200)" }}
            >
                <div className="absolute inset-0 bg-[#0f1011]/60" />
                <div className="absolute bottom-12 left-12 right-12">
                    <h2 className="font-heading text-4xl font-bold leading-tight">İçerik Atomizasyon & Otomatik Yayın</h2>
                    <p className="text-[#8A8F98] mt-3">Bir makaleyi 50+ içerik parçasına dönüştür, onayla, dağıt.</p>
                </div>
            </div>

            <div className="flex-1 flex items-center justify-center p-8">
                <form onSubmit={submit} className="w-full max-w-sm space-y-6" data-testid="login-form">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-md bg-[#5E6AD2] flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <div className="font-heading font-bold text-lg leading-none">content-studio</div>
                            <div className="text-[10px] text-[#8A8F98] uppercase tracking-[0.15em] mt-1">eğitim.today</div>
                        </div>
                    </div>

                    <div>
                        <h1 className="font-heading text-2xl font-bold">Yönetici Girişi</h1>
                        <p className="text-sm text-[#8A8F98] mt-1">Devam etmek için giriş yapın</p>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="email" className="text-xs text-[#8A8F98] uppercase tracking-wide">E-posta</Label>
                            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="login-email" className="bg-[#191A1B] border-[#2A2E33] h-11" required />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="password" className="text-xs text-[#8A8F98] uppercase tracking-wide">Şifre</Label>
                            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} data-testid="login-password" className="bg-[#191A1B] border-[#2A2E33] h-11" required />
                        </div>
                    </div>

                    <Button type="submit" disabled={loading} data-testid="login-submit" className="w-full h-11 bg-[#5E6AD2] hover:bg-[#7380E8] font-medium">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Giriş Yap"}
                    </Button>
                </form>
            </div>
        </div>
    );
}
