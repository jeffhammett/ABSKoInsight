import { db } from '../knex';

export interface AbsBookOverride {
  abs_item_id: string;
  hidden: boolean;
  deleted: boolean;
  completed: boolean;
  reference_pages: number | null;
}

export class AbsOverridesRepository {
  static async get(absItemId: string): Promise<AbsBookOverride | null> {
    return (await db('abs_book_overrides').where('abs_item_id', absItemId).first()) ?? null;
  }

  static async getAll(): Promise<AbsBookOverride[]> {
    return db('abs_book_overrides').select('*');
  }

  static async upsert(
    absItemId: string,
    data: Partial<Omit<AbsBookOverride, 'abs_item_id'>>
  ): Promise<void> {
    const existing = await db('abs_book_overrides')
      .where('abs_item_id', absItemId)
      .first();
    if (existing) {
      await db('abs_book_overrides').where('abs_item_id', absItemId).update(data);
    } else {
      await db('abs_book_overrides').insert({
        abs_item_id: absItemId,
        hidden: false,
        deleted: false,
        completed: false,
        reference_pages: null,
        ...data,
      });
    }
  }
}
