import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Heart, MessageCircle, Repeat2, Share, ThumbsUp, Send, MoreHorizontal, Globe, Check, Loader2, Sparkles, ImageOff } from "lucide-react";
import apiClient, { apiError } from "@/lib/apiClient";
import { toast } from "sonner";

const AVATAR = "eğ";

function TwitterView({ atom }) {
    return (
        <div className="bg-white text-black rounded-xl p-4 max-w-[520px]">
            <div className="flex gap-3">
                <div className="w-11 h-11 rounded-full bg-[#5E6AD2] flex items-center justify-center text-white font-bold shrink-0">{AVATAR}</div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 text-[15px]">
                        <span className="font-bold">eğitim.today</span>
                        <span className="text-[#536471]">@egitimtoday · şimdi</span>
                        <MoreHorizontal className="w-4 h-4 text-[#536471] ml-auto" />
                    </div>
                    <p className="text-[15px] leading-normal whitespace-pre-wrap mt-0.5">{atom.content}</p>
                    <div className="flex items-center justify-between text-[#536471] mt-3 max-w-[380px]">
                        <MessageCircle className="w-[18px] h-[18px]" /><Repeat2 className="w-[18px] h-[18px]" /><Heart className="w-[18px] h-[18px]" /><Share className="w-[18px] h-[18px]" />
                    </div>
                </div>
            </div>
        </div>
    );
}

function LinkedInView({ atom }) {
    return (
        <div className="bg-white text-black rounded-xl p-4 max-w-[520px] shadow-sm">
            <div className="flex gap-2 items-center">
                <div className="w-12 h-12 rounded-full bg-[#0A66C2] flex items-center justify-center text-white font-bold shrink-0">{AVATAR}</div>
                <div className="min-w-0">
                    <div className="font-semibold text-[14px] leading-tight">eğitim.today</div>
                    <div className="text-[12px] text-[#00000099] leading-tight">Eğitim · Teknoloji</div>
                    <div className="text-[12px] text-[#00000099] flex items-center gap-1">şimdi · <Globe className="w-3 h-3" /></div>
                </div>
                <MoreHorizontal className="w-5 h-5 text-[#00000099] ml-auto" />
            </div>
            <p className="text-[14px] leading-relaxed whitespace-pre-wrap mt-3">{atom.content}</p>
            <div className="flex items-center justify-between text-[#00000099] text-[13px] mt-3 pt-2 border-t border-[#e6e6e6]">
                <span className="flex items-center gap-1"><ThumbsUp className="w-4 h-4" /> Beğen</span>
                <span className="flex items-center gap-1"><MessageCircle className="w-4 h-4" /> Yorum</span>
                <span className="flex items-center gap-1"><Repeat2 className="w-4 h-4" /> Paylaş</span>
                <span className="flex items-center gap-1"><Send className="w-4 h-4" /> Gönder</span>
            </div>
        </div>
    );
}

function GenericView({ atom }) {
    return (
        <div className="bg-white text-black rounded-xl p-4 max-w-[520px]">
            <div className="flex items-center gap-2 mb-2">
                <div className="w-9 h-9 rounded-full bg-[#5E6AD2] flex items-center justify-center text-white font-bold text-sm">{AVATAR}</div>
                <span className="font-semibold text-sm">eğitim.today · {atom.platform}</span>
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{atom.content}</p>
        </div>
    );
}

