import { useState } from "react";
import { Sparkles, RefreshCw, Check, X, Pencil, Loader2, ImageIcon, Music, Video, FileText, Send, ExternalLink, Clock } from "lucide-react";
import apiClient, { apiError } from "@/lib/apiClient";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const ICONS = { image: ImageIcon, audio: Music, text: FileText };
const PLATFORM_COLOR = {
    "Twitter/X": "#1DA1F2", LinkedIn: "#0A66C2", Instagram: "#E1306C",
    Facebook: "#1877F2", Pinterest: "#E60023", YouTube: "#FF0000",
};

function PlatformMock({ atom }) {
    const accent = PLATFORM_COLOR[atom.platform] || "#5E6AD2";
    if (atom.media_type === "image" && atom.media) {
        return <img src={`data:image/png;base64,${atom.media}`} alt={atom.label} data-testid={`atom-image-${atom.id}`} className="w-full rounded-md border border-[#2A2E33] object-cover" />;
    }
    if (atom.media_type === "audio" && atom.media) {
        return (
            <div className="space-y-2">
                <audio controls src={`data:audio/mp3;base64,${atom.media}`} data-testid={`atom-audio-${atom.id}`} className="w-full" />
                <p className="text-xs text-[#8A8F98] whitespace-pre-wrap line-clamp-6">{atom.content}</p>
            </div>
        );
    }
    if (!atom.content) {
        return <p className="text-sm text-[#8A8F98] italic py-3">Henüz üretilmedi.</p>;
    }
    return (
        <div className="rounded-md border border-[#2A2E33] bg-[#0f1011] p-3">
            <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full shrink-0" style={{ background: accent }} />
                <div>
                    <div className="text-xs font-semibold">eğitim.today</div>
                    <div className="text-[10px] text-[#8A8F98]">@egitimtoday · {atom.platform}</div>
                </div>
            </div>
            <p className="text-sm whitespace-pre-wrap leading-relaxed text-white/90 max-h-48 overflow-y-auto">{atom.content}</p>
        </div>
    );
}

