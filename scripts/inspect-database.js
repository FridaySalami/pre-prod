const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function inspectDatabase() {
  try {
    console.log('Inspecting database structure...\n');

    // Get database info using raw queries
    const tables = await prisma.$queryRaw`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      ORDER BY name;
    `;

    console.log('Tables in database:');
    console.log('==================');

    for (const table of tables) {
      console.log(`\n📋 Table: ${table.name}`);

      // Get table schema
      const schemaQuery = `PRAGMA table_info('${table.name}')`;
      const schema = await prisma.$queryRawUnsafe(schemaQuery);

      console.log('   Columns:');
      schema.forEach(col => {
        console.log(`   - ${col.name}: ${col.type} ${col.pk ? '(PRIMARY KEY)' : ''} ${col.notnull ? '(NOT NULL)' : ''}`);
      });

      // Get row count if table exists
      try {
        const countQuery = `SELECT COUNT(*) as count FROM "${table.name}"`;
        const count = await prisma.$queryRawUnsafe(countQuery);
        console.log(`   📊 Rows: ${count[0].count}`);

        // Show sample data for tables with data
        if (count[0].count > 0 && count[0].count <= 10) {
          const sample = await prisma.$queryRawUnsafe(`SELECT * FROM "${table.name}" LIMIT 3`);
          console.log('   📝 Sample data:');
          sample.forEach((row, i) => {
            console.log(`      ${i + 1}:`, JSON.stringify(row, null, 2));
          });
        } else if (count[0].count > 10) {
          const sample = await prisma.$queryRawUnsafe(`SELECT * FROM "${table.name}" LIMIT 3`);
          console.log('   📝 Sample data (showing first 3 rows):');
          sample.forEach((row, i) => {
            console.log(`      ${i + 1}:`, JSON.stringify(row, null, 2));
          });
        }
      } catch (e) {
        console.log(`   ⚠️  Could not read data: ${e.message}`);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('Database inspection complete!');

  } catch (error) {
    console.error('Error inspecting database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

inspectDatabase();
