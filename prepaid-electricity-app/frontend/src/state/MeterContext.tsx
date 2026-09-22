import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "../api/client";
import { useAuth } from "./AuthContext";

export interface Disco {
  id: string;
  name: string;
  shortCode: string;
}

export interface Meter {
  id: string;
  label: string;
  meterNumber: string;
  disco: Disco;
  customerName: string | null;
  meterType: string;
  minimumPurchase: number | null;
  verificationStatus: "UNVERIFIED" | "VERIFIED" | "FAILED";
}

interface MeterContextValue {
  meters: Meter[];
  selectedMeter: Meter | null;
  loading: boolean;
  selectMeter: (id: string) => void;
  refreshMeters: () => Promise<void>;
}

const MeterContext = createContext<MeterContextValue | undefined>(undefined);

export function MeterProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [meters, setMeters] = useState<Meter[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMeters = useCallback(async () => {
    if (!user) {
      setMeters([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await api.get<Meter[]>("/meters");
      setMeters(data);
      setSelectedId((prev) => prev ?? data[0]?.id ?? null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshMeters();
  }, [refreshMeters]);

  const selectMeter = useCallback((id: string) => setSelectedId(id), []);

  const selectedMeter = meters.find((m) => m.id === selectedId) ?? null;

  return (
    <MeterContext.Provider value={{ meters, selectedMeter, loading, selectMeter, refreshMeters }}>
      {children}
    </MeterContext.Provider>
  );
}

export function useMeters() {
  const ctx = useContext(MeterContext);
  if (!ctx) throw new Error("useMeters must be used within MeterProvider");
  return ctx;
}
