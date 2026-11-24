const pool = require('./database');

async function main() {
  try {
    await pool.query('SELECT 1');
    process.stdout.write('Koneksi database berhasil (SELECT 1).\n');
  } catch (error) {
    const code = typeof error.code === 'string' ? ` Kode: ${error.code}.` : '';
    process.stderr.write(`Koneksi database gagal.${code} Detail disamarkan untuk melindungi kredensial.\n`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
