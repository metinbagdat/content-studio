import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Layers, CheckCircle2, Clock, Type, ImageIcon, Music } from "lucide-react";
import apiClient from "@/lib/apiClient";

function Stat({ icon: Icon, label, value, hint }) {
    return (
        <div className="bg-[#191A1B] border border-[#2A2E33] rounded-lg p-5" data-testid={`stat-${label}`}>
            <div className="flex items-center justify-between">
                <span className="text-xs text-[#8A8F98] uppercase tracking-wide">{label}</span>
                <Icon className="w-4 h-4 text-[#5E6AD2]" />
            </div>
            <div className="font-heading text-3xl font-bold mt-3">{value}</div>
            {hint && <div className="text-xs text-[#8A8F98] mt-1">{hint}</div>}
        </div>
    );
}

export default function Dashboard() {
    const [stats, setStats] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        apiClient.get("/dashboard/stats").then((r) => setStats(r.data));
    }, []);

    if (!stats) return <div className="p-8 text-[#8A8F98]">Yükleniyor...</div>;
    const s = stats.atoms_by_status;
    const q = stats.quota_today;

    return (
        <div className="p-8 max-w-6xl">
            <div className="mb-8">
                <h1 className="font-heading text-3xl font-bold" data-testid="page-title">Panel</h1>
                <p className="text-[#8A8F98] mt-1">İçerik atomizasyon ve üretim genel bakış</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <Stat icon={FileText} label="Makaleler" value={stats.total_articles} hint={`${stats.analyzed_articles} analiz edildi`} />
                <Stat icon={Layers} label="Toplam Atom" value={stats.total_atoms} />
                <Stat icon={CheckCircle2} label="Onaylı" value={s.approved} />
                <Stat icon={Clock} label="İnceleme Bekleyen" value={s.review} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-[#191A1B] border border-[#2A2E33] rounded-lg p-6">
                    <h3 className="font-heading font-semibold mb-4">Atom Durumları</h3>
                    <div className="space-y-3">
                        {[["Taslak", s.draft, "#8A8F98"], ["İnceleme", s.review, "#F3B72C"], ["Onaylı", s.approved, "#27C281"], ["Reddedildi", s.rejected, "#E64C4C"]].map(([l, v, c]) => {
                            const pct = stats.total_atoms ? (v / stats.total_atoms) * 100 : 0;
                            return (
                                <div key={l}>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-[#8A8F98]">{l}</span>
                                        <span className="font-mono">{v}</span>
                                    </div>
                                    <div className="h-1.5 rounded-full bg-[#0f1011] overflow-hidden">
                                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: c }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="bg-[#191A1B] border border-[#2A2E33] rounded-lg p-6">
                    <h3 className="font-heading font-semibold mb-4">Bugünkü Kota Kullanımı</h3>
                    <div className="space-y-4 font-mono text-sm">
                        <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-[#8A8F98]"><Type className="w-4 h-4" /> Gemini Metin</span><span>{q.gemini_text}</span></div>
                        <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-[#8A8F98]"><ImageIcon className="w-4 h-4" /> Gemini Görsel</span><span>{q.gemini_image}</span></div>
                        <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-[#8A8F98]"><Music className="w-4 h-4" /> OpenAI TTS</span><span>{q.openai_tts}</span></div>
                    </div>
                    <button onClick={() => navigate("/articles")} data-testid="cta-add-article" className="mt-6 w-full py-2.5 rounded-md bg-[#5E6AD2] hover:bg-[#7380E8] transition-colors duration-200 text-sm font-medium">
                        Makale Ekle & Atomize Et
                    </button>
                </div>
            </div>
        </div>
    );
}