export default function AtomCard({ atom, onChange, selectable, selected, onSelect }) {
    const [busy, setBusy] = useState(false);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(atom.content || "");
    const Icon = ICONS[atom.category] || Video;
    const isSocial = atom.platform === "Twitter/X" || atom.platform === "LinkedIn";
    const accent = PLATFORM_COLOR[atom.platform] || "#5E6AD2";

    const act = async (fn) => {
        setBusy(true);
        try { await fn(); onChange && onChange(); }
        catch (e) { toast.error(apiError(e)); }
        finally { setBusy(false); }
    };

    const generate = () => act(async () => { await apiClient.post(`/atoms/${atom.id}/${atom.content ? "regenerate" : "generate"}`); toast.success("İçerik üretildi"); });
    const approve = () => act(async () => { await apiClient.post(`/atoms/${atom.id}/approve`); });
    const reject = () => act(async () => { await apiClient.post(`/atoms/${atom.id}/reject`); });
    const saveEdit = () => act(async () => { await apiClient.put(`/atoms/${atom.id}`, { content: draft }); setEditing(false); toast.success("Kaydedildi"); });
    const publish = () => act(async () => {
        const { data } = await apiClient.post(`/atoms/${atom.id}/publish`);
        toast.success(`${atom.platform}'te yayınlandı`);
        if (data.url) window.open(data.url, "_blank");
    });

    return (
        <div data-testid={`atom-card-${atom.id}`} className="bg-[#191A1B] border border-[#2A2E33] rounded-xl p-4 space-y-3 hover:border-[#3a3f45] transition-colors duration-200">
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    {selectable && <Checkbox checked={selected} onCheckedChange={onSelect} data-testid={`atom-select-${atom.id}`} className="border-[#2A2E33]" />}
                    <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: `${accent}22` }}>
                        <Icon className="w-3.5 h-3.5" style={{ color: accent }} />
                    </span>
                    <span className="text-xs font-medium truncate">{atom.label} #{atom.index + 1}</span>
                </div>
                <StatusBadge status={atom.status} />
            </div>

            <div className="flex items-center gap-2 text-[10px] text-[#8A8F98] uppercase tracking-wide">
                <span style={{ color: accent }}>{atom.platform}</span>
                {atom.aspect !== "-" && <span>· {atom.aspect}</span>}
                {atom.auto_approve && <span className="text-[#27C281]">· otomatik onay</span>}
            </div>

            {atom.scheduled_at && !atom.published && (
                <div className="flex items-center gap-1 text-[10px] text-[#F3B72C]"><Clock className="w-3 h-3" /> {new Date(atom.scheduled_at).toLocaleString("tr-TR")} için zamanlandı</div>
            )}

            {editing ? (
                <div className="space-y-2">
                    <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} data-testid={`atom-edit-textarea-${atom.id}`} className="bg-[#0f1011] border-[#2A2E33] min-h-[140px] text-sm" />
                    <div className="flex gap-2">
                        <Button size="sm" onClick={saveEdit} disabled={busy} data-testid={`atom-save-${atom.id}`} className="bg-[#5E6AD2] hover:bg-[#7380E8]">Kaydet</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>İptal</Button>
                    </div>
                </div>
            ) : (
                <PlatformMock atom={atom} />
            )}

            {atom.notes && <p className="text-xs text-[#F3B72C]">Not: {atom.notes}</p>}

            {atom.published && (
                <a href={atom.publish_url} target="_blank" rel="noreferrer" data-testid={`atom-published-link-${atom.id}`} className="flex items-center gap-1.5 text-xs text-[#27C281] hover:underline font-medium">
                    <ExternalLink className="w-3 h-3" /> {atom.publish_platform || atom.platform}'te yayınlandı — görüntüle
                </a>
            )}

            {!editing && (
                <div className="pt-1 space-y-2">
                    {!atom.content ? (
                        <Button onClick={generate} disabled={busy} data-testid={`atom-generate-${atom.id}`} className="w-full h-9 bg-[#5E6AD2] hover:bg-[#7380E8] text-sm">
                            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            <span className="ml-1.5">İçerik Üret</span>
                        </Button>
                    ) : (
                        <>
                            {isSocial && atom.status === "approved" && !atom.published && (
                                <Button onClick={publish} disabled={busy} data-testid={`atom-publish-${atom.id}`} className="w-full h-9 text-white text-sm font-medium" style={{ background: accent }}>
                                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    <span className="ml-1.5">{atom.platform}'te Yayınla</span>
                                </Button>
                            )}
                            <div className="flex flex-wrap gap-1.5">
                                <Button size="sm" onClick={generate} disabled={busy} data-testid={`atom-regenerate-${atom.id}`} className="h-7 px-2 text-xs bg-[#2A2E33] hover:bg-[#3a3f45]">
                                    <RefreshCw className="w-3 h-3" /><span className="ml-1">Yeniden</span>
                                </Button>
                                {atom.category === "text" && (
                                    <Button size="sm" onClick={() => { setDraft(atom.content); setEditing(true); }} data-testid={`atom-edit-${atom.id}`} className="h-7 px-2 text-xs bg-[#2A2E33] hover:bg-[#3a3f45]">
                                        <Pencil className="w-3 h-3" /><span className="ml-1">Düzenle</span>
                                    </Button>
                                )}
                                {atom.status !== "approved" && (
                                    <Button size="sm" onClick={approve} disabled={busy} data-testid={`atom-approve-${atom.id}`} className="h-7 px-2 text-xs bg-[#27C281]/15 text-[#27C281] hover:bg-[#27C281]/25">
                                        <Check className="w-3 h-3" /><span className="ml-1">Onayla</span>
                                    </Button>
                                )}
                                {atom.status !== "rejected" && (
                                    <Button size="sm" onClick={reject} disabled={busy} data-testid={`atom-reject-${atom.id}`} className="h-7 px-2 text-xs bg-[#E64C4C]/15 text-[#E64C4C] hover:bg-[#E64C4C]/25">
                                        <X className="w-3 h-3" />
                                    </Button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
