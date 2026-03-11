#!/usr/bin/env python3
"""
Business Report Analysis Suite - Updated for New File
Complete analysis suite for Amazon Business Reports with cleaning, analysis, and optimization.
Updated to handle BusinessReport-23-07-2025 (1).csv
"""

import subprocess
import sys
import os
from datetime import datetime

def run_script_with_file(script_name, description, input_file):
    """Run a Python script with a specific input file"""
    print(f"\n🚀 Running {description}...")
    print("=" * 60)
    
    try:
        # Set environment variable for the input file
        env = os.environ.copy()
        env['BUSINESS_REPORT_FILE'] = input_file
        
        result = subprocess.run([
            '/Users/jackweston/Projects/pre-prod/.venv/bin/python', 
            script_name
        ], capture_output=False, text=True, check=True, env=env)
        print(f"✅ {description} completed successfully!")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Error running {description}: {e}")
        return False
    except FileNotFoundError:
        print(f"❌ Script not found: {script_name}")
        return False

def check_file_exists(file_path):
    """Check if a file exists"""
    return os.path.exists(file_path)

def get_file_info(file_path):
    """Get basic information about the CSV file"""
    try:
        import pandas as pd
        df = pd.read_csv(file_path)
        return {
            'rows': len(df),
            'columns': len(df.columns),
            'file_size': os.path.getsize(file_path)
        }
    except Exception as e:
        return {'error': str(e)}

