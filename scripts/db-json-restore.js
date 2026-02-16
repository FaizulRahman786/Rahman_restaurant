const fs = require('fs');
const { Pool } = require('pg');

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

async function run() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error('Input path is required. Usage: node scripts/db-json-restore.js <inputPath>');
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set.');
  }

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Backup file not found: ${inputPath}`);
  }

  const payload = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  if (!payload || !Array.isArray(payload.tables)) {
    throw new Error('Invalid JSON backup format.');
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const table of payload.tables) {
        const tableName = table.tableName;
        const rows = Array.isArray(table.rows) ? table.rows : [];
        const qTableName = quoteIdentifier(tableName);

        await client.query(`TRUNCATE TABLE ${qTableName} RESTART IDENTITY CASCADE;`);

        if (!rows.length) {
          continue;
        }

        const columns = Object.keys(rows[0]);
        const quotedColumns = columns.map(quoteIdentifier).join(', ');

        for (const row of rows) {
          const values = columns.map((column) => row[column]);
          const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
          await client.query(
            `INSERT INTO ${qTableName} (${quotedColumns}) VALUES (${placeholders});`,
            values
          );
        }
      }

      await client.query('COMMIT');
      console.log('DB_JSON_RESTORE=SUCCESS');
      console.log(`DB_JSON_RESTORE_TABLES=${payload.tables.length}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error('DB_JSON_RESTORE=FAIL');
  console.error(error.message);
  process.exit(1);
});
