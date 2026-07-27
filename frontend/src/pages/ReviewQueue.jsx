import { useEffect, useState } from "react";
import { CheckCheck, Loader2 } from "lucide-react";
import apiClient, { apiError } from "@/lib/apiClient";
import AtomCard from "@/components/AtomCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const COLUMNS = [
    { key: "draft", label: "Taslak", color: "#8A8F98" },
    { key: "review", label: "İnceleme", color: "#F3B72C" },
    { key: "approved", label: "Onaylı", color: "#27C281" },
    { key: "rejected", label: "Reddedildi", color: "#E64C4C" },
];

export default function ReviewQueue() {
    const [atoms, setAtoms] = useState([]);
    const [selected, setSelected] = useState([]);
    const [bulkBusy, setBulkBusy] = useState(false);

    const load = () => apiClient.get("/atoms").then((r) => setAtoms(r.data));
    useEffect(() => { load(); }, []);

    const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

    const bulkApprove = async () => {
        setBulkBusy(true);
        try {
            await apiClient.post("/atoms/bulk-approve", { ids: selected });
            toast.success(`${selected.length} atom onaylandı`);
            setSelected([]);
            load();
        } catch (e) {
            toast.error(apiError(e));
        } finally {
            setBulkBusy(false);
        }
    };

    const byStatus = (k) => atoms.filter((a) => a.status === k);

    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="font-heading text-3xl font-bold" data-testid="page-title">İnceleme Kuyruğu</h1>
                    <p className="text-[#8A8F98] mt-1">Üretilen atomları onaylayın, düzenleyin veya reddedin</p>
                </div>
                {selected.length > 0 && (
                    <Button onClick={bulkApprove} disabled={bulkBusy} data-testid="bulk-approve-btn" className="bg-[#27C281] hover:bg-[#27C281]/80 text-black">
                        {bulkBusy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCheck className="w-4 h-4 mr-1" />}
                        {selected.length} Atomu Onayla
                    </Button>
                )}
            </div>

            {atoms.length === 0 ? (
                <div className="text-center py-24 text-[#8A8F98]" data-testid="empty-queue">
                    Kuyrukta atom yok. Bir makaleyi analiz edip atom üretin.
                </div>
            ) : (
                <div className="flex gap-4 overflow-x-auto pb-4">
                    {COLUMNS.map((col) => {
                        const items = byStatus(col.key);
                        return (
                            <div key={col.key} className="min-w-[340px] w-[340px] shrink-0" data-testid={`column-${col.key}`}>
                                <div className="flex items-center gap-2 mb-3 sticky top-0">
                                    <span className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                                    <span className="font-heading font-semibold text-sm">{col.label}</span>
                                    <span className="text-xs text-[#8A8F98] font-mono">{items.length}</span>
                                </div>
                                <div className="space-y-3">
                                    {items.map((a) => (
                                        <AtomCard
                                            key={a.id}
                                            atom={a}
                                            onChange={load}
                                            selectable={col.key === "review"}
                                            selected={selected.includes(a.id)}
                                            onSelect={() => toggle(a.id)}
                                        />
                                    ))}
                                    {items.length === 0 && <div className="text-xs text-[#8A8F98] text-center py-8 border border-dashed border-[#2A2E33] rounded-lg">Boş</div>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
