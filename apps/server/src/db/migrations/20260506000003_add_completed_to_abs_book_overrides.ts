import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('abs_book_overrides', (table) => {
    table.boolean('completed').defaultTo(false).notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('abs_book_overrides', (table) => {
    table.dropColumn('completed');
  });
}