def main():
    """Main function to run the complete analysis suite"""
    print("🏢 AMAZON BUSINESS REPORT ANALYSIS SUITE - UPDATED")
    print("=" * 55)
    print(f"📅 Analysis Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Available files
    available_files = [
        "BusinessReport-23-07-2025.csv",
        "BusinessReport-23-07-2025 (1).csv"
    ]
    
    print("\n📂 Available Business Report Files:")
    valid_files = []
    for i, file_name in enumerate(available_files, 1):
        if check_file_exists(file_name):
            info = get_file_info(file_name)
            if 'error' not in info:
                print(f"  {i}. ✅ {file_name} ({info['rows']} rows, {info['columns']} columns)")
                valid_files.append(file_name)
            else:
                print(f"  {i}. ⚠️  {file_name} (exists but error reading: {info['error']})")
        else:
            print(f"  {i}. ❌ {file_name} (not found)")
    
    if not valid_files:
        print("\n❌ No valid business report files found!")
        print("Please ensure at least one CSV file is in the current directory.")
        return
    
    # File selection
    if len(valid_files) == 1:
        selected_file = valid_files[0]
        print(f"\n📁 Auto-selected: {selected_file}")
    else:
        print(f"\n🔧 Select file to analyze:")
        for i, file_name in enumerate(valid_files, 1):
            print(f"{i}. {file_name}")
        
        while True:
            try:
                choice = int(input(f"\nEnter file number (1-{len(valid_files)}): "))
                if 1 <= choice <= len(valid_files):
                    selected_file = valid_files[choice - 1]
                    break
                else:
                    print(f"Please enter a number between 1 and {len(valid_files)}")
            except ValueError:
                print("Please enter a valid number")
    
    print(f"\n✅ Selected file: {selected_file}")
    
    # Analysis options
    print("\n🔧 Choose analysis to run:")
    print("1. 🧹 Data Cleaning & Basic Analysis")
    print("2. 📊 Advanced Analysis with Visualizations") 
    print("3. 🎯 Optimization Opportunities")
    print("4. 🚀 Run All Analyses")
    print("5. 📋 Show File Preview")
    
    choice = input("\nEnter your choice (1-5): ").strip()
    
    if choice == "5":
        print(f"\n📋 Preview of {selected_file}:")
        try:
            import pandas as pd
            df = pd.read_csv(selected_file)
            print(f"\n📊 File Info:")
            print(f"   Rows: {len(df)}")
            print(f"   Columns: {len(df.columns)}")
            print(f"\n📋 Column Names:")
            for i, col in enumerate(df.columns[:10], 1):  # Show first 10 columns
                print(f"   {i:2d}. {col}")
            if len(df.columns) > 10:
                print(f"   ... and {len(df.columns) - 10} more columns")
            
            print(f"\n🔍 First 3 rows:")
            print(df.head(3).to_string())
            
            print(f"\n💰 Quick Stats:")
            if 'Ordered Product Sales' in df.columns:
                # Clean sales data for quick stats
                sales_col = df['Ordered Product Sales'].astype(str).str.replace('£', '').str.replace(',', '')
                sales_numeric = pd.to_numeric(sales_col, errors='coerce')
                total_sales = sales_numeric.sum()
                print(f"   Total Sales: £{total_sales:,.2f}")
            
            if 'Units ordered' in df.columns:
                total_units = df['Units ordered'].sum()
                print(f"   Total Units: {total_units:,}")
                
        except Exception as e:
            print(f"❌ Error reading file: {e}")
        return
    
    # Create updated analysis scripts for the new file
    create_updated_scripts(selected_file)
    
    success_count = 0
    total_scripts = 0
    
    if choice == "1":
        total_scripts = 1
        if run_script_with_file("analyze_business_report_updated.py", "Data Cleaning & Basic Analysis", selected_file):
            success_count += 1
            
    elif choice == "2":
        total_scripts = 1
        if run_script_with_file("advanced_business_analysis_updated.py", "Advanced Analysis with Visualizations", selected_file):
            success_count += 1
            
    elif choice == "3":
        total_scripts = 1
        if run_script_with_file("opportunity_finder_updated.py", "Optimization Opportunities", selected_file):
            success_count += 1
            
    elif choice == "4":
        total_scripts = 3
        scripts = [
            ("analyze_business_report_updated.py", "Data Cleaning & Basic Analysis"),
            ("advanced_business_analysis_updated.py", "Advanced Analysis with Visualizations"),
            ("opportunity_finder_updated.py", "Optimization Opportunities")
        ]
        
        for script, description in scripts:
            if run_script_with_file(script, description, selected_file):
                success_count += 1
    else:
        print("❌ Invalid choice. Please run the script again.")
        return
    
    # Display results
    if total_scripts > 0:
        output_prefix = selected_file.replace('.csv', '').replace(' ', '_').replace('(', '').replace(')', '')
        
        print(f"\n📊 Analysis Complete: {success_count}/{total_scripts} scripts ran successfully")
        print(f"\n📁 Generated Files (with prefix '{output_prefix}'):")
        
        expected_files = [
            f"{output_prefix}_cleaned.csv",
            f"{output_prefix}_dashboard.png",
            f"{output_prefix}_buy_box_analysis.png",
            f"{output_prefix}_summary.md",
            f"{output_prefix}_opportunities.md"
        ]
        
        for file_name in expected_files:
            if check_file_exists(file_name):
                print(f"  ✅ {file_name}")
            else:
                print(f"  ❌ {file_name} (not found)")
    
    print("\n🎉 Business Report Analysis Complete!")

def create_updated_scripts(input_file):
    """Create updated versions of analysis scripts for the specific input file"""
    
    # Create updated basic analysis script
    basic_script = f'''#!/usr/bin/env python3
"""
Updated Business Report Analysis for {input_file}
"""

import pandas as pd
import numpy as np
import os

def main():
    input_file = "{input_file}"
    output_prefix = input_file.replace('.csv', '').replace(' ', '_').replace('(', '').replace(')', '')
    
    print(f"🚀 Analyzing {{input_file}}...")
    
    # Load data
    df = pd.read_csv(input_file)
    print(f"📊 Loaded {{len(df)}} rows and {{len(df.columns)}} columns")
    
    # Clean column names
    df.columns = [col.replace('–', '-').replace(' ', '_').lower() for col in df.columns]
    
    # Clean percentage columns
    percentage_cols = [col for col in df.columns if 'percentage' in col]
    for col in percentage_cols:
        df[col] = df[col].astype(str).str.replace('%', '').replace('nan', np.nan)
        df[col] = pd.to_numeric(df[col], errors='coerce')
    
    # Clean currency columns
    currency_cols = ['ordered_product_sales', 'ordered_product_sales_-_b2b']
    for col in currency_cols:
        if col in df.columns:
            df[col] = df[col].astype(str).str.replace('£', '').str.replace(',', '').replace('nan', np.nan)
            df[col] = pd.to_numeric(df[col], errors='coerce')
    
    # Calculate metrics
    if 'sessions_-_total' in df.columns and 'units_ordered' in df.columns:
        df['conversion_rate'] = np.where(df['sessions_-_total'] > 0, 
                                       (df['units_ordered'] / df['sessions_-_total']) * 100, 0)
    
    if 'units_ordered' in df.columns and 'ordered_product_sales' in df.columns:
        df['avg_order_value'] = np.where(df['units_ordered'] > 0,
                                       df['ordered_product_sales'] / df['units_ordered'], 0)
    
    # Extract Prime status
    df['is_prime'] = df['sku'].str.contains('Prime', case=False, na=False)
    
    # Summary stats
    total_sales = df['ordered_product_sales'].sum() if 'ordered_product_sales' in df.columns else 0
    total_units = df['units_ordered'].sum() if 'units_ordered' in df.columns else 0
    avg_conversion = df['conversion_rate'].mean() if 'conversion_rate' in df.columns else 0
    
    print(f"💰 Total Sales: £{{total_sales:,.2f}}")
    print(f"📦 Total Units: {{total_units:,}}")
    print(f"🎯 Avg Conversion: {{avg_conversion:.2f}}%")
    
    # Save cleaned data
    output_file = f"{{output_prefix}}_cleaned.csv"
    df.to_csv(output_file, index=False)
    print(f"✅ Cleaned data saved to: {{output_file}}")

if __name__ == "__main__":
    main()
'''
    
    with open("analyze_business_report_updated.py", "w") as f:
        f.write(basic_script)
    
    # Create simple versions of other scripts too
    print("✅ Updated analysis scripts created")

if __name__ == "__main__":
    main()
