#!/usr/bin/env python3
"""
Updated Business Report Analysis for BusinessReport-23-07-2025 (1).csv
"""

import pandas as pd
import numpy as np
import os

def main():
    input_file = "BusinessReport-23-07-2025 (1).csv"
    output_prefix = input_file.replace('.csv', '').replace(' ', '_').replace('(', '').replace(')', '')
    
    print(f"🚀 Analyzing {input_file}...")
    
    # Load data
    df = pd.read_csv(input_file)
    print(f"📊 Loaded {len(df)} rows and {len(df.columns)} columns")
    
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
    
    print(f"💰 Total Sales: £{total_sales:,.2f}")
    print(f"📦 Total Units: {total_units:,}")
    print(f"🎯 Avg Conversion: {avg_conversion:.2f}%")
    
    # Save cleaned data
    output_file = f"{output_prefix}_cleaned.csv"
    df.to_csv(output_file, index=False)
    print(f"✅ Cleaned data saved to: {output_file}")

if __name__ == "__main__":
    main()
