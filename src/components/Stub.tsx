export default function Stub({ title, note }: { title: string; note: string }) {
  return (
    <div className="p-8">
      <h2 className="text-[20px] font-bold">{title}</h2>
      <p className="c-body mt-2 max-w-lg">{note}</p>
      <span className="inline-block mt-5 text-[10px] tracking-[0.14em] uppercase font-bold text-amber border border-[#66501e] bg-[#17130a] rounded px-2 py-1">
        In build — not yet functional
      </span>
    </div>
  );
}
