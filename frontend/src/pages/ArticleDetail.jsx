import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, Loader2, Quote, Zap } from "lucide-react";
import apiClient, { apiError } from "@/lib/apiClient";
import StatusBadge from "@/components/StatusBadge";
import AtomCard from "@/components/AtomCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ArticleDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [article, setArticle] = useState(null);
    const [atoms, setAtoms] = useState([]);
    const [analyzing, setAnalyzing] = useState(false);
    const [filter, setFilter] = useState("all");
    const [bulk, setBulk] = useState({ running: false, done: 0, total: 0 });

    const loadAtoms = () => apiClient.get(`/articles/${id}/atoms`).then((r) => setAtoms(r.data));
    const loadArticle = () => apiClient.get(`/articles/${id}`).then((r) => setArticle(r.data));

    useEffect(() => { loadArticle(); loadAtoms(); }, [id]);

    const analyze = async () => {
        setAnalyzing(true);
        try {
            await apiClient.post(`/articles/${id}/analyze`);
            toast.success("Analiz tamamlandı, blueprint üretildi");
            await loadArticle();
            await loadAtoms();
        } catch (e) { toast.error(apiError(e)); }
        finally { setAnalyzing(false); }
    };

    const generateMissing = async () => {
        const pending = atoms.filter((a) => !a.content);
        if (!pending.length) { toast.info("Tüm atomlar zaten üretildi"); return; }
        setBulk({ running: true, done: 0, total: pending.length });
        for (let i = 0; i < pending.length; i++) {
            try { await apiClient.post(`/atoms/${pending[i].id}/generate`); } catch (e) { /* skip errors, continue */ }
            setBulk({ running: true, done: i + 1, total: pending.length });
            await loadAtoms();
        }
        setBulk({ running: false, done: 0, total: 0 });
        toast.success("Toplu üretim tamamlandı");
        loadAtoms();
    };

    if (!article) return <div className="p-8 text-[#8A8F98]">Yükleniyor...</div>;

    const analysis = article.analysis;
    const groups = atoms.reduce((acc, a) => { (acc[a.type] = acc[a.type] || []).push(a); return acc; }, {});
    const types = Object.keys(groups);
    const shown = filter === "all" ? atoms : groups[filter] || [];
    const missingCount = atoms.filter((a) => !a.content).length;

    return (
        <div className="p-8 max-w-6xl">
            <button onClick={() => navigate("/articles")} data-testid="back-btn" className="flex items-center gap-1 text-sm text-[#8A8F98] hover:text-white transition-colors duration-200 mb-6">
                <ArrowLeft className="w-4 h-4" /> Makaleler
            </button>

            <div className="flex items-start justify-between gap-6 mb-6 flex-wrap">
                <div>
                    <div className="mb-2"><StatusBadge status={article.status} /></div>
                    <h1 className="font-heading text-3xl font-bold" data-testid="article-detail-title">{article.title}</h1>
                    <div className="flex items-center gap-2 text-xs text-[#8A8F98] mt-2 flex-wrap">
                        {article.category && <span className="px-1.5 py-0.5 rounded bg-[#2A2E33]">{article.category}</span>}
                        {article.tags?.map((t) => <span key={t} className="px-1.5 py-0.5 rounded bg-[#2A2E33]">#{t}</span>)}
                    </div>
                </div>
                <Button onClick={analyze} disabled={analyzing} data-testid="analyze-btn" className="bg-[#5E6AD2] hover:bg-[#7380E8] shrink-0">
                    {analyzing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
                    {article.status === "analyzed" ? "Yeniden Analiz Et" : "Analiz & Atomize Et"}
                </Button>
            </div>

            {analysis && (
                <div className="bg-[#191A1B] border border-[#2A2E33] rounded-xl p-6 mb-8" data-testid="analysis-panel">
                    <h3 className="font-heading font-semibold mb-3">Analiz</h3>
                    <p className="text-sm text-white/90 mb-4">{analysis.summary}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                            <div className="text-xs text-[#8A8F98] uppercase tracking-wide mb-2">Ana Konseptler</div>
                            <div className="flex flex-wrap gap-1.5">{(analysis.concepts || []).map((c, i) => <span key={i} className="px-2 py-0.5 rounded bg-[#5E6AD2]/15 text-[#7380E8] text-xs">{c}</span>)}</div>
                            <div className="text-xs text-[#8A8F98] uppercase tracking-wide mb-2 mt-4">Hedef Kitle / Ton</div>
                            <p className="text-white/80 text-xs">{analysis.audience} · {analysis.tone}</p>
                        </div>
                        <div>
                            <div className="text-xs text-[#8A8F98] uppercase tracking-wide mb-2">Alıntılar</div>
                            <div className="space-y-2">{(analysis.quotes || []).slice(0, 3).map((q, i) => <div key={i} className="flex gap-2 text-xs text-white/80"><Quote className="w-3 h-3 shrink-0 mt-0.5 text-[#5E6AD2]" /> {q}</div>)}</div>
                        </div>
                    </div>
                </div>
            )}

            {atoms.length > 0 && (
                <>
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                        <h3 className="font-heading text-xl font-bold">Atomlar <span className="text-[#8A8F98] text-sm font-normal">({atoms.length})</span></h3>
                        {missingCount > 0 && (
                            <Button onClick={generateMissing} disabled={bulk.running} data-testid="bulk-generate-btn" className="bg-[#27C281] hover:bg-[#27C281]/85 text-black font-medium">
                                {bulk.running ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Üretiliyor {bulk.done}/{bulk.total}</> : <><Zap className="w-4 h-4 mr-1" /> Eksik {missingCount} Atomu Üret</>}
                            </Button>
                        )}
                    </div>
                    {bulk.running && (
                        <div className="h-1.5 rounded-full bg-[#191A1B] overflow-hidden mb-5">
                            <div className="h-full bg-[#27C281] transition-all duration-300" style={{ width: `${(bulk.done / bulk.total) * 100}%` }} />
                        </div>
                    )}
                    <div className="flex flex-wrap gap-1.5 mb-5" data-testid="atom-filters">
                        <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label={`Tümü (${atoms.length})`} />
                        {types.map((t) => <FilterChip key={t} active={filter === t} onClick={() => setFilter(t)} label={`${groups[t][0].label} (${groups[t].length})`} />)}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {shown.map((a) => <AtomCard key={a.id} atom={a} onChange={loadAtoms} />)}
                    </div>
                </>
            )}

            {atoms.length === 0 && !analysis && (
                <div className="text-center py-20 text-[#8A8F98]" data-testid="no-atoms">Analiz edildiğinde 50+ atom otomatik oluşturulacak.</div>
            )}
        </div>
    );
}

function FilterChip({ active, onClick, label }) {
    return (
        <button onClick={onClick} className={`px-3 py-1 rounded-full text-xs transition-colors duration-200 ${active ? "bg-[#5E6AD2] text-white" : "bg-[#191A1B] border border-[#2A2E33] text-[#8A8F98] hover:text-white"}`}>
            {label}
        </button>
    );
}
