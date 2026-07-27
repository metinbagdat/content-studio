import { useEffect, useState } from "react";
import { CalendarClock, Zap, Loader2, Send, Trash2, RotateCcw, ExternalLink, Twitter, Linkedin, AlertTriangle } from "lucide-react";
import apiClient, { apiError } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const platIcon = (p) => (p === "LinkedIn" ? <Linkedin className="w-3.5 h-3.5 text-[#0A66C2]" /> : <Twitter className="w-3.5 h-3.5 text-[#1DA1F2]" />);

function defaultDT() {
    const d = new Date(Date.now() + 10 * 60000);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
}

export default function Schedule() {
    const [data, setData] = useState({ unscheduled: [], timeline: [] });
    const [busy, setBusy] = useState(false);
    const [times, setTimes] = useState({});

    const load = () => apiClient.get("/schedule").then((r) => setData(r.data));
    useEffect(() => { load(); }, []);

    const wrap = async (fn, ok) => {
        setBusy(true);
        try { await fn(); ok && toast.success(ok); load(); }
        catch (e) { toast.error(apiError(e)); }
        finally { setBusy(false); }
    };

    const autoDistribute = () => wrap(async () => {
        const { data: r } = await apiClient.post("/schedule/auto");
        toast.success(`${r.scheduled} atom optimum saatlere dağıtıldı`);
    });
    const schedule = (id) => {
        const val = times[id] || defaultDT();
        wrap(() => apiClient.post(`/atoms/${id}/schedule`, { scheduled_at: new Date(val).toISOString() }), "Zamanlandı");
    };
    const unschedule = (id) => wrap(() => apiClient.post(`/atoms/${id}/unschedule`), "Zamanlamadan kaldırıldı");
    const publishNow = (id) => wrap(async () => { const { data: r } = await apiClient.post(`/atoms/${id}/publish`); if (r.url) window.open(r.url, "_blank"); }, "Yayınlandı");
    const retry = (id) => wrap(() => apiClient.post(`/atoms/${id}/schedule`, { scheduled_at: new Date().toISOString() }), "Tekrar kuyruğa alındı");

    const byDay = data.timeline.reduce((acc, a) => {
        const key = new Date(a.scheduled_at).toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" });
        (acc[key] = acc[key] || []).push(a);
        return acc;
    }, {});

    const statusOf = (a) => a.published ? { l: "Yayınlandı", c: "#27C281" } : a.dead ? { l: "Başarısız (DLQ)", c: "#E64C4C" } : { l: "Zamanlandı", c: "#F3B72C" };

    return (
        <div className="p-8 max-w-6xl">
            <div className="flex items-start justify-between mb-2 flex-wrap gap-4">
                <div>
                    <h1 className="font-heading text-3xl font-bold" data-testid="page-title">Takvim & Zamanlama</h1>
                    <p className="text-[#8A8F98] mt-1 text-sm">Onaylı atomları planla — publisher her dakika kontrol eder, hatada otomatik tekrar dener (3 deneme → DLQ)</p>
                </div>
                {data.unscheduled.length > 0 && (
                    <Button onClick={autoDistribute} disabled={busy} data-testid="auto-distribute-btn" className="bg-[#5E6AD2] hover:bg-[#7380E8]">
                        {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Zap className="w-4 h-4 mr-1" />}
                        {data.unscheduled.length} Atomu Otomatik Dağıt
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                {/* Unscheduled */}
                <div>
                    <h3 className="font-heading font-semibold mb-3 text-sm text-[#8A8F98] uppercase tracking-wide">Planlanmayı Bekleyen ({data.unscheduled.length})</h3>
                    <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1" data-testid="unscheduled-list">
                        {data.unscheduled.length === 0 && <p className="text-sm text-[#8A8F98] py-6">Onaylı sosyal atom yok. İnceleme Kuyruğu'ndan atom üretip onaylayın.</p>}
                        {data.unscheduled.map((a) => (
                            <div key={a.id} className="bg-[#191A1B] border border-[#2A2E33] rounded-lg p-3" data-testid={`unscheduled-${a.id}`}>
                                <div className="flex items-center gap-2 mb-2">
                                    {platIcon(a.platform)}
                                    <span className="text-xs font-medium truncate">{a.label} #{a.index + 1}</span>
                                    <span className="text-[10px] text-[#8A8F98] truncate ml-auto">{a.article_title?.slice(0, 24)}</span>
                                </div>
                                <p className="text-xs text-white/70 line-clamp-2 mb-2">{a.content}</p>
                                <div className="flex items-center gap-2">
                                    <input type="datetime-local" defaultValue={defaultDT()} onChange={(e) => setTimes((t) => ({ ...t, [a.id]: e.target.value }))} data-testid={`time-${a.id}`} className="bg-[#0f1011] border border-[#2A2E33] rounded-md text-xs px-2 py-1.5 text-white flex-1" />
                                    <Button size="sm" onClick={() => schedule(a.id)} disabled={busy} data-testid={`schedule-${a.id}`} className="h-8 px-3 text-xs bg-[#5E6AD2] hover:bg-[#7380E8]"><CalendarClock className="w-3 h-3 mr-1" />Zamanla</Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Timeline */}
                <div>
                    <h3 className="font-heading font-semibold mb-3 text-sm text-[#8A8F98] uppercase tracking-wide">Yayın Takvimi ({data.timeline.length})</h3>
                    <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1" data-testid="timeline">
                        {data.timeline.length === 0 && <p className="text-sm text-[#8A8F98] py-6">Henüz zamanlanmış atom yok.</p>}
                        {Object.entries(byDay).map(([day, items]) => (
                            <div key={day}>
                                <div className="text-xs font-semibold text-[#7380E8] mb-2 sticky top-0 bg-[#0f1011] py-1">{day}</div>
                                <div className="space-y-2">
                                    {items.map((a) => {
                                        const st = statusOf(a);
                                        return (
                                            <div key={a.id} className="bg-[#191A1B] border border-[#2A2E33] rounded-lg p-3" data-testid={`timeline-${a.id}`}>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-xs text-[#8A8F98]">{new Date(a.scheduled_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</span>
                                                    {platIcon(a.platform)}
                                                    <span className="text-xs font-medium truncate">{a.label} #{a.index + 1}</span>
                                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded ml-auto shrink-0" style={{ background: `${st.c}22`, color: st.c }}>{st.l}</span>
                                                </div>
                                                <p className="text-xs text-white/60 line-clamp-1 mt-1.5">{a.content}</p>
                                                {a.dead && a.last_error && <p className="flex items-center gap-1 text-[10px] text-[#E64C4C] mt-1"><AlertTriangle className="w-3 h-3" /> {a.last_error}</p>}
                                                <div className="flex gap-1.5 mt-2">
                                                    {a.published ? (
                                                        <a href={a.publish_url} target="_blank" rel="noreferrer" data-testid={`timeline-link-${a.id}`} className="flex items-center gap-1 text-[10px] text-[#27C281] hover:underline"><ExternalLink className="w-3 h-3" /> Görüntüle</a>
                                                    ) : (
                                                        <>
                                                            <Button size="sm" onClick={() => publishNow(a.id)} disabled={busy} data-testid={`publish-now-${a.id}`} className="h-6 px-2 text-[10px] bg-[#27C281]/15 text-[#27C281] hover:bg-[#27C281]/25"><Send className="w-3 h-3 mr-1" />Şimdi</Button>
                                                            {a.dead && <Button size="sm" onClick={() => retry(a.id)} disabled={busy} data-testid={`retry-${a.id}`} className="h-6 px-2 text-[10px] bg-[#F3B72C]/15 text-[#F3B72C] hover:bg-[#F3B72C]/25"><RotateCcw className="w-3 h-3 mr-1" />Tekrar</Button>}
                                                            <Button size="sm" onClick={() => unschedule(a.id)} disabled={busy} data-testid={`unschedule-${a.id}`} className="h-6 px-2 text-[10px] bg-[#2A2E33] hover:bg-[#3a3f45]"><Trash2 className="w-3 h-3" /></Button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
