import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('abs_book_overrides', (table) => {
    table.text('series').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('abs_book_overrides', (table) => {
    table.dropColumn('series');
  });
}
