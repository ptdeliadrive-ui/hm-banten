import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { type Income, sampleIncomes } from "./store";
import { supabase } from "@/integrations/supabase/client";

interface IncomeContextType {
  incomes: Income[];
  setIncomes: React.Dispatch<React.SetStateAction<Income[]>>;
}

const IncomeContext = createContext<IncomeContextType | null>(null);

function mapRowToIncome(row: any): Income {
  return {
    id: row.id,
    memberId: row.member_id,
    memberName: row.member_name,
    date: row.date || "",
    amount: Number(row.amount || 0),
    month: row.month,
    year: row.year,
    status: row.status,
    notes: row.notes || "",
    proofUrl: row.proof_url || undefined,
    proofFileId: row.proof_file_id || undefined,
    proofFileName: row.proof_file_name || undefined,
  };
}

function mapIncomeToRow(income: Income) {
  return {
    id: income.id,
    member_id: income.memberId,
    member_name: income.memberName,
    date: income.date || null,
    amount: income.amount,
    month: income.month,
    year: income.year,
    status: income.status,
    notes: income.notes || "",
    proof_url: income.proofUrl || null,
    proof_file_id: income.proofFileId || null,
    proof_file_name: income.proofFileName || null,
  };
}

export function IncomeProvider({ children }: { children: React.ReactNode }) {
  const [incomesState, setIncomesState] = useState<Income[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const { data, error } = await supabase.from("incomes").select("*").order("created_at", { ascending: false });
      if (!active) return;

      if (error) {
        console.error("Failed to load incomes from Supabase", error);
        setIncomesState(sampleIncomes);
      } else {
        setIncomesState((data || []).map(mapRowToIncome));
      }

      setLoaded(true);
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const persistIncomes = useCallback(async (next: Income[]) => {
    const { data: existingRows, error: existingError } = await supabase.from("incomes").select("id");
    if (existingError) {
      console.error("Failed to read existing incomes", existingError);
      return;
    }

    if (next.length > 0) {
      const { error: upsertError } = await supabase.from("incomes").upsert(next.map(mapIncomeToRow), { onConflict: "id" });
      if (upsertError) {
        console.error("Failed to upsert incomes", upsertError);
        return;
      }
    }

    const nextIds = new Set(next.map((i) => i.id));
    const idsToDelete = (existingRows || []).map((r) => r.id).filter((id) => !nextIds.has(id));

    if (idsToDelete.length > 0) {
      const { error: deleteError } = await supabase.from("incomes").delete().in("id", idsToDelete);
      if (deleteError) {
        console.error("Failed to delete removed incomes", deleteError);
      }
    }
  }, []);

  const setIncomes = useCallback<React.Dispatch<React.SetStateAction<Income[]>>>((value) => {
    setIncomesState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      if (loaded) {
        void persistIncomes(next);
      }
      return next;
    });
  }, [loaded, persistIncomes]);

  const incomes = incomesState;

  return (
    <IncomeContext.Provider value={{ incomes, setIncomes }}>
      {children}
    </IncomeContext.Provider>
  );
}

export function useIncomes() {
  const ctx = useContext(IncomeContext);
  if (!ctx) throw new Error("useIncomes must be used within IncomeProvider");
  return ctx;
}
