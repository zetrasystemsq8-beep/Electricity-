import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMeters } from "../state/MeterContext";
import { useAuth } from "../state/AuthContext";
import { api, ApiClientError } from "../api/client";
import { TopBar } from "../components/TopBar";
import { ErrorBanner } from "../components/LoadingAndError";

declare global {
  interface Window {
    PaystackPop?: { setup: (opts: Record<string, unknown>) => { openIframe: () => void } };
  }
}

interface InitiateResult {
  purchaseId: string;
  transactionId: string;
  internalRef: string;
  amount: number;
  meter: { id: string; label: string; meterNumber: string; disco: string };
  paymentConfigured: boolean;
  paystackPublicNote?: string;
}

export default function Confirm() {
  const location = useLocation() as { state?: { meterId: string; amount: number } };
  const navigate = useNavigate();
  const { meters } = useMeters();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [initiated, setInitiated] = useState<InitiateResult | null>(null);

  const meterId = location.state?.meterId;
  const amount = location.state?.amount;
  const meter = meters.find((m) => m.id === meterId);

  if (!meter || !amount) {
    return (
      <div className="screen">
        <TopBar title="Confirm purchase" back />
        <ErrorBanner message="Missing purchase details. Please start again from Buy." />
        <button className="btn btn-secondary" onClick={() => navigate("/buy")}>Back to Buy</button>
      </div>
    );
  }

  async function startPayment() {
    setError(null);
    setBusy(true);
    try {
      const result = await api.post<InitiateResult>("/purchases/initiate", { meterId: meter!.id, amount });
      setInitiated(result);

      if (!result.paymentConfigured) {
        setError(result.paystackPublicNote ?? "Payments aren't configured yet.");
        setBusy(false);
        return;
      }

      if (!window.PaystackPop) {
        setError("Payment script failed to load. Check your connection and try again.");
        setBusy(false);
        return;
      }

      const handler = window.PaystackPop.setup({
        key: "pk_test_placeholder", // replace with your real Paystack public key
        email: `${user?.phoneNumber}@powerpal.ng`,
        amount: Math.round(amount * 100),
        currency: "NGN",
        ref: result.internalRef,
        metadata: { transactionId: result.transactionId, userId: user?.id },
        callback: (response: { reference: string }) => {
          confirmAndVend(result.transactionId, response.reference);
        },
        onClose: () => setBusy(false),
      });
      handler.openIframe();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't start this purchase.");
      setBusy(false);
    }
  }

  async function confirmAndVend(transactionId: string, processorRef: string) {
    try {
      const txn = await api.post<{ id: string; status: string }>("/purchases/confirm", {
        transactionId,
        processorRef,
      });
      navigate("/purchase/success", { state: { transactionId: txn.id } });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Payment succeeded but vending failed. Check History.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <TopBar title="Confirm purchase" back />
      {error && <ErrorBanner message={error} />}

      <div className="card">
        <Row label="Meter" value={meter.meterNumber} />
        <Row label="Customer" value={meter.customerName ?? "—"} />
        <Row label="DISCO" value={meter.disco.name} />
        <Row label="Amount" value={`₦${amount.toLocaleString()}`} />
        <Row label="Expected electricity information" value="Based on provider response" />
      </div>

      <button className="btn btn-primary" style={{ marginTop: 20 }} disabled={busy} onClick={startPayment}>
        {busy ? "Processing..." : `Pay ₦${amount.toLocaleString()}`}
      </button>

      {initiated && !initiated.paymentConfigured && (
        <p className="muted" style={{ marginTop: 10 }}>
          The transaction was created (ref: {initiated.internalRef}) but payment collection needs a real
          Paystack key configured in the backend before it can complete.
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="list-row">
      <span className="muted">{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
