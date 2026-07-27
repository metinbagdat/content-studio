import { useEffect, useState } from "react";
import { RefreshCw, Twitter, Linkedin, CheckCircle2, XCircle } from "lucide-react";
import apiClient from "@/lib/apiClient";

export default function Observability() {
    const [jobs, setJobs] = useState([]);
    const [quotas, setQuotas] = useState([]);
    const [social, setSocial] = useState(null);

    const load = () => {
        apiClient.get("/jobs").then((r) => setJobs(r.data));
        apiClient.get("/quotas").then((r) => setQuotas(r.data));
        apiClient.get("/social/status").then((r) => setSocial(r.data)).catch(() => {});
    };
    useEffect(() => { load(); }, []);

    return (
        <div className="p-8 max-w-6xl">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="font-heading text-3xl font-bold" data-testid="page-title">Gözlemlenebilirlik</h1>
                    <p className="text-[#8A8F98] mt-1">Üretim job logları ve kota takibi</p>
                </div>
                <button onClick={load} data-testid="refresh-btn" className="flex items-center gap-1.5 text-sm text-[#8A8F98] hover:text-white transition-colors duration-200">
                    <RefreshCw className="w-4 h-4" /> Yenile
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6" data-testid="social-status">
                <div className="bg-[#191A1B] border border-[#2A2E33] rounded-lg p-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Twitter className="w-5 h-5 text-[#1DA1F2]" />
                        <div>
                            <div className="font-heading font-semibold text-sm">Twitter / X</div>
                            <div className="text-xs text-[#8A8F98]">
                                {social?.twitter?.connected ? `@${social.twitter.username}` : social?.twitter?.error || "Bağlı değil"}
                            </div>
                        </div>
                    </div>
                    {social?.twitter?.connected ? (
                        <span className="flex items-center gap-1 text-xs text-[#27C281]" data-testid="twitter-connected"><CheckCircle2 className="w-4 h-4" /> Bağlı</span>
                    ) : (
                        <span className="flex items-center gap-1 text-xs text-[#E64C4C]"><XCircle className="w-4 h-4" /> Yok</span>
                    )}
                </div>
                <div className="bg-[#191A1B] border border-[#2A2E33] rounded-lg p-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Linkedin className="w-5 h-5 text-[#0A66C2]" />
                        <div>
                            <div className="font-heading font-semibold text-sm">LinkedIn</div>
                            <div className="text-xs text-[#8A8F98]">{social?.linkedin?.configured ? "Yapılandırıldı" : "Key bekleniyor"}</div>
                        </div>
                    </div>
                    <span className="flex items-center gap-1 text-xs text-[#8A8F98]"><XCircle className="w-4 h-4" /> Yok</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-[#191A1B] border border-[#2A2E33] rounded-lg p-5">
                    <h3 className="font-heading font-semibold mb-4">Job Logları</h3>
                    <div className="space-y-1 font-mono text-xs max-h-[520px] overflow-y-auto" data-testid="job-logs">
                        {jobs.length === 0 && <div className="text-[#8A8F98] py-8 text-center">Henüz job yok</div>}
                        {jobs.map((j) => (
                            <div key={j.id} className="flex items-start gap-3 py-2 border-b border-[#2A2E33]/50">
                                <span className={`shrink-0 ${j.status === "success" ? "text-[#27C281]" : "text-[#E64C4C]"}`}>
                                    {j.status === "success" ? "OK " : "ERR"}
                                </span>
                                <span className="text-[#5E6AD2] shrink-0">{j.type}</span>
                                <span className="text-white/70 flex-1 truncate">{j.message}</span>
                                <span className="text-[#8A8F98] shrink-0">{new Date(j.created_at).toLocaleTimeString("tr-TR")}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-[#191A1B] border border-[#2A2E33] rounded-lg p-5">
                    <h3 className="font-heading font-semibold mb-4">Günlük Kota</h3>
                    <div className="space-y-3 font-mono text-xs" data-testid="quota-list">
                        {quotas.length === 0 && <div className="text-[#8A8F98] py-8 text-center">Veri yok</div>}
                        {quotas.map((q) => (
                            <div key={q.date} className="border-b border-[#2A2E33]/50 pb-3">
                                <div className="text-[#8A8F98] mb-1.5">{q.date}</div>
                                <div className="flex justify-between"><span>Gemini Metin</span><span>{q.gemini_text || 0}</span></div>
                                <div className="flex justify-between"><span>Gemini Görsel</span><span>{q.gemini_image || 0}</span></div>
                                <div className="flex justify-between"><span>OpenAI TTS</span><span>{q.openai_tts || 0}</span></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
