import { FormEvent, useEffect, useState } from "react";
import { TopBar } from "../components/TopBar";
import { Loading, ErrorBanner } from "../components/LoadingAndError";
import { api, ApiClientError } from "../api/client";

interface Topic { key: string; title: string; }
interface Guide { title: string; steps: string[]; }
interface Ticket { id: string; category: string; description: string; status: string; createdAt: string; }

const CATEGORIES = [
  "PAYMENT_PROBLEM", "TOKEN_PROBLEM", "METER_PROBLEM", "BALANCE_PROBLEM",
  "WRONG_CUSTOMER_DETAILS", "REFUND", "OTHER",
];

export default function Support() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [openGuide, setOpenGuide] = useState<Guide | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get<Topic[]>("/support/self-help").then(setTopics);
    api.get<Ticket[]>("/support/tickets").then(setTickets);
  }, []);

  async function viewGuide(key: string) {
    const guide = await api.get<Guide>(`/support/self-help/${key}`);
    setOpenGuide(guide);
  }

  async function submitTicket(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const ticket = await api.post<Ticket>("/support/tickets", { category, description });
      setTickets((prev) => [ticket, ...prev]);
      setDescription("");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't submit your ticket.");
    } finally {
      setSubmitting(false);
    }
  }

  if (openGuide) {
    return (
      <div className="screen">
        <TopBar title={openGuide.title} back={false} right={<button className="btn-ghost" style={{background:"none",border:"none"}} onClick={() => setOpenGuide(null)}>Close</button>} />
        <div className="card">
          <ol style={{ paddingLeft: 18, margin: 0 }}>
            {openGuide.steps.map((s, i) => <li key={i} style={{ marginBottom: 8 }}>{s}</li>)}
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <TopBar title="Support" />

      <div className="section-title">I don't understand my meter</div>
      {topics.length === 0 ? <Loading /> : (
        <div className="card">
          {topics.map((t) => (
            <button key={t.key} className="list-row" style={{ width: "100%", background: "none", border: "none", textAlign: "left" }} onClick={() => viewGuide(t.key)}>
              {t.title} <span>›</span>
            </button>
          ))}
        </div>
      )}

      <div className="section-title">Raise a ticket</div>
      {error && <ErrorBanner message={error} />}
      <form onSubmit={submitTicket} className="card">
        <div className="field">
          <label>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c.replaceAll("_", " ")}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Describe the problem</label>
          <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} required />
        </div>
        <button className="btn btn-primary" disabled={submitting} type="submit">
          {submitting ? "Submitting..." : "Submit ticket"}
        </button>
      </form>

      <div className="section-title">Your tickets</div>
      <div className="card">
        {tickets.length === 0 && <p className="muted">No tickets yet.</p>}
        {tickets.map((t) => (
          <div key={t.id} className="list-row">
            <div>
              <div style={{ fontWeight: 600 }}>{t.category.replaceAll("_", " ")}</div>
              <div className="muted">{new Date(t.createdAt).toLocaleDateString()}</div>
            </div>
            <span className="pill pill-pending">{t.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
