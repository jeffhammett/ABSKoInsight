import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('abs_book_overrides', (table) => {
    table.string('abs_item_id').primary();
    table.boolean('hidden').defaultTo(false).notNullable();
    table.boolean('deleted').defaultTo(false).notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('abs_book_overrides');
}
