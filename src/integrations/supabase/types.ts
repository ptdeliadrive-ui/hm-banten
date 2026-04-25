export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      incomes: {
        Row: {
          amount: number
          created_at: string
          date: string | null
          id: string
          member_id: string
          member_name: string
          month: string
          notes: string
          proof_file_id: string | null
          proof_file_name: string | null
          proof_url: string | null
          status: string
          updated_at: string
          year: number
        }
        Insert: {
          amount: number
          created_at?: string
          date?: string | null
          id: string
          member_id: string
          member_name: string
          month: string
          notes?: string
          proof_file_id?: string | null
          proof_file_name?: string | null
          proof_url?: string | null
          status: string
          updated_at?: string
          year: number
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string | null
          id?: string
          member_id?: string
          member_name?: string
          month?: string
          notes?: string
          proof_file_id?: string | null
          proof_file_name?: string | null
          proof_url?: string | null
          status?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "incomes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_expenses: {
        Row: {
          account_number: string
          amount: number
          bank: string
          bank_code: string
          created_at: string
          date: string
          id: string
          notes: string
          recipient: string
          spm_number: string
          spm_status: string
          type: string
          updated_at: string
        }
        Insert: {
          account_number: string
          amount: number
          bank: string
          bank_code: string
          created_at?: string
          date: string
          id: string
          notes?: string
          recipient: string
          spm_number: string
          spm_status: string
          type: string
          updated_at?: string
        }
        Update: {
          account_number?: string
          amount?: number
          bank?: string
          bank_code?: string
          created_at?: string
          date?: string
          id?: string
          notes?: string
          recipient?: string
          spm_number?: string
          spm_status?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      bank_reconciliations: {
        Row: {
          created_at: string
          created_by_role: string
          created_by_user_id: string | null
          id: number
          notes: string
          period_month: number | null
          period_year: number
          saldo_awal: number
          saldo_bank: number
          saldo_buku: number
          selisih: number
          total_pemasukan: number
          total_pengeluaran: number
        }
        Insert: {
          created_at?: string
          created_by_role?: string
          created_by_user_id?: string | null
          id?: number
          notes?: string
          period_month?: number | null
          period_year: number
          saldo_awal?: number
          saldo_bank?: number
          saldo_buku?: number
          selisih?: number
          total_pemasukan?: number
          total_pengeluaran?: number
        }
        Update: {
          created_at?: string
          created_by_role?: string
          created_by_user_id?: string | null
          id?: number
          notes?: string
          period_month?: number | null
          period_year?: number
          saldo_awal?: number
          saldo_bank?: number
          saldo_buku?: number
          selisih?: number
          total_pemasukan?: number
          total_pengeluaran?: number
        }
        Relationships: []
      }
      rekap_iuran_spm_notes: {
        Row: {
          created_at: string
          created_by_role: string
          created_by_user_id: string | null
          id: number
          no_spm: string
          period_month: number
          period_year: number
        }
        Insert: {
          created_at?: string
          created_by_role?: string
          created_by_user_id?: string | null
          id?: number
          no_spm?: string
          period_month: number
          period_year: number
        }
        Update: {
          created_at?: string
          created_by_role?: string
          created_by_user_id?: string | null
          id?: number
          no_spm?: string
          period_month?: number
          period_year?: number
        }
        Relationships: []
      }
      rekap_iuran_tabung_values: {
        Row: {
          created_at: string
          created_by_role: string
          created_by_user_id: string | null
          id: number
          member_id: string
          period_month: number
          period_year: number
          total_tabung: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_role?: string
          created_by_user_id?: string | null
          id?: number
          member_id: string
          period_month: number
          period_year: number
          total_tabung?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_role?: string
          created_by_user_id?: string | null
          id?: number
          member_id?: string
          period_month?: number
          period_year?: number
          total_tabung?: number
          updated_at?: string
        }
        Relationships: []
      }
      members: {
        Row: {
          bidang_usaha: string
          created_at: string
          email: string
          id: string
          nama_pt: string
          no_spbu: string | null
          phone: string
          status: string
          updated_at: string
          wilayah: string
        }
        Insert: {
          bidang_usaha: string
          created_at?: string
          email: string
          id: string
          nama_pt: string
          no_spbu?: string | null
          phone: string
          status: string
          updated_at?: string
          wilayah: string
        }
        Update: {
          bidang_usaha?: string
          created_at?: string
          email?: string
          id?: string
          nama_pt?: string
          no_spbu?: string | null
          phone?: string
          status?: string
          updated_at?: string
          wilayah?: string
        }
        Relationships: []
      }
      saved_accounts: {
        Row: {
          atas_nama: string
          bank_code: string
          bank_name: string
          created_at: string
          id: string
          rekening: string
          updated_at: string
        }
        Insert: {
          atas_nama: string
          bank_code: string
          bank_name: string
          created_at?: string
          id: string
          rekening: string
          updated_at?: string
        }
        Update: {
          atas_nama?: string
          bank_code?: string
          bank_name?: string
          created_at?: string
          id?: string
          rekening?: string
          updated_at?: string
        }
        Relationships: []
      }
      spm_change_logs: {
        Row: {
          action: string
          actor_role: string
          actor_user_id: string
          after_data: Json | null
          before_data: Json | null
          created_at: string
          id: number
          reason: string
          spm_id: string
          spm_number: string
        }
        Insert: {
          action: string
          actor_role: string
          actor_user_id: string
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: number
          reason: string
          spm_id: string
          spm_number: string
        }
        Update: {
          action?: string
          actor_role?: string
          actor_user_id?: string
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: number
          reason?: string
          spm_id?: string
          spm_number?: string
        }
        Relationships: []
      }
      spm_delete_requests: {
        Row: {
          approved_at: string | null
          approved_by_user_id: string | null
          created_at: string
          id: number
          reason: string
          requested_by_role: string
          requested_by_user_id: string
          spm_id: string
          spm_number: string
          status: string
        }
        Insert: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          created_at?: string
          id?: number
          reason: string
          requested_by_role: string
          requested_by_user_id: string
          spm_id: string
          spm_number: string
          status?: string
        }
        Update: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          created_at?: string
          id?: number
          reason?: string
          requested_by_role?: string
          requested_by_user_id?: string
          spm_id?: string
          spm_number?: string
          status?: string
        }
        Relationships: []
      }
      spm_documents: {
        Row: {
          approved_bendahara_at: string | null
          approved_bendahara_user_id: string | null
          approved_ketua_at: string | null
          approved_ketua_user_id: string | null
          created_at: string
          id: string
          kategori: string
          lokasi: string
          nama_bendahara: string
          nama_ketua: string
          nomor_spm: string
          status: string
          tanggal: string
          total: number
          tujuan: string
          updated_at: string
        }
        Insert: {
          approved_bendahara_at?: string | null
          approved_bendahara_user_id?: string | null
          approved_ketua_at?: string | null
          approved_ketua_user_id?: string | null
          created_at?: string
          id: string
          kategori?: string
          lokasi: string
          nama_bendahara: string
          nama_ketua: string
          nomor_spm: string
          status: string
          tanggal: string
          total: number
          tujuan: string
          updated_at?: string
        }
        Update: {
          approved_bendahara_at?: string | null
          approved_bendahara_user_id?: string | null
          approved_ketua_at?: string | null
          approved_ketua_user_id?: string | null
          created_at?: string
          id?: string
          kategori?: string
          lokasi?: string
          nama_bendahara?: string
          nama_ketua?: string
          nomor_spm?: string
          status?: string
          tanggal?: string
          total?: number
          tujuan?: string
          updated_at?: string
        }
        Relationships: []
      }
      spm_line_items: {
        Row: {
          atas_nama: string
          bank_code: string
          bank_name: string
          created_at: string
          id: string
          jumlah: number
          kategori: string
          rekening: string
          spm_id: string
          updated_at: string
          uraian: string
        }
        Insert: {
          atas_nama: string
          bank_code: string
          bank_name: string
          created_at?: string
          id: string
          jumlah: number
          kategori?: string
          rekening: string
          spm_id: string
          updated_at?: string
          uraian: string
        }
        Update: {
          atas_nama?: string
          bank_code?: string
          bank_name?: string
          created_at?: string
          id?: string
          jumlah?: number
          kategori?: string
          rekening?: string
          spm_id?: string
          updated_at?: string
          uraian?: string
        }
        Relationships: [
          {
            foreignKeyName: "spm_line_items_spm_id_fkey"
            columns: ["spm_id"]
            isOneToOne: false
            referencedRelation: "spm_documents"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
