const TYPE_METRICS = [
  {
    label: "ADRs",
    key: "adrs",
    accentClass: "border-violet-200 bg-violet-50 text-violet-700",
    dotClass: "bg-violet-500",
  },
  {
    label: "RFCs",
    key: "rfcs",
    accentClass: "border-sky-200 bg-sky-50 text-sky-700",
    dotClass: "bg-sky-500",
  },
  {
    label: "Meeting Notes",
    key: "meeting_notes",
    accentClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dotClass: "bg-emerald-500",
  },
  {
    label: "Postmortems",
    key: "postmortems",
    accentClass: "border-rose-200 bg-rose-50 text-rose-700",
    dotClass: "bg-rose-500",
  },
  {
    label: "Tickets",
    key: "tickets",
    accentClass: "border-amber-200 bg-amber-50 text-amber-700",
    dotClass: "bg-amber-500",
  },
  {
    label: "Diagrams",
    key: "images",
    accentClass: "border-indigo-200 bg-indigo-50 text-indigo-700",
    dotClass: "bg-indigo-500",
  },
];

export default function DashboardHeader({ stats }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {TYPE_METRICS.map((item) => (
        <CountTile
          key={item.key}
          label={item.label}
          value={stats?.[item.key] ?? 0}
          accentClass={item.accentClass}
          dotClass={item.dotClass}
        />
      ))}
    </div>
  );
}

function CountTile({ label, value, accentClass, dotClass }) {
  return (
    <div
      className={`inline-flex shrink-0 items-center gap-2 rounded-[18px] border px-3 py-2 shadow-sm ${accentClass}`}
    >
      <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
      <p className="text-[11px] font-semibold tracking-[0.12em] whitespace-nowrap">
        {label}
      </p>
      <p className="rounded-full bg-white/80 px-2 py-0.5 text-sm font-semibold tracking-tight text-foreground">
        {value}
      </p>
    </div>
  );
}
