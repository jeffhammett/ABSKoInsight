import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('abs_book_overrides', (table) => {
    table.integer('reference_pages').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('abs_book_overrides', (table) => {
    table.dropColumn('reference_pages');
  });
}
