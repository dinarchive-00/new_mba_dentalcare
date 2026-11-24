const path = require('path');
const pool = require('../config/database');

async function main() {
  try {
    const files = require('fs').readdirSync(path.join(__dirname, 'migrations'))
      .filter((name) => name.endsWith('.js'))
      .sort();
    const { rows: tableRows } = await pool.query("SELECT to_regclass('public.pgmigrations') AS migration_table");
    const applied = tableRows[0].migration_table
      ? (await pool.query('SELECT name FROM public.pgmigrations ORDER BY run_on, id')).rows.map((row) => row.name)
      : [];
    const appliedSet = new Set(applied);
    process.stdout.write('Migration status:\n');
    files.forEach((file) => {
      const name = file.replace(/\.js$/, '');
      process.stdout.write(`  ${appliedSet.has(name) ? 'applied' : 'pending'}  ${name}\n`);
    });
  } catch (error) {
    const code = typeof error.code === 'string' ? ` Kode: ${error.code}.` : '';
    process.stderr.write(`Gagal membaca status migration.${code} Detail disamarkan.\n`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
