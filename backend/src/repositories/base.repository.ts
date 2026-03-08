import { supabase } from "../lib/supabase.js";
import type { Database } from "../types/database.types.js";

type TableName = keyof Database["public"]["Tables"];

// ─── Base Repository ───────────────────────────────────────────────────────────
// Provides generic CRUD operations. Domain repositories extend this class
// and add query methods specific to their table.
export abstract class BaseRepository<T extends TableName> {
  protected readonly client = supabase;

  constructor(protected readonly table: T) {}

  protected get query() {
    return this.client.from(this.table);
  }

  async findById(id: string) {
    const { data, error } = await this.query
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  }

  async findAll(options: { page: number; per_page: number }) {
    const { page, per_page } = options;
    const from = (page - 1) * per_page;
    const to = from + per_page - 1;

    const { data, error, count } = await this.query
      .select("*", { count: "exact" })
      .range(from, to)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return { data: data ?? [], total: count ?? 0 };
  }

  async create(payload: Database["public"]["Tables"][T]["Insert"]) {
    const { data, error } = await this.query
      .insert(payload as never)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  async update(id: string, payload: Database["public"]["Tables"][T]["Update"]) {
    const { data, error } = await this.query
      .update(payload as never)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  async delete(id: string) {
    const { error } = await this.query.delete().eq("id", id);
    if (error) throw error;
  }
}
