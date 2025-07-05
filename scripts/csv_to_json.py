#!/usr/bin/env python3
"""
CSV to JSON Converter for Sage/Linnworks exports
Usage: python csv_to_json.py input.csv output.json
"""

import csv
import json
import sys
from pathlib import Path

def csv_to_json(csv_file_path, json_file_path):
    """Convert CSV file to JSON format"""
    try:
        data = []
        
        with open(csv_file_path, 'r', encoding='utf-8') as csv_file:
            csv_reader = csv.DictReader(csv_file)
            
            for row in csv_reader:
                # Clean and convert data types
                cleaned_row = {}
                for key, value in row.items():
                    cleaned_row[key.strip()] = clean_value(value)
                data.append(cleaned_row)
        
        # Write JSON file
        with open(json_file_path, 'w', encoding='utf-8') as json_file:
            json.dump(data, json_file, indent=2, ensure_ascii=False)
        
        print(f"✅ Converted {len(data)} records")
        print(f"📄 Input: {csv_file_path}")
        print(f"📄 Output: {json_file_path}")
        
        return data
        
    except Exception as error:
        print(f"❌ Conversion failed: {error}")
        sys.exit(1)

def clean_value(value):
    """Clean and convert value to appropriate type"""
    if not value or value.strip() == '':
        return None
    
    value = value.strip()
    
    # Try to convert to number
    try:
        if '.' in value:
            return float(value)
        else:
            return int(value)
    except ValueError:
        pass
    
    # Convert booleans
    if value.lower() in ['true', 'yes', '1']:
        return True
    if value.lower() in ['false', 'no', '0']:
        return False
    
    # Return as string
    return value

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python csv_to_json.py <input.csv> <output.json>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    if not Path(input_file).exists():
        print(f"❌ Input file does not exist: {input_file}")
        sys.exit(1)
    
    csv_to_json(input_file, output_file)
