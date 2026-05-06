import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('settings', (table) => {
    table.integer('webdav_sync_interval_hours').defaultTo(0).notNullable();
    table.text('webdav_last_synced_at').nullable();
    table.integer('abs_sync_interval_minutes').defaultTo(0).notNullable();
    table.text('abs_last_synced_at').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('settings', (table) => {
    table.dropColumn('webdav_sync_interval_hours');
    table.dropColumn('webdav_last_synced_at');
    table.dropColumn('abs_sync_interval_minutes');
    table.dropColumn('abs_last_synced_at');
  });
}
