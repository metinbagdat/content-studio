import { useEffect, useState } from "react";
import { Send, CalendarClock, AlertTriangle, TrendingUp, Lightbulb, RotateCcw, Loader2 } from "lucide-react";
import apiClient, { apiError } from "@/lib/apiClient";
import { toast } from "sonner";

const PLATFORM_COLOR = { "Twitter/X": "#1DA1F2", LinkedIn: "#0A66C2", Instagram: "#E1306C", Facebook: "#1877F2", Pinterest: "#E60023", YouTube: "#FF0000", Podcast: "#8B5CF6", Müzik: "#22C55E" };

function Bars({ data, colorFn, max, testid }) {
    const entries = Object.entries(data);
    const m = max || Math.max(1, ...entries.map(([, v]) => v));
    return (
        <div className="space-y-2" data-testid={testid}>
            {entries.length === 0 && <p className="text-sm text-[#8A8F98]">Veri yok</p>}
            {entries.map(([k, v]) => (
                <div key={k}>
                    <div className="flex justify-between text-xs mb-1"><span className="text-[#8A8F98] truncate">{k}</span><span className="font-mono">{v}</span></div>
                    <div className="h-2 rounded-full bg-[#0f1011] overflow-hidden"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${(v / m) * 100}%`, background: colorFn ? colorFn(k) : "#5E6AD2" }} /></div>
                </div>
            ))}
        </div>
    );
}

function Card({ icon: Icon, label, value, accent }) {
    return (
        <div className="bg-[#191A1B] border border-[#2A2E33] rounded-xl p-5 relative overflow-hidden" data-testid={`analytics-stat-${label}`}>
            <div className="absolute top-0 left-0 w-full h-0.5" style={{ background: accent }} />
            <div className="flex items-center justify-between"><span className="text-xs text-[#8A8F98] uppercase tracking-wide">{label}</span><Icon className="w-4 h-4" style={{ color: accent }} /></div>
            <div className="font-heading text-4xl font-bold mt-3">{value}</div>
        </div>
    );
}

export default function Analytics() {
    const [a, setA] = useState(null);
    const [busy, setBusy] = useState(false);

    const load = () => apiClient.get("/analytics").then((r) => setA(r.data));
    useEffect(() => { load(); }, []);

    const retry = async (id) => {
        setBusy(true);
        try { await apiClient.post(`/atoms/${id}/schedule`, { scheduled_at: new Date().toISOString() }); toast.success("Tekrar kuyruğa alındı"); load(); }
        catch (e) { toast.error(apiError(e)); }
        finally { setBusy(false); }
    };

    if (!a) return <div className="p-8 text-[#8A8F98]">Yükleniyor...</div>;
    const topTypes = Object.fromEntries(Object.entries(a.by_type).sort((x, y) => y[1] - x[1]).slice(0, 8));
    const hourMax = Math.max(1, ...Object.values(a.by_hour));

    return (
        <div className="p-8 max-w-6xl">
            <div className="mb-8">
                <h1 className="font-heading text-3xl font-bold" data-testid="page-title">Analitik & Geri Besleme</h1>
                <p className="text-[#8A8F98] mt-1 text-sm">Yayın performansı ve blueprint önerileri</p>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
                <Card icon={Send} label="Yayınlanan" value={a.published_total} accent="#27C281" />
                <Card icon={CalendarClock} label="Zamanlanmış" value={a.scheduled_total} accent="#F3B72C" />
                <Card icon={AlertTriangle} label="Başarısız (DLQ)" value={a.failed_total} accent="#E64C4C" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-[#191A1B] border border-[#2A2E33] rounded-xl p-6">
                    <h3 className="font-heading font-semibold mb-4">Platforma Göre Yayın</h3>
                    <Bars data={a.by_platform} colorFn={(k) => PLATFORM_COLOR[k] || "#5E6AD2"} testid="bars-platform" />
                </div>
                <div className="bg-[#191A1B] border border-[#2A2E33] rounded-xl p-6">
                    <h3 className="font-heading font-semibold mb-4">İçerik Türüne Göre (Top 8)</h3>
                    <Bars data={topTypes} testid="bars-type" />
                </div>
            </div>

            <div className="bg-[#191A1B] border border-[#2A2E33] rounded-xl p-6 mb-6">
                <h3 className="font-heading font-semibold mb-4">Saate Göre Yayın (IST)</h3>
                <div className="flex items-end gap-1 h-32" data-testid="bars-hour">
                    {Object.entries(a.by_hour).map(([h, v]) => (
                        <div key={h} className="flex-1 flex flex-col items-center justify-end group">
                            <div className="w-full rounded-t bg-[#5E6AD2] transition-all duration-500 group-hover:bg-[#7380E8]" style={{ height: `${(v / hourMax) * 100}%`, minHeight: v ? "3px" : "0" }} title={`${h}:00 → ${v}`} />
                            <span className="text-[8px] text-[#8A8F98] mt-1">{h}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-[#191A1B] border border-[#2A2E33] rounded-xl p-6">
                    <h3 className="font-heading font-semibold mb-4 flex items-center gap-2"><Lightbulb className="w-4 h-4 text-[#F3B72C]" /> Blueprint Önerileri</h3>
                    <ul className="space-y-2" data-testid="feedback-list">
                        {a.feedback.map((f, i) => (
                            <li key={i} className="flex gap-2 text-sm text-white/85"><TrendingUp className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#27C281]" />{f}</li>
                        ))}
                    </ul>
                </div>
                <div className="bg-[#191A1B] border border-[#2A2E33] rounded-xl p-6">
                    <h3 className="font-heading font-semibold mb-4 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-[#E64C4C]" /> Dead Letter Queue ({a.dlq.length})</h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto" data-testid="dlq-list">
                        {a.dlq.length === 0 && <p className="text-sm text-[#8A8F98]">Başarısız yayın yok 🎉</p>}
                        {a.dlq.map((d) => (
                            <div key={d.id} className="flex items-center gap-2 bg-[#0f1011] border border-[#2A2E33] rounded-md p-2">
                                <div className="min-w-0 flex-1">
                                    <div className="text-xs font-medium truncate">{d.platform} · {d.label} #{d.index + 1}</div>
                                    <div className="text-[10px] text-[#E64C4C] truncate">{d.last_error}</div>
                                </div>
                                <button onClick={() => retry(d.id)} disabled={busy} data-testid={`dlq-retry-${d.id}`} className="shrink-0 flex items-center gap-1 text-[10px] text-[#F3B72C] hover:underline">
                                    {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />} Tekrar
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
