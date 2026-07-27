import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Loader2, Trash2, ArrowRight } from "lucide-react";
import apiClient, { apiError } from "@/lib/apiClient";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

export default function Articles() {
    const [articles, setArticles] = useState([]);
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ title: "", content: "", url: "", category: "", tags: "", target_audience: "" });
    const navigate = useNavigate();

    const load = () => apiClient.get("/articles").then((r) => setArticles(r.data));
    useEffect(() => { load(); }, []);

    const save = async () => {
        setSaving(true);
        try {
            const payload = { ...form, tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [] };
            const { data } = await apiClient.post("/articles", payload);
            toast.success("Makale eklendi");
            setOpen(false);
            setForm({ title: "", content: "", url: "", category: "", tags: "", target_audience: "" });
            navigate(`/articles/${data.id}`);
        } catch (e) {
            toast.error(apiError(e));
        } finally {
            setSaving(false);
        }
    };

    const remove = async (id, e) => {
        e.stopPropagation();
        await apiClient.delete(`/articles/${id}`);
        toast.success("Makale silindi");
        load();
    };

    return (
        <div className="p-8 max-w-6xl">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="font-heading text-3xl font-bold" data-testid="page-title">Makaleler</h1>
                    <p className="text-[#8A8F98] mt-1">Kaynak makaleleri ekleyin ve atomize edin</p>
                </div>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button data-testid="add-article-btn" className="bg-[#5E6AD2] hover:bg-[#7380E8]">
                            <Plus className="w-4 h-4 mr-1" /> Makale Ekle
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-[#191A1B] border-[#2A2E33] text-white max-w-lg">
                        <DialogHeader>
                            <DialogTitle className="font-heading">Yeni Makale</DialogTitle>
                            <DialogDescription className="text-[#8A8F98]">Makaleyi manuel yapıştırın veya URL'den içe aktarın.</DialogDescription>
                        </DialogHeader>
                        <Tabs defaultValue="manual">
                            <TabsList className="bg-[#0f1011] border border-[#2A2E33]">
                                <TabsTrigger value="manual" data-testid="tab-manual">Manuel Yapıştır</TabsTrigger>
                                <TabsTrigger value="url" data-testid="tab-url">URL'den Al</TabsTrigger>
                            </TabsList>
                            <TabsContent value="manual" className="space-y-3 mt-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-[#8A8F98]">Başlık</Label>
                                    <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="article-title" className="bg-[#0f1011] border-[#2A2E33]" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-[#8A8F98]">İçerik</Label>
                                    <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} data-testid="article-content" className="bg-[#0f1011] border-[#2A2E33] min-h-[140px]" />
                                </div>
                            </TabsContent>
                            <TabsContent value="url" className="space-y-3 mt-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-[#8A8F98]">Makale URL'i</Label>
                                    <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} data-testid="article-url" placeholder="https://egitim.today/..." className="bg-[#0f1011] border-[#2A2E33]" />
                                </div>
                                <p className="text-xs text-[#8A8F98]">İçerik URL'den otomatik çekilecek.</p>
                            </TabsContent>
                        </Tabs>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs text-[#8A8F98]">Kategori</Label>
                                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} data-testid="article-category" className="bg-[#0f1011] border-[#2A2E33]" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-[#8A8F98]">Hedef Kitle</Label>
                                <Input value={form.target_audience} onChange={(e) => setForm({ ...form, target_audience: e.target.value })} data-testid="article-audience" className="bg-[#0f1011] border-[#2A2E33]" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-[#8A8F98]">Etiketler (virgülle)</Label>
                            <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} data-testid="article-tags" className="bg-[#0f1011] border-[#2A2E33]" />
                        </div>
                        <Button onClick={save} disabled={saving} data-testid="article-save" className="bg-[#5E6AD2] hover:bg-[#7380E8]">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Kaydet"}
                        </Button>
                    </DialogContent>
                </Dialog>
            </div>

            {articles.length === 0 ? (
                <div className="text-center py-24 text-[#8A8F98]" data-testid="empty-articles">Henüz makale yok. İlk makalenizi ekleyin.</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {articles.map((a) => (
                        <div
                            key={a.id}
                            onClick={() => navigate(`/articles/${a.id}`)}
                            data-testid={`article-card-${a.id}`}
                            className="group bg-[#191A1B] border border-[#2A2E33] rounded-lg p-5 cursor-pointer hover:border-[#5E6AD2]/50 transition-colors duration-200"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <StatusBadge status={a.status} />
                                <button onClick={(e) => remove(a.id, e)} data-testid={`article-delete-${a.id}`} className="text-[#8A8F98] hover:text-[#E64C4C] transition-colors duration-200">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                            <h3 className="font-heading font-semibold line-clamp-2 mb-2">{a.title}</h3>
                            <div className="flex items-center gap-2 text-xs text-[#8A8F98]">
                                {a.category && <span className="px-1.5 py-0.5 rounded bg-[#2A2E33]">{a.category}</span>}
                                <span>{a.atom_count} atom</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-[#5E6AD2] mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                Aç <ArrowRight className="w-3 h-3" />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
