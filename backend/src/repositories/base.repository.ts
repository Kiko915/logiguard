import { Databases, Query, ID } from "node-appwrite";
import { databases } from "../lib/appwrite.js";
import { config } from "../config/index.js";

// ─── Base Repository ───────────────────────────────────────────────────────────
// Provides generic CRUD for Appwrite collections.
// Derived repositories add domain-specific query methods.
// mapDoc() normalises Appwrite system fields ($id, $createdAt) into
// the domain shape (id, created_at) so service-layer code is unchanged.
export abstract class BaseRepository {
  protected readonly db: Databases = databases;
  protected readonly dbId: string  = config.APPWRITE_DATABASE_ID;

  constructor(protected readonly collectionId: string) {}

  // Strips Appwrite $ fields and maps $id → id, $createdAt → created_at
  protected mapDoc(doc: Record<string, unknown>): Record<string, unknown> {
    const {
      $id, $createdAt,
      $updatedAt: _u, $collectionId: _c, $databaseId: _d, $permissions: _p,
      ...rest
    } = doc as Record<string, unknown>;
    return { id: $id, created_at: $createdAt, ...rest };
  }

  async findById(id: string) {
    const doc = await this.db.getDocument(this.dbId, this.collectionId, id);
    return this.mapDoc(doc as unknown as Record<string, unknown>);
  }

  async findAll(options: { page: number; per_page: number }) {
    const { page, per_page } = options;
    const offset = (page - 1) * per_page;

    const result = await this.db.listDocuments(this.dbId, this.collectionId, [
      Query.limit(per_page),
      Query.offset(offset),
      Query.orderDesc("$createdAt"),
    ]);

    return {
      data:  result.documents.map((d) => this.mapDoc(d as unknown as Record<string, unknown>)),
      total: result.total,
    };
  }

  async create(data: Record<string, unknown>, documentId?: string) {
    const doc = await this.db.createDocument(
      this.dbId,
      this.collectionId,
      documentId ?? ID.unique(),
      data,
    );
    return this.mapDoc(doc as unknown as Record<string, unknown>);
  }

  async update(id: string, data: Record<string, unknown>) {
    const doc = await this.db.updateDocument(this.dbId, this.collectionId, id, data);
    return this.mapDoc(doc as unknown as Record<string, unknown>);
  }

  async delete(id: string) {
    await this.db.deleteDocument(this.dbId, this.collectionId, id);
  }
}
