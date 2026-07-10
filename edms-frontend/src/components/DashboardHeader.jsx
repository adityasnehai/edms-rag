const TYPE_METRICS = [
  {
    label: "ADRs",
    key: "adrs",
    bg: "bg-violet-50",
    border: "border-violet-200/70",
    text: "text-violet-700",
    num: "text-stone-950",
  },
  {
    label: "RFCs",
    key: "rfcs",
    bg: "bg-sky-50",
    border: "border-sky-200/70",
    text: "text-sky-700",
    num: "text-stone-950",
  },
  {
    label: "Meeting Notes",
    key: "meeting_notes",
    bg: "bg-emerald-50",
    border: "border-emerald-200/70",
    text: "text-emerald-700",
    num: "text-stone-950",
  },
  {
    label: "Postmortems",
    key: "postmortems",
    bg: "bg-rose-50",
    border: "border-rose-200/70",
    text: "text-rose-700",
    num: "text-stone-950",
  },
  {
    label: "Tickets",
    key: "tickets",
    bg: "bg-amber-50",
    border: "border-amber-200/70",
    text: "text-amber-700",
    num: "text-stone-950",
  },
  {
    label: "Images",
    key: "images",
    bg: "bg-indigo-50",
    border: "border-indigo-200/70",
    text: "text-indigo-700",
    num: "text-stone-950",
  },
];

export default function DashboardHeader({ stats }) {
  return (
    <div className="rounded-2xl border border-border bg-white px-3 py-2.5 shadow-sm">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TYPE_METRICS.map((item) => (
          <StatTile
            key={item.key}
            label={item.label}
            value={stats?.[item.key] ?? 0}
            item={item}
            loading={stats === null}
          />
        ))}
      </div>
    </div>
  );
}

function StatTile({ label, value, item, loading }) {
  return (
    <div className={`flex min-w-[8.5rem] items-center justify-between gap-3 rounded-2xl border ${item.border} ${item.bg} px-3 py-2`}>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-xs font-semibold ${item.text} leading-tight`}>
          {label}
        </p>
      </div>
      {loading ? (
        <div className="h-5 w-7 animate-pulse rounded-lg bg-current opacity-10" />
      ) : (
        <p className={`min-w-7 text-right text-xs font-bold tabular-nums ${item.num}`}>{value}</p>
      )}
    </div>
  );
}
