export const StatusLegend = () => (
  <div className="flex flex-wrap justify-center items-center gap-10 text-xs text-muted-foreground mt-2">
    <span className="flex items-center gap-1">
      <span className="w-4 h-4 rounded bg-amber-300/40 border border-amber-400/60" />
      Before start
    </span>
    <span className="flex items-center gap-1">
      <span className="w-4 h-4 rounded bg-sky-300/40 border border-sky-400/60" />
      After end
    </span>
    <span className="flex items-center gap-1">
      <span className="w-4 h-4 rounded bg-red-800/30 border border-red-500/50" />
      Not linked
    </span>
    <span className="flex items-center gap-1">
      <span className="w-4 h-4 rounded bg-slate-500/60 border"></span>
      Billed (locked)
    </span>
    <span className="flex items-center gap-1">
      <span
        className="w-4 h-4 rounded border border-slate-500/60
      bg-[linear-gradient(135deg,transparent_49%,rgb(148_163_184/0.45)_51%)]"
      />
      Partially billed
    </span>

    
    <span className="flex items-center gap-1">
      <span className="w-4 h-4 rounded border border-slate-300/70 dark:border-slate-600/70" />
      Unbilled
    </span>
    <span className="flex items-center gap-1">
      <span className="w-4 h-4 rounded bg-emerald-100 dark:bg-emerald-900/80 border border-emerald-500/50" />
      Selected
    </span>
  </div>
);
