import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Heart, MessageCircle, Repeat2, Share, ThumbsUp, Send, MoreHorizontal, Globe } from "lucide-react";

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
                    {atom.media_type === "image" && atom.media && <img src={`data:image/png;base64,${atom.media}`} alt="" className="mt-3 rounded-2xl border border-[#e1e8ed] w-full" />}
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
            {atom.media_type === "image" && atom.media && <img src={`data:image/png;base64,${atom.media}`} alt="" className="mt-3 -mx-4 border-y border-[#e6e6e6] w-[calc(100%+2rem)]" />}
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
            {atom.media_type === "image" && atom.media && <img src={`data:image/png;base64,${atom.media}`} alt="" className="rounded-lg w-full mb-3" />}
            <div className="flex items-center gap-2 mb-2">
                <div className="w-9 h-9 rounded-full bg-[#5E6AD2] flex items-center justify-center text-white font-bold text-sm">{AVATAR}</div>
                <span className="font-semibold text-sm">eğitim.today · {atom.platform}</span>
            </div>
            {atom.media_type === "audio" && atom.media && <audio controls src={`data:audio/mp3;base64,${atom.media}`} className="w-full mb-3" />}
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{atom.content}</p>
        </div>
    );
}

export default function AtomPreview({ atom, open, onOpenChange }) {
    const View = atom.platform === "Twitter/X" ? TwitterView : atom.platform === "LinkedIn" ? LinkedInView : GenericView;
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-[#0f1011] border-[#2A2E33] text-white max-w-xl" data-testid={`preview-dialog-${atom.id}`}>
                <DialogHeader>
                    <DialogTitle className="font-heading flex items-center gap-2 text-sm">
                        Yayın Önizlemesi <span className="text-[10px] font-normal text-[#8A8F98] uppercase tracking-wide">{atom.platform} · {atom.label} #{atom.index + 1}</span>
                    </DialogTitle>
                </DialogHeader>
                <div className="flex justify-center py-2 max-h-[70vh] overflow-y-auto">
                    <View atom={atom} />
                </div>
                <p className="text-[11px] text-[#8A8F98] text-center">İçerik gönderileceği platformdaki görünümüyle gösterilir.</p>
            </DialogContent>
        </Dialog>
    );
}
