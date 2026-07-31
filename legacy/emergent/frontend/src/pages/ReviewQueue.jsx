import { useEffect, useState, useMemo } from "react";
import { CheckCheck, Loader2, Inbox } from "lucide-react";
import apiClient, { apiError } from "@/lib/apiClient";
import AtomCard from "@/components/AtomCard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const COLUMNS = [
    { key: "draft", label: "Taslak", color: "#8A8F98", hint: "Üretilmeyi bekliyor" },
    { key: "review", label: "İnceleme", color: "#F3B72C", hint: "Onay bekliyor" },
    { key: "approved", label: "Onaylı", color: "#27C281", hint: "Yayına hazır" },
    { key: "rejected", label: "Reddedildi", color: "#E64C4C", hint: "" },
];

export default function ReviewQueue() {
    const [atoms, setAtoms] = useState([]);
    const [articles, setArticles] = useState([]);
    const [selected, setSelected] = useState([]);
    const [bulkBusy, setBulkBusy] = useState(false);
    const [articleFilter, setArticleFilter] = useState("all");
    const [platformFilter, setPlatformFilter] = useState("all");

    const load = () => {
        apiClient.get("/atoms").then((r) => setAtoms(r.data));
        apiClient.get("/articles").then((r) => setArticles(r.data));
    };
    useEffect(() => { load(); }, []);

    const articleTitle = (id) => articles.find((a) => a.id === id)?.title || "Bilinmeyen makale";
    const platforms = useMemo(() => Array.from(new Set(atoms.map((a) => a.platform))).sort(), [atoms]);

    const filtered = atoms.filter(
        (a) => (articleFilter === "all" || a.article_id === articleFilter) && (platformFilter === "all" || a.platform === platformFilter)
    );

    const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    const toggleAll = (items) => {
        const ids = items.map((i) => i.id);
        const allSel = ids.length > 0 && ids.every((id) => selected.includes(id));
        setSelected((s) => (allSel ? s.filter((id) => !ids.includes(id)) : Array.from(new Set([...s, ...ids]))));
    };

    const bulkApprove = async () => {
        setBulkBusy(true);
        try {
            await apiClient.post("/atoms/bulk-approve", { ids: selected });
            toast.success(`${selected.length} atom onaylandı`);
            setSelected([]);
            load();
        } catch (e) { toast.error(apiError(e)); }
        finally { setBulkBusy(false); }
    };

    const selectStyle = "bg-[#191A1B] border border-[#2A2E33] rounded-md text-sm px-3 py-2 text-white focus:outline-none focus:border-[#5E6AD2] min-w-[180px]";

    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                <div>
                    <h1 className="font-heading text-3xl font-bold" data-testid="page-title">İnceleme Kuyruğu</h1>
                    <p className="text-[#8A8F98] mt-1 text-sm">Üret → onayla → sosyal medyada yayınla · <span className="text-[#7380E8]">İnceleme/Onaylı sütunlarındaki kutucukları işaretleyip toplu onaylayın</span></p>
                </div>
                {selected.length > 0 && (
                    <Button onClick={bulkApprove} disabled={bulkBusy} data-testid="bulk-approve-btn" className="bg-[#27C281] hover:bg-[#27C281]/80 text-black font-medium">
                        {bulkBusy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCheck className="w-4 h-4 mr-1" />}
                        {selected.length} Atomu Onayla
                    </Button>
                )}
            </div>

            <div className="flex flex-wrap gap-3 mb-6">
                <select value={articleFilter} onChange={(e) => setArticleFilter(e.target.value)} data-testid="filter-article" className={selectStyle}>
                    <option value="all">Tüm makaleler</option>
                    {articles.map((a) => <option key={a.id} value={a.id}>{a.title.slice(0, 45)}</option>)}
                </select>
                <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)} data-testid="filter-platform" className={selectStyle}>
                    <option value="all">Tüm platformlar</option>
                    {platforms.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <div className="flex items-center text-xs text-[#8A8F98] px-2">{filtered.length} atom gösteriliyor</div>
            </div>

            {atoms.length === 0 ? (
                <div className="text-center py-24 text-[#8A8F98]" data-testid="empty-queue">
                    <Inbox className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    Kuyrukta atom yok. Bir makaleyi analiz edip atom üretin.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {COLUMNS.map((col) => {
                        const items = filtered.filter((a) => a.status === col.key);
                        return (
                            <div key={col.key} className="bg-[#0A0A0B] border border-[#2A2E33] rounded-xl p-3" data-testid={`column-${col.key}`}>
                                <div className="flex items-center gap-2 mb-3 px-1">
                                    <span className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                                    <span className="font-heading font-semibold text-sm">{col.label}</span>
                                    {(col.key === "review" || col.key === "approved") && items.length > 0 && (
                                        <label className="flex items-center gap-1.5 ml-2 cursor-pointer text-[10px] text-[#8A8F98] hover:text-white">
                                            <Checkbox
                                                checked={items.every((i) => selected.includes(i.id))}
                                                onCheckedChange={() => toggleAll(items)}
                                                data-testid={`select-all-${col.key}`}
                                                className="w-3.5 h-3.5 border-2 border-[#5E6AD2]/70 data-[state=checked]:bg-[#5E6AD2] data-[state=checked]:border-[#5E6AD2]"
                                            />
                                            Tümünü seç
                                        </label>
                                    )}
                                    <span className="text-xs text-[#8A8F98] font-mono ml-auto">{items.length}</span>
                                </div>
                                <div className="space-y-3 max-h-[calc(100vh-260px)] overflow-y-auto pr-1">
                                    {items.map((a) => (
                                        <AtomCard key={a.id} atom={a} onChange={load} selectable={col.key === "review" || col.key === "approved"} selected={selected.includes(a.id)} onSelect={() => toggle(a.id)} />
                                    ))}
                                    {items.length === 0 && <div className="text-xs text-[#8A8F98] text-center py-8 border border-dashed border-[#2A2E33] rounded-lg">{col.hint || "Boş"}</div>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
