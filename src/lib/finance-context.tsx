import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { normalizeSPMStatus, type SPMDocument, sampleSPMs } from "./spm-store";
import { type Expense, sampleExpenses } from "./store";
import { spmToExpenses } from "./expense-store";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FinanceContextType {
  spms: SPMDocument[];
  setSPMs: React.Dispatch<React.SetStateAction<SPMDocument[]>>;
  reloadSPMs: () => Promise<void>;
  manualExpenses: Expense[];
  setManualExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  allExpenses: Expense[];
}

const FinanceContext = createContext<FinanceContextType | null>(null);

function mapRowToSPM(row: any, items: any[]): SPMDocument {
  return {
    id: row.id,
    nomorSPM: row.nomor_spm,
    tanggal: row.tanggal,
    tujuan: row.tujuan,
    lokasi: row.lokasi,
    kategori: row.kategori || 'Lain-lain',
    items: items.map((item) => ({
      id: item.id,
      uraian: item.uraian,
      kategori: item.kategori || row.kategori || "Lain-lain",
      bankCode: item.bank_code,
      bankName: item.bank_name,
      rekening: item.rekening,
      atasNama: item.atas_nama,
      jumlah: Number(item.jumlah || 0),
    })),
    total: Number(row.total || 0),
    status: normalizeSPMStatus(row.status),
    namaKetua: row.nama_ketua,
    namaBendahara: row.nama_bendahara,
    approvedBendaharaAt: row.approved_bendahara_at,
    approvedBendaharaUserId: row.approved_bendahara_user_id,
    approvedKetuaAt: row.approved_ketua_at,
    approvedKetuaUserId: row.approved_ketua_user_id,
    createdAt: row.created_at,
  };
}

function mapSPMToRow(spm: SPMDocument) {
  return {
    id: spm.id,
    nomor_spm: spm.nomorSPM,
    tanggal: spm.tanggal,
    tujuan: spm.tujuan,
    lokasi: spm.lokasi,
    kategori: spm.kategori,
    total: spm.total,
    status: spm.status,
    nama_ketua: spm.namaKetua,
    nama_bendahara: spm.namaBendahara,
    approved_bendahara_at: spm.approvedBendaharaAt || null,
    approved_bendahara_user_id: spm.approvedBendaharaUserId || null,
    approved_ketua_at: spm.approvedKetuaAt || null,
    approved_ketua_user_id: spm.approvedKetuaUserId || null,
    created_at: spm.createdAt || new Date().toISOString(),
  };
}

function mapSPMItemToRow(spm: SPMDocument, item: SPMDocument["items"][number]) {
  return {
    id: item.id,
    spm_id: spm.id,
    uraian: item.uraian,
    kategori: item.kategori || spm.kategori || "Lain-lain",
    bank_code: item.bankCode,
    bank_name: item.bankName,
    rekening: item.rekening,
    atas_nama: item.atasNama,
    jumlah: item.jumlah,
  };
}

function mapRowToManualExpense(row: any): Expense {
  return {
    id: row.id,
    spmNumber: row.spm_number,
    date: row.date,
    type: row.type,
    amount: Number(row.amount || 0),
    recipient: row.recipient,
    accountNumber: row.account_number,
    bank: row.bank,
    bankCode: row.bank_code,
    notes: row.notes || "",
    spmStatus: row.spm_status,
  };
}

function mapManualExpenseToRow(expense: Expense) {
  return {
    id: expense.id,
    spm_number: expense.spmNumber,
    date: expense.date,
    type: expense.type,
    amount: expense.amount,
    recipient: expense.recipient,
    account_number: expense.accountNumber,
    bank: expense.bank,
    bank_code: expense.bankCode,
    notes: expense.notes || "",
    spm_status: expense.spmStatus,
  };
}

function shallowEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

