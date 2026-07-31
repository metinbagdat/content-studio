const MAP = {
    draft: { label: "Taslak", cls: "bg-[#2A2E33] text-[#8A8F98]" },
    review: { label: "İnceleme", cls: "bg-[#F3B72C]/15 text-[#F3B72C]" },
    approved: { label: "Onaylı", cls: "bg-[#27C281]/15 text-[#27C281]" },
    rejected: { label: "Reddedildi", cls: "bg-[#E64C4C]/15 text-[#E64C4C]" },
    new: { label: "Yeni", cls: "bg-[#5E6AD2]/15 text-[#7380E8]" },
    analyzed: { label: "Analiz Edildi", cls: "bg-[#27C281]/15 text-[#27C281]" },
};

export default function StatusBadge({ status }) {
    const s = MAP[status] || MAP.draft;
    return (
        <span
            data-testid={`status-badge-${status}`}
            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${s.cls}`}
        >
            {s.label}
        </span>
    );
}
