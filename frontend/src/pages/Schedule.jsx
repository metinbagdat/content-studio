import { useEffect, useState } from "react";
import { CalendarClock, Zap, Loader2, Send, Trash2, RotateCcw, ExternalLink, Twitter, Linkedin, AlertTriangle, GripVertical, CheckCircle2 } from "lucide-react";
import apiClient, { apiError } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const platIcon = (p) => (p === "LinkedIn" ? <Linkedin className="w-3.5 h-3.5 text-[#0A66C2]" /> : <Twitter className="w-3.5 h-3.5 text-[#1DA1F2]" />);

function localDT(offsetMin = 10) {
    const d = new Date(Date.now() + offsetMin * 60000);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
}

export default function Schedule() {
    const [data, setData] = useState({ unscheduled: [], timeline: [] });
    const [busy, setBusy] = useState(false);
    const [times, setTimes] = useState({});
    const [dragId, setDragId] = useState(null);
    const [dragOver, setDragOver] = useState(null);

    const load = () => apiClient.get("/schedule").then((r) => setData(r.data));
    useEffect(() => { load(); }, []);

    const wrap = async (fn, ok) => {
        setBusy(true);
        try { await fn(); ok && toast.success(ok); await load(); }
        catch (e) { toast.error(apiError(e)); }
        finally { setBusy(false); }
    };

    const autoDistribute = () => wrap(async () => { const { data: r } = await apiClient.post("/schedule/auto"); toast.success(`${r.scheduled} atom optimum saatlere dağıtıldı`); });
    const schedule = (id) => wrap(() => apiClient.post(`/atoms/${id}/schedule`, { scheduled_at: new Date(times[id] || localDT()).toISOString() }), "Zamanlandı");
    const unschedule = (id) => wrap(() => apiClient.post(`/atoms/${id}/unschedule`), "Kaldırıldı");
    const publishNow = (id) => wrap(async () => { const { data: r } = await apiClient.post(`/atoms/${id}/publish`); if (r.url) window.open(r.url, "_blank"); }, "Yayınlandı");
    const retry = (id) => wrap(() => apiClient.post(`/atoms/${id}/schedule`, { scheduled_at: new Date().toISOString() }), "Tekrar kuyruğa alındı");

    const dropOnDay = (day) => {
        const item = data.timeline.find((a) => a.id === dragId);
        setDragOver(null);
        setDragId(null);
        if (!item) return;
        const orig = new Date(item.scheduled_at);
        const nd = new Date(day);
        nd.setHours(orig.getHours(), orig.getMinutes(), 0, 0);
        wrap(() => apiClient.post(`/atoms/${item.id}/schedule`, { scheduled_at: nd.toISOString() }), "Yeniden zamanlandı");
    };

    const pending = data.timeline.filter((a) => !a.published);
    const published = data.timeline.filter((a) => a.published);
    const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i); return d; });
    const sameDay = (iso, day) => { const d = new Date(iso); return d.toDateString() === day.toDateString(); };

    return (
        <div className="p-8 max-w-6xl">
            <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
                <div>
                    <h1 className="font-heading text-3xl font-bold" data-testid="page-title">Takvim & Zamanlama</h1>
                    <p className="text-[#8A8F98] mt-1 text-sm">Sürükle-bırak ile günü değiştir · publisher her dakika kontrol eder, hatada 3 kez dener (→ DLQ)</p>
                </div>
                {data.unscheduled.length > 0 && (
                    <Button onClick={autoDistribute} disabled={busy} data-testid="auto-distribute-btn" className="bg-[#5E6AD2] hover:bg-[#7380E8]">
                        {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Zap className="w-4 h-4 mr-1" />}{data.unscheduled.length} Atomu Otomatik Dağıt
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Unscheduled */}
                <div>
                    <h3 className="font-heading font-semibold mb-3 text-sm text-[#8A8F98] uppercase tracking-wide">Planlanmayı Bekleyen ({data.unscheduled.length})</h3>
                    <div className="space-y-2 max-h-[72vh] overflow-y-auto pr-1" data-testid="unscheduled-list">
                        {data.unscheduled.length === 0 && <p className="text-sm text-[#8A8F98] py-6">Onaylı sosyal atom yok.</p>}
                        {data.unscheduled.map((a) => (
                            <div key={a.id} className="bg-[#191A1B] border border-[#2A2E33] rounded-lg p-3" data-testid={`unscheduled-${a.id}`}>
                                <div className="flex items-center gap-2 mb-2">{platIcon(a.platform)}<span className="text-xs font-medium truncate">{a.label} #{a.index + 1}</span><span className="text-[10px] text-[#8A8F98] truncate ml-auto">{a.article_title?.slice(0, 22)}</span></div>
                                <p className="text-xs text-white/70 line-clamp-2 mb-2">{a.content}</p>
                                <div className="flex items-center gap-2">
                                    <input type="datetime-local" defaultValue={localDT()} onChange={(e) => setTimes((t) => ({ ...t, [a.id]: e.target.value }))} data-testid={`time-${a.id}`} className="bg-[#0f1011] border border-[#2A2E33] rounded-md text-xs px-2 py-1.5 text-white flex-1" />
                                    <Button size="sm" onClick={() => schedule(a.id)} disabled={busy} data-testid={`schedule-${a.id}`} className="h-8 px-3 text-xs bg-[#5E6AD2] hover:bg-[#7380E8]"><CalendarClock className="w-3 h-3 mr-1" />Zamanla</Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Calendar with drag-drop */}
                <div>
                    <h3 className="font-heading font-semibold mb-3 text-sm text-[#8A8F98] uppercase tracking-wide">Yayın Takvimi — 14 gün ({pending.length} bekliyor)</h3>
                    <div className="space-y-1.5 max-h-[72vh] overflow-y-auto pr-1" data-testid="timeline">
                        {days.map((day, di) => {
                            const items = pending.filter((a) => sameDay(a.scheduled_at, day));
                            const isOver = dragOver === di;
                            return (
                                <div key={di} onDragOver={(e) => { e.preventDefault(); setDragOver(di); }} onDragLeave={() => setDragOver(null)} onDrop={() => dropOnDay(day)} data-testid={`day-${di}`}
                                    className={`rounded-lg border p-2 transition-colors duration-150 ${isOver ? "border-[#5E6AD2] bg-[#5E6AD2]/10" : "border-[#2A2E33] bg-[#0A0A0B]"} ${items.length === 0 ? "min-h-[40px]" : ""}`}>
                                    <div className="text-[11px] font-semibold text-[#7380E8] px-1 mb-1">{day.toLocaleDateString("tr-TR", { weekday: "short", day: "numeric", month: "short" })}{di === 0 && " · Bugün"}</div>
                                    {items.length === 0 && isOver && <div className="text-[10px] text-[#5E6AD2] px-1">Buraya bırak</div>}
                                    {items.map((a) => {
                                        const st = a.dead ? { l: "DLQ", c: "#E64C4C" } : { l: "Zamanlı", c: "#F3B72C" };
                                        return (
                                            <div key={a.id} draggable onDragStart={() => setDragId(a.id)} data-testid={`timeline-${a.id}`} className="bg-[#191A1B] border border-[#2A2E33] rounded-md p-2 mb-1.5 cursor-move hover:border-[#3a3f45]">
                                                <div className="flex items-center gap-1.5">
                                                    <GripVertical className="w-3 h-3 text-[#4a4f55]" />
                                                    <span className="font-mono text-[10px] text-[#8A8F98]">{new Date(a.scheduled_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</span>
                                                    {platIcon(a.platform)}
                                                    <span className="text-[11px] font-medium truncate">{a.label} #{a.index + 1}</span>
                                                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded ml-auto shrink-0" style={{ background: `${st.c}22`, color: st.c }}>{st.l}</span>
                                                </div>
                                                {a.dead && a.last_error && <p className="flex items-center gap-1 text-[9px] text-[#E64C4C] mt-1 ml-4"><AlertTriangle className="w-2.5 h-2.5" />{a.last_error}</p>}
                                                <div className="flex gap-1 mt-1.5 ml-4">
                                                    <Button size="sm" onClick={() => publishNow(a.id)} disabled={busy} data-testid={`publish-now-${a.id}`} className="h-5 px-1.5 text-[9px] bg-[#27C281]/15 text-[#27C281] hover:bg-[#27C281]/25"><Send className="w-2.5 h-2.5 mr-0.5" />Şimdi</Button>
                                                    {a.dead && <Button size="sm" onClick={() => retry(a.id)} disabled={busy} data-testid={`retry-${a.id}`} className="h-5 px-1.5 text-[9px] bg-[#F3B72C]/15 text-[#F3B72C] hover:bg-[#F3B72C]/25"><RotateCcw className="w-2.5 h-2.5 mr-0.5" />Tekrar</Button>}
                                                    <Button size="sm" onClick={() => unschedule(a.id)} disabled={busy} data-testid={`unschedule-${a.id}`} className="h-5 px-1.5 text-[9px] bg-[#2A2E33] hover:bg-[#3a3f45]"><Trash2 className="w-2.5 h-2.5" /></Button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>

                    {published.length > 0 && (
                        <div className="mt-5">
                            <h3 className="font-heading font-semibold mb-2 text-sm text-[#8A8F98] uppercase tracking-wide">Yayınlananlar ({published.length})</h3>
                            <div className="space-y-1.5 max-h-[30vh] overflow-y-auto pr-1">
                                {published.map((a) => (
                                    <a key={a.id} href={a.publish_url} target="_blank" rel="noreferrer" data-testid={`published-${a.id}`} className="flex items-center gap-2 bg-[#191A1B] border border-[#2A2E33] rounded-md p-2 hover:border-[#27C281]/40">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-[#27C281] shrink-0" />
                                        {platIcon(a.platform)}
                                        <span className="text-[11px] truncate">{a.label} #{a.index + 1}</span>
                                        <span className="text-[10px] text-[#8A8F98] ml-auto">{new Date(a.published_at || a.scheduled_at).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                                        <ExternalLink className="w-3 h-3 text-[#27C281]" />
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
