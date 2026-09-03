import { ModulePreview, type ModuleKey } from "@/components/console/previews";
import { TopBar, StatusBar, Chip } from "@/components/console";

export default function Stub({ title, note, k, subtitle }: { title: string; note: string; k: ModuleKey; subtitle?: string }) {
  return (
    <div className="flex flex-col h-screen">
      <TopBar title={title} subtitle={subtitle}>
        <span className="ml-auto"><Chip tone="amber">in build · preview of the finished screen</Chip></span>
      </TopBar>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-[1400px] px-8 py-8">
          <p className="c-body max-w-2xl">{note}</p>
          <div className="mt-8 border border-line bg-rail">
            <div className="h-[46px] border-b border-line flex items-center px-5 gap-3">
              <span className="c-label">{title}</span>
              <span className="mono text-[11px] text-[#657a8e]">demonstration case 2026-CHD-0417</span>
              <span className="ml-auto"><Chip tone="mut">design preview · not live data</Chip></span>
            </div>
            <div className="p-8 max-w-[900px]">
              <ModulePreview k={k} />
            </div>
          </div>
        </div>
      </div>
      <StatusBar left="module under construction — the preview above is the target design, not live output" />
    </div>
  );
}
