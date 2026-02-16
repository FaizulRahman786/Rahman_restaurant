const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

async function run() {
  const outputPath = process.argv[2];
  if (!outputPath) {
    throw new Error('Output path is required. Usage: node scripts/db-json-backup.js <outputPath>');
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set.');
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const tableResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const backup = {
      version: 1,
      generatedAt: new Date().toISOString(),
      tables: []
    };

    for (const { table_name: tableName } of tableResult.rows) {
      const columnResult = await pool.query(
        `
          SELECT
            column_name,
            data_type,
            is_nullable,
            column_default,
            ordinal_position
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1
          ORDER BY ordinal_position;
        `,
        [tableName]
      );

      const rowsResult = await pool.query(`SELECT * FROM ${quoteIdentifier(tableName)};`);

      backup.tables.push({
        tableName,
        columns: columnResult.rows,
        rows: rowsResult.rows
      });
    }

    const outputDir = path.dirname(outputPath);
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(backup, null, 2), 'utf8');

    console.log(`DB_JSON_BACKUP=SUCCESS`);
    console.log(`DB_JSON_BACKUP_FILE=${outputPath}`);
    console.log(`DB_JSON_TABLES=${backup.tables.length}`);
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error('DB_JSON_BACKUP=FAIL');
  console.error(error.message);
  process.exit(1);
});
