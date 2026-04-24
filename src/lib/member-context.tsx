import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { type Member, sampleMembers } from "./store";
import { supabase } from "@/integrations/supabase/client";

interface MemberContextType {
  members: Member[];
  setMembers: React.Dispatch<React.SetStateAction<Member[]>>;
}

const MemberContext = createContext<MemberContextType | null>(null);

function mapRowToMember(row: any): Member {
  return {
    id: row.id,
    namaPT: row.nama_pt,
    bidangUsaha: row.bidang_usaha,
    noSPBU: row.no_spbu || undefined,
    wilayah: row.wilayah,
    phone: row.phone,
    email: row.email,
    status: row.status,
  };
}

function mapMemberToRow(member: Member) {
  return {
    id: member.id,
    nama_pt: member.namaPT,
    bidang_usaha: member.bidangUsaha,
    no_spbu: member.noSPBU || null,
    wilayah: member.wilayah,
    phone: member.phone,
    email: member.email,
    status: member.status,
  };
}

export function MemberProvider({ children }: { children: React.ReactNode }) {
  const [membersState, setMembersState] = useState<Member[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const { data, error } = await supabase.from("members").select("*").order("created_at", { ascending: false });
      if (!active) return;

      if (error) {
        console.error("Failed to load members from Supabase", error);
        setMembersState(sampleMembers);
      } else {
        setMembersState((data || []).map(mapRowToMember));
      }

      setLoaded(true);
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const persistMembers = useCallback(async (next: Member[]) => {
    const { data: existingRows, error: existingError } = await supabase.from("members").select("id");
    if (existingError) {
      console.error("Failed to read existing members", existingError);
      return;
    }

    if (next.length > 0) {
      const { error: upsertError } = await supabase
        .from("members")
        .upsert(next.map(mapMemberToRow), { onConflict: "id" });

      if (upsertError) {
        console.error("Failed to upsert members", upsertError);
        return;
      }
    }

    const nextIds = new Set(next.map((m) => m.id));
    const idsToDelete = (existingRows || []).map((r) => r.id).filter((id) => !nextIds.has(id));

    if (idsToDelete.length > 0) {
      const { error: deleteError } = await supabase.from("members").delete().in("id", idsToDelete);
      if (deleteError) {
        console.error("Failed to delete removed members", deleteError);
      }
    }
  }, []);

  const setMembers = useCallback<React.Dispatch<React.SetStateAction<Member[]>>>((value) => {
    setMembersState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      if (loaded) {
        void persistMembers(next);
      }
      return next;
    });
  }, [loaded, persistMembers]);

  const members = membersState;

  return (
    <MemberContext.Provider value={{ members, setMembers }}>
      {children}
    </MemberContext.Provider>
  );
}

export function useMembers() {
  const ctx = useContext(MemberContext);
  if (!ctx) throw new Error("useMembers must be used within MemberProvider");
  return ctx;
}
