export default function Stub({ title, note }: { title: string; note: string }) {
  return (
    <div className="p-8">
      <h2 className="text-[15px] font-bold">{title}</h2>
      <p className="text-mut text-[12px] mt-2 max-w-md leading-relaxed">{note}</p>
      <span className="inline-block mt-4 text-[9px] tracking-[0.14em] uppercase font-bold text-amber border border-[#66501e] bg-[#17130a] rounded px-2 py-1">
        In build — not yet functional
      </span>
    </div>
  );
}