// Side-by-side original vs watermarked selector for image atoms.
function ImageVersionSelector({ atom, onChange }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [choice, setChoice] = useState(atom.media_choice || "watermarked");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let alive = true;
        setLoading(true);
        apiClient.get(`/atoms/${atom.id}/media`).then((r) => {
            if (!alive) return;
            setData(r.data);
            setChoice(r.data.media_choice || "watermarked");
        }).catch((e) => toast.error(apiError(e))).finally(() => alive && setLoading(false));
        return () => { alive = false; };
    }, [atom.id]);

    const select = async (which) => {
        setChoice(which);
        setSaving(true);
        try {
            await apiClient.post(`/atoms/${atom.id}/select-media`, { choice: which });
            toast.success(which === "watermarked" ? "Watermark'lı versiyon seçildi" : "Orijinal versiyon seçildi");
            onChange && onChange();
        } catch (e) { toast.error(apiError(e)); }
        finally { setSaving(false); }
    };

    if (loading) return <div className="flex items-center justify-center py-10 text-[#8A8F98]"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Versiyonlar yükleniyor…</div>;
    if (!data || (!data.original && !data.watermarked)) {
        return <div className="flex flex-col items-center justify-center py-10 text-[#8A8F98]"><ImageOff className="w-8 h-8 mb-2 opacity-50" /> Bu görsel henüz üretilmedi.</div>;
    }

    const Card = ({ which, label, badge, b64 }) => {
        const active = choice === which;
        return (
            <button
                type="button"
                onClick={() => select(which)}
                disabled={saving || !b64}
                data-testid={`media-version-${which}-${atom.id}`}
                className={`relative flex-1 min-w-0 rounded-xl overflow-hidden border-2 transition-all duration-200 text-left ${active ? "border-[#5E6AD2] ring-2 ring-[#5E6AD2]/40" : "border-[#2A2E33] hover:border-[#3a3f45]"} disabled:opacity-50`}
            >
                {b64
                    ? <img src={`data:image/png;base64,${b64}`} alt={label} className="w-full aspect-square object-cover" />
                    : <div className="w-full aspect-square flex items-center justify-center bg-[#0f1011] text-xs text-[#8A8F98]">Mevcut değil</div>}
                <div className="flex items-center justify-between px-3 py-2 bg-[#191A1B]">
                    <span className="text-xs font-medium flex items-center gap-1.5">
                        {badge}{label}
                    </span>
                    {active && <span className="flex items-center gap-1 text-[10px] text-[#5E6AD2] font-semibold"><Check className="w-3 h-3" /> Seçili</span>}
                </div>
            </button>
        );
    };

    return (
        <div className="w-full">
            <p className="text-xs text-[#8A8F98] mb-3 text-center">Yayınlanacak versiyonu seçin. Watermark sol-alt köşeye uygulanır.</p>
            <div className="flex gap-3">
                <Card which="watermarked" label="Watermark'lı" badge={<Sparkles className="w-3 h-3 text-[#5E6AD2]" />} b64={data.watermarked} />
                <Card which="original" label="Orijinal" badge={<span className="w-3 h-3 rounded-full border border-[#8A8F98]" />} b64={data.original} />
            </div>
            {saving && <div className="flex items-center justify-center mt-3 text-xs text-[#8A8F98]"><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Kaydediliyor…</div>}
        </div>
    );
}

export default function AtomPreview({ atom, open, onOpenChange, onChange }) {
    const isImage = atom.media_type === "image";
    const View = atom.platform === "Twitter/X" ? TwitterView : atom.platform === "LinkedIn" ? LinkedInView : GenericView;
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-[#0f1011] border-[#2A2E33] text-white max-w-xl" data-testid={`preview-dialog-${atom.id}`}>
                <DialogHeader>
                    <DialogTitle className="font-heading flex items-center gap-2 text-sm">
                        {isImage ? "Görsel Versiyonu Seç" : "Yayın Önizlemesi"} <span className="text-[10px] font-normal text-[#8A8F98] uppercase tracking-wide">{atom.platform} · {atom.label} #{atom.index + 1}</span>
                    </DialogTitle>
                    <DialogDescription className="sr-only">{isImage ? "Watermark'lı ve orijinal görsel versiyonları arasından seçim yapın" : "İçeriğin platformdaki yayın önizlemesi"}</DialogDescription>
                </DialogHeader>
                <div className="flex justify-center py-2 max-h-[70vh] overflow-y-auto">
                    {isImage ? <ImageVersionSelector atom={atom} onChange={onChange} /> : <View atom={atom} />}
                </div>
                {!isImage && <p className="text-[11px] text-[#8A8F98] text-center">İçerik gönderileceği platformdaki görünümüyle gösterilir.</p>}
            </DialogContent>
        </Dialog>
    );
}