function normalizeItems(items: SPMDocument["items"]) {
  return [...items]
    .map((item) => ({
      id: item.id,
      uraian: item.uraian,
      kategori: item.kategori,
      bankCode: item.bankCode,
      bankName: item.bankName,
      rekening: item.rekening,
      atasNama: item.atasNama,
      jumlah: item.jumlah,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function isItemsEqual(a: SPMDocument["items"], b: SPMDocument["items"]) {
  return JSON.stringify(normalizeItems(a)) === JSON.stringify(normalizeItems(b));
}

export function FinanceProvider({ children, loadManualExpenses = true }: { children: React.ReactNode; loadManualExpenses?: boolean }) {
  const [spmsState, setSPMsState] = useState<SPMDocument[]>([]);
  const [manualExpensesState, setManualExpensesState] = useState<Expense[]>([]);
  const [loaded, setLoaded] = useState(false);
  const spmSyncQueue = useRef<Promise<void>>(Promise.resolve());
  const manualSyncQueue = useRef<Promise<void>>(Promise.resolve());

  const reloadSPMs = useCallback(async () => {
    const [{ data: docs, error: docsError }, { data: items, error: itemsError }] = await Promise.all([
      supabase.from("spm_documents").select("*").order("created_at", { ascending: false }),
      supabase.from("spm_line_items").select("*"),
    ]);

    if (docsError || itemsError) {
      console.error("Failed to reload SPM data from Supabase", { docsError, itemsError });
      toast.error("Gagal memuat ulang data SPM");
      return;
    }

    const itemBySpm: Record<string, any[]> = {};
    (items || []).forEach((item) => {
      if (!itemBySpm[item.spm_id]) itemBySpm[item.spm_id] = [];
      itemBySpm[item.spm_id].push(item);
    });

    setSPMsState((docs || []).map((row) => mapRowToSPM(row, itemBySpm[row.id] || [])));
  }, []);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const [{ data: docs, error: docsError }, { data: items, error: itemsError }, manualResult] = await Promise.all([
        supabase.from("spm_documents").select("*").order("created_at", { ascending: false }),
        supabase.from("spm_line_items").select("*"),
        loadManualExpenses
          ? supabase.from("manual_expenses").select("*").order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ]);

      const manual = manualResult.data;
      const manualError = manualResult.error;

      if (!active) return;

      if (docsError || itemsError || manualError) {
        console.error("Failed to load finance data from Supabase", { docsError, itemsError, manualError });
        toast.error("Gagal memuat data keuangan dari Supabase");
        setSPMsState(sampleSPMs);
        setManualExpensesState(sampleExpenses);
        setLoaded(true);
        return;
      }

      const itemBySpm: Record<string, any[]> = {};
      (items || []).forEach((item) => {
        if (!itemBySpm[item.spm_id]) itemBySpm[item.spm_id] = [];
        itemBySpm[item.spm_id].push(item);
      });

      setSPMsState((docs || []).map((row) => mapRowToSPM(row, itemBySpm[row.id] || [])));
      setManualExpensesState((manual || []).map(mapRowToManualExpense));
      setLoaded(true);
    };

    void load();

    return () => {
      active = false;
    };
  }, [loadManualExpenses]);

  const persistSPMs = useCallback(async (prev: SPMDocument[], next: SPMDocument[]) => {
    const prevMap = new Map(prev.map((s) => [s.id, s]));
    const nextMap = new Map(next.map((s) => [s.id, s]));

    const toUpsertDocs = next.filter((spm) => {
      const existing = prevMap.get(spm.id);
      if (!existing) return true;
      return !shallowEqual(mapSPMToRow(existing), mapSPMToRow(spm));
    });

    const toDeleteDocIds = prev.filter((spm) => !nextMap.has(spm.id)).map((spm) => spm.id);

    if (toUpsertDocs.length > 0) {
      const { error } = await supabase.from("spm_documents").upsert(toUpsertDocs.map(mapSPMToRow), { onConflict: "id" });
      if (error) {
        console.error("Failed to upsert SPM documents", error);
        toast.error("Gagal menyimpan data SPM");
        return;
      }
    }

    if (toDeleteDocIds.length > 0) {
      const { error } = await supabase.from("spm_documents").delete().in("id", toDeleteDocIds);
      if (error) {
        console.error("Failed to delete removed SPM documents", error);
        toast.error("Gagal menghapus data SPM");
        return;
      }
    }

    const affectedForItems = next
      .filter((spm) => {
        const existing = prevMap.get(spm.id);
        return !existing || !isItemsEqual(existing.items, spm.items);
      })
      .map((spm) => spm.id);

    for (const spmId of affectedForItems) {
      const prevSpm = prevMap.get(spmId);
      const nextSpm = nextMap.get(spmId);
      if (!nextSpm) continue;

      const prevItems = prevSpm?.items || [];
      const prevItemsMap = new Map(prevItems.map((i) => [i.id, i]));
      const nextItemsMap = new Map(nextSpm.items.map((i) => [i.id, i]));

      const upsertItems = nextSpm.items.filter((item) => {
        const existing = prevItemsMap.get(item.id);
        if (!existing) return true;
        return !shallowEqual(mapSPMItemToRow(nextSpm, existing), mapSPMItemToRow(nextSpm, item));
      });

      const deleteItemIds = prevItems.filter((item) => !nextItemsMap.has(item.id)).map((item) => item.id);

      if (upsertItems.length > 0) {
        const { error } = await supabase
          .from("spm_line_items")
          .upsert(upsertItems.map((item) => mapSPMItemToRow(nextSpm, item)), { onConflict: "id" });
        if (error) {
          console.error("Failed to upsert SPM line items", error);
          toast.error("Gagal menyimpan rincian SPM");
          return;
        }
      }

      if (deleteItemIds.length > 0) {
        const { error } = await supabase.from("spm_line_items").delete().in("id", deleteItemIds);
        if (error) {
          console.error("Failed to delete removed SPM line items", error);
          toast.error("Gagal menghapus rincian SPM");
          return;
        }
      }
    }
  }, []);

  const persistManualExpenses = useCallback(async (prev: Expense[], next: Expense[]) => {
    const prevMap = new Map(prev.map((e) => [e.id, e]));
    const nextMap = new Map(next.map((e) => [e.id, e]));

    const toUpsert = next.filter((expense) => {
      const existing = prevMap.get(expense.id);
      if (!existing) return true;
      return !shallowEqual(mapManualExpenseToRow(existing), mapManualExpenseToRow(expense));
    });

    const toDeleteIds = prev.filter((expense) => !nextMap.has(expense.id)).map((expense) => expense.id);

    if (toUpsert.length > 0) {
      const { error } = await supabase.from("manual_expenses").upsert(toUpsert.map(mapManualExpenseToRow), { onConflict: "id" });
      if (error) {
        console.error("Failed to upsert manual expenses", error);
        toast.error("Gagal menyimpan pengeluaran manual");
        return;
      }
    }

    if (toDeleteIds.length > 0) {
      const { error } = await supabase.from("manual_expenses").delete().in("id", toDeleteIds);
      if (error) {
        console.error("Failed to delete removed manual expenses", error);
        toast.error("Gagal menghapus pengeluaran manual");
      }
    }
  }, []);

  const setSPMs = useCallback<React.Dispatch<React.SetStateAction<SPMDocument[]>>>((value) => {
    setSPMsState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      if (loaded) {
        const prevSnapshot = prev;
        const nextSnapshot = next;
        spmSyncQueue.current = spmSyncQueue.current.then(() => persistSPMs(prevSnapshot, nextSnapshot));
      }
      return next;
    });
  }, [loaded, persistSPMs]);

  const setManualExpenses = useCallback<React.Dispatch<React.SetStateAction<Expense[]>>>((value) => {
    setManualExpensesState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      if (loaded) {
        const prevSnapshot = prev;
        const nextSnapshot = next;
        manualSyncQueue.current = manualSyncQueue.current.then(() => persistManualExpenses(prevSnapshot, nextSnapshot));
      }
      return next;
    });
  }, [loaded, persistManualExpenses]);

  const spms = spmsState;
  const manualExpenses = manualExpensesState;

  const spmExpenses = spmToExpenses(spms);
  const allExpenses = [...spmExpenses, ...manualExpenses];

  return (
    <FinanceContext.Provider value={{ spms, setSPMs, reloadSPMs, manualExpenses, setManualExpenses, allExpenses }}>
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance must be used within FinanceProvider");
  return ctx;
}
