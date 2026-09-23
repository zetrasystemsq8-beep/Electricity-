export function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    LIVE_METER: { label: "Live meter balance", cls: "pill-live" },
    ESTIMATED: { label: "Estimated from your usage", cls: "pill-estimated" },
    USER_ENTERED_READING: { label: "From your last reading", cls: "pill-estimated" },
    SUCCESSFUL: { label: "Successful", cls: "pill-success" },
    PENDING: { label: "Pending", cls: "pill-pending" },
    PROCESSING: { label: "Processing", cls: "pill-pending" },
    FAILED: { label: "Failed", cls: "pill-failed" },
    REVERSED: { label: "Reversed", cls: "pill-failed" },
    REFUNDED: { label: "Refunded", cls: "pill-pending" },
  };
  const entry = map[status] ?? { label: status, cls: "pill-estimated" };
  return <span className={`pill ${entry.cls}`}>{entry.label}</span>;
}
