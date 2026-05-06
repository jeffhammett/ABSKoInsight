import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('book', (table) => {
    table.boolean('completed_override').defaultTo(false).notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('book', (table) => {
    table.dropColumn('completed_override');
  });
}
