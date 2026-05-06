import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('settings', (table) => {
    table.integer('id').primary().defaultTo(1);
    table.text('webdav_url').nullable();
    table.text('webdav_username').nullable();
    table.text('webdav_password').nullable();
    table.text('webdav_db_path').nullable();
    table.text('abs_url').nullable();
    table.text('abs_api_key').nullable();
  });
  await knex('settings').insert({ id: 1 });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('settings');
}
