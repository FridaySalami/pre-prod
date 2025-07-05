#!/usr/bin/env node

/**
 * CSV to JSON Converter for Sage/Linnworks exports
 * Usage: node csv-to-json.js input.csv output.json
 */

const fs = require('fs');
const path = require('path');

function csvToJson(csvFilePath, jsonFilePath) {
  try {
    // Read CSV file
    const csvData = fs.readFileSync(csvFilePath, 'utf8');
    const lines = csvData.split('\n').filter(line => line.trim());

    if (lines.length === 0) {
      throw new Error('CSV file is empty');
    }

    // Parse headers
    const headers = lines[0].split(',').map(header =>
      header.replace(/"/g, '').trim()
    );

    // Parse data rows
    const jsonData = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);

      if (values.length === headers.length) {
        const obj = {};
        headers.forEach((header, index) => {
          obj[header] = cleanValue(values[index]);
        });
        jsonData.push(obj);
      }
    }

    // Write JSON file
    fs.writeFileSync(jsonFilePath, JSON.stringify(jsonData, null, 2));

    console.log(`✅ Converted ${jsonData.length} records`);
    console.log(`📄 Input: ${csvFilePath}`);
    console.log(`📄 Output: ${jsonFilePath}`);

    return jsonData;

  } catch (error) {
    console.error('❌ Conversion failed:', error.message);
    process.exit(1);
  }
}

function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function cleanValue(value) {
  // Remove quotes and clean up data types
  value = value.replace(/^"(.*)"$/, '$1').trim();

  // Convert numbers
  if (/^\d+\.?\d*$/.test(value)) {
    return parseFloat(value);
  }

  // Convert booleans
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;

  // Return string
  return value;
}

// Command line usage
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length !== 2) {
    console.log('Usage: node csv-to-json.js <input.csv> <output.json>');
    process.exit(1);
  }

  const [inputFile, outputFile] = args;
  csvToJson(inputFile, outputFile);
}

module.exports = { csvToJson };
