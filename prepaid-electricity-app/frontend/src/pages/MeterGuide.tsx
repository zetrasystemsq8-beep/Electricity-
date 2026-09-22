import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { TopBar } from "../components/TopBar";
import { Loading } from "../components/LoadingAndError";
import { api } from "../api/client";

interface Guide {
  hasVerifiedGuide: boolean;
  message?: string;
  manufacturer?: string;
  modelName?: string;
  balanceCheckSteps?: string[];
  tokenLoadSteps?: string[];
  source?: string;
}

export default function MeterGuide() {
  const { meterId } = useParams();
  const [guide, setGuide] = useState<Guide | null>(null);

  useEffect(() => {
    if (meterId) api.get<Guide>(`/meters/${meterId}/guide`).then(setGuide);
  }, [meterId]);

  if (!guide) return <Loading />;

  if (!guide.hasVerifiedGuide) {
    return (
      <div className="screen">
        <TopBar title="Check your meter" back />
        <div className="card">
          <p>{guide.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <TopBar title="Check your meter" back />
      <p className="muted">{guide.manufacturer} · {guide.modelName}</p>

      <div className="section-title">Check balance</div>
      <div className="card">
        <ol style={{ paddingLeft: 18, margin: 0 }}>
          {guide.balanceCheckSteps?.map((s, i) => <li key={i} style={{ marginBottom: 8 }}>{s}</li>)}
        </ol>
      </div>

      <div className="section-title">Load token</div>
      <div className="card">
        <ol style={{ paddingLeft: 18, margin: 0 }}>
          {guide.tokenLoadSteps?.map((s, i) => <li key={i} style={{ marginBottom: 8 }}>{s}</li>)}
        </ol>
      </div>

      {guide.source && <p className="muted" style={{ marginTop: 10 }}>Source: {guide.source}</p>}
    </div>
  );
}
