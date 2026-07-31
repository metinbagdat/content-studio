import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Layers, CheckCircle2, Send, Type, ImageIcon, Music, ArrowRight, Twitter, Linkedin, Plus } from "lucide-react";
import apiClient from "@/lib/apiClient";

function Stat({ icon: Icon, label, value, hint, accent }) {
    return (
        <div className="bg-[#191A1B] border border-[#2A2E33] rounded-xl p-5 relative overflow-hidden" data-testid={`stat-${label}`}>
            <div className="absolute top-0 left-0 w-full h-0.5" style={{ background: accent }} />
            <div className="flex items-center justify-between">
                <span className="text-xs text-[#8A8F98] uppercase tracking-wide">{label}</span>
                <Icon className="w-4 h-4" style={{ color: accent }} />
            </div>
            <div className="font-heading text-4xl font-bold mt-3">{value}</div>
            {hint && <div className="text-xs text-[#8A8F98] mt-1">{hint}</div>}
        </div>
    );
}

export default function Dashboard() {
    const [stats, setStats] = useState(null);
    const [articles, setArticles] = useState([]);
    const [social, setSocial] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        apiClient.get("/dashboard/stats").then((r) => setStats(r.data));
        apiClient.get("/articles").then((r) => setArticles(r.data.slice(0, 5)));
        apiClient.get("/social/status").then((r) => setSocial(r.data)).catch(() => {});
    }, []);

    if (!stats) return <div className="p-8 text-[#8A8F98]">Yükleniyor...</div>;
    const s = stats.atoms_by_status;
    const q = stats.quota_today;

    return (
        <div className="p-8 max-w-6xl">
            <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
                <div>
                    <h1 className="font-heading text-4xl font-bold" data-testid="page-title">Panel</h1>
                    <p className="text-[#8A8F98] mt-1">İçerik atomizasyon ve üretim genel bakışı</p>
                </div>
                <button onClick={() => navigate("/articles")} data-testid="cta-add-article" className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#5E6AD2] hover:bg-[#7380E8] transition-colors duration-200 text-sm font-medium">
                    <Plus className="w-4 h-4" /> Makale Ekle & Atomize Et
                </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <Stat icon={FileText} label="Makaleler" value={stats.total_articles} hint={`${stats.analyzed_articles} analiz edildi`} accent="#5E6AD2" />
                <Stat icon={Layers} label="Toplam Atom" value={stats.total_atoms} accent="#7380E8" />
                <Stat icon={CheckCircle2} label="Onaylı" value={s.approved} hint="Yayına hazır" accent="#27C281" />
                <Stat icon={Send} label="Yayınlanan" value={stats.published || 0} accent="#1DA1F2" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-[#191A1B] border border-[#2A2E33] rounded-xl p-6">
                    <h3 className="font-heading font-semibold mb-4">Atom Durumları</h3>
                    <div className="space-y-4">
                        {[["Taslak", s.draft, "#8A8F98"], ["İnceleme", s.review, "#F3B72C"], ["Onaylı", s.approved, "#27C281"], ["Reddedildi", s.rejected, "#E64C4C"]].map(([l, v, c]) => {
                            const pct = stats.total_atoms ? (v / stats.total_atoms) * 100 : 0;
                            return (
                                <div key={l}>
                                    <div className="flex justify-between text-sm mb-1.5">
                                        <span className="text-[#8A8F98]">{l}</span>
                                        <span className="font-mono">{v}</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-[#0f1011] overflow-hidden">
                                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: c }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <h3 className="font-heading font-semibold mt-8 mb-3">Son Makaleler</h3>
                    <div className="space-y-1">
                        {articles.length === 0 && <p className="text-sm text-[#8A8F98]">Henüz makale yok.</p>}
                        {articles.map((a) => (
                            <button key={a.id} onClick={() => navigate(`/articles/${a.id}`)} data-testid={`recent-article-${a.id}`} className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-[#0f1011] transition-colors duration-200 text-left group">
                                <span className="text-sm truncate">{a.title}</span>
                                <span className="flex items-center gap-2 shrink-0 text-xs text-[#8A8F98]">
                                    {a.atom_count} atom
                                    <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-[#5E6AD2]" />
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-[#191A1B] border border-[#2A2E33] rounded-xl p-6">
                        <h3 className="font-heading font-semibold mb-4">Bağlı Hesaplar</h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="flex items-center gap-2 text-sm text-[#8A8F98]"><Twitter className="w-4 h-4 text-[#1DA1F2]" /> Twitter/X</span>
                                <span className={`text-xs font-medium ${social?.twitter?.connected ? "text-[#27C281]" : "text-[#E64C4C]"}`}>{social?.twitter?.connected ? "Bağlı" : "Yok"}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="flex items-center gap-2 text-sm text-[#8A8F98]"><Linkedin className="w-4 h-4 text-[#0A66C2]" /> LinkedIn</span>
                                <span className={`text-xs font-medium ${social?.linkedin?.connected ? "text-[#27C281]" : "text-[#8A8F98]"}`}>{social?.linkedin?.connected ? "Bağlı" : "Yok"}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#191A1B] border border-[#2A2E33] rounded-xl p-6">
                        <h3 className="font-heading font-semibold mb-4">Bugünkü Kota</h3>
                        <div className="space-y-3 font-mono text-sm">
                            <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-[#8A8F98]"><Type className="w-4 h-4" /> Metin</span><span>{q.gemini_text}</span></div>
                            <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-[#8A8F98]"><ImageIcon className="w-4 h-4" /> Görsel</span><span>{q.gemini_image}</span></div>
                            <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-[#8A8F98]"><Music className="w-4 h-4" /> Ses</span><span>{q.openai_tts}</span></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
