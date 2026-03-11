const fs = require('fs');
const path = require('path');

/**
 * Add a unique primary key column to a CSV file
 * Usage: node add-primary-key-to-csv.js <input-csv-file>
 */

function addPrimaryKeyToCSV(inputFile, outputFile = null) {
  try {
    // Read the CSV file
    const csvContent = fs.readFileSync(inputFile, 'utf8');
    const lines = csvContent.split('\n');

    if (lines.length === 0) {
      throw new Error('CSV file is empty');
    }

    // Get the header row and add 'id' as the first column
    const header = lines[0];
    const newHeader = 'id,' + header;

    // Process each data row and add an incremental ID
    const newLines = [newHeader];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line) { // Skip empty lines
        newLines.push(`${i},${line}`);
      }
    }

    // Determine output filename
    if (!outputFile) {
      const ext = path.extname(inputFile);
      const name = path.basename(inputFile, ext);
      const dir = path.dirname(inputFile);
      outputFile = path.join(dir, `${name}_with_id${ext}`);
    }

    // Write the new CSV
    fs.writeFileSync(outputFile, newLines.join('\n'));

    console.log(`✅ Successfully added primary key to CSV!`);
    console.log(`📁 Input file: ${inputFile}`);
    console.log(`📁 Output file: ${outputFile}`);
    console.log(`📊 Processed ${newLines.length - 1} data rows`);

    return outputFile;

  } catch (error) {
    console.error('❌ Error processing CSV:', error.message);
    process.exit(1);
  }
}

// Command line usage
if (require.main === module) {
  const inputFile = process.argv[2];
  const outputFile = process.argv[3];

  if (!inputFile) {
    console.log('Usage: node add-primary-key-to-csv.js <input-csv-file> [output-csv-file]');
    console.log('');
    console.log('Examples:');
    console.log('  node add-primary-key-to-csv.js amazon-sales-data.csv');
    console.log('  node add-primary-key-to-csv.js data.csv data_with_id.csv');
    process.exit(1);
  }

  if (!fs.existsSync(inputFile)) {
    console.error(`❌ File not found: ${inputFile}`);
    process.exit(1);
  }

  addPrimaryKeyToCSV(inputFile, outputFile);
}

module.exports = { addPrimaryKeyToCSV };
