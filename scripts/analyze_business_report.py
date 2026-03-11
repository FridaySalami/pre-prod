#!/usr/bin/env python3
"""
Amazon Business Report Data Cleaning and Analysis Script
Analyzes and cleans the BusinessReport CSV file from Amazon.
"""

import pandas as pd
import numpy as np
import re
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

def load_and_examine_data(file_path):
    """Load the CSV file and examine its structure"""
    print("📊 Loading and examining data structure...")
    
    # Load the data
    df = pd.read_csv(file_path)
    
    print(f"✅ Data loaded successfully")
    print(f"📈 Shape: {df.shape[0]} rows, {df.shape[1]} columns")
    print(f"\n📋 Column names:")
    for i, col in enumerate(df.columns, 1):
        print(f"  {i:2d}. {col}")
    
    print(f"\n📊 Data types:")
    print(df.dtypes)
    
    print(f"\n🔍 First 3 rows:")
    print(df.head(3))
    
    return df

def clean_column_names(df):
    """Clean and standardize column names"""
    print("\n🧹 Cleaning column names...")
    
    # Create a mapping of old to new column names
    column_mapping = {
        '(Parent) ASIN': 'parent_asin',
        '(Child) ASIN': 'child_asin',
        'Title': 'title',
        'SKU': 'sku',
        'Sessions – Total': 'sessions_total',
        'Sessions – Total – B2B': 'sessions_b2b',
        'Session percentage – Total': 'session_percentage_total',
        'Session percentage – Total – B2B': 'session_percentage_b2b',
        'Page views – Total': 'page_views_total',
        'Page views – Total – B2B': 'page_views_b2b',
        'Page views percentage – Total': 'page_views_percentage_total',
        'Page views percentage – Total – B2B': 'page_views_percentage_b2b',
        'Featured Offer (Buy Box) percentage': 'buy_box_percentage',
        'Featured Offer (Buy Box) percentage – B2B': 'buy_box_percentage_b2b',
        'Units ordered': 'units_ordered',
        'Units ordered – B2B': 'units_ordered_b2b',
        'Unit Session Percentage': 'unit_session_percentage',
        'Unit session percentage – B2B': 'unit_session_percentage_b2b',
        'Ordered Product Sales': 'sales_total',
        'Ordered product sales – B2B': 'sales_b2b',
        'Total order items': 'order_items_total',
        'Total order items – B2B': 'order_items_b2b'
    }
    
    # Rename columns
    df = df.rename(columns=column_mapping)
    
    print(f"✅ Column names standardized")
    print(f"📋 New column names: {', '.join(df.columns[:5])}...")
    
    return df

def clean_percentage_columns(df):
    """Clean percentage columns by removing % and converting to float"""
    print("\n📊 Cleaning percentage columns...")
    
    percentage_columns = [
        'session_percentage_total', 'session_percentage_b2b',
        'page_views_percentage_total', 'page_views_percentage_b2b',
        'buy_box_percentage', 'buy_box_percentage_b2b',
        'unit_session_percentage', 'unit_session_percentage_b2b'
    ]
    
    for col in percentage_columns:
        if col in df.columns:
            # Remove % sign and convert to float
            df[col] = df[col].astype(str).str.replace('%', '').replace('nan', np.nan)
            df[col] = pd.to_numeric(df[col], errors='coerce')
            print(f"  ✅ Cleaned {col}")
    
    return df

def clean_currency_columns(df):
    """Clean currency columns by removing £ symbol and converting to float"""
    print("\n💰 Cleaning currency columns...")
    
    currency_columns = ['sales_total', 'sales_b2b']
    
    for col in currency_columns:
        if col in df.columns:
            # Remove £ symbol and convert to float
            df[col] = df[col].astype(str).str.replace('£', '').str.replace(',', '').replace('nan', np.nan)
            df[col] = pd.to_numeric(df[col], errors='coerce')
            print(f"  ✅ Cleaned {col}")
    
    return df

def clean_numeric_columns(df):
    """Clean and convert numeric columns"""
    print("\n🔢 Cleaning numeric columns...")
    
    numeric_columns = [
        'sessions_total', 'sessions_b2b', 'page_views_total', 'page_views_b2b',
        'units_ordered', 'units_ordered_b2b', 'order_items_total', 'order_items_b2b'
    ]
    
    for col in numeric_columns:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
            print(f"  ✅ Cleaned {col}")
    
    return df

def extract_sku_info(df):
    """Extract useful information from SKU field"""
    print("\n🏷️  Extracting SKU information...")
    
    # Extract prime status
    df['is_prime'] = df['sku'].str.contains('Prime', case=False, na=False)
    
    # Extract base SKU (remove Prime suffix)
    df['base_sku'] = df['sku'].str.replace(' - \\d+ Prime$', '', regex=True)
    df['base_sku'] = df['base_sku'].str.replace(' Prime$', '', regex=True)
    
    # Extract SKU category (letters before numbers)
    df['sku_category'] = df['sku'].str.extract(r'^([A-Z]+)', expand=False)
    
    print(f"  ✅ Prime products: {df['is_prime'].sum()}")
    print(f"  ✅ SKU categories found: {df['sku_category'].nunique()}")
    
    return df

def calculate_derived_metrics(df):
    """Calculate useful derived metrics"""
    print("\n📈 Calculating derived metrics...")
    
    # Calculate conversion rates
    df['conversion_rate'] = np.where(df['sessions_total'] > 0, 
                                   (df['units_ordered'] / df['sessions_total']) * 100, 0)
    
    # Calculate average order value
    df['avg_order_value'] = np.where(df['units_ordered'] > 0,
                                   df['sales_total'] / df['units_ordered'], 0)
    
    # Calculate revenue per session
    df['revenue_per_session'] = np.where(df['sessions_total'] > 0,
                                       df['sales_total'] / df['sessions_total'], 0)
    
    # Calculate buy box win rate (assuming this is what the percentage represents)
    df['buy_box_win_rate'] = df['buy_box_percentage']
    
    # Flag high performers
    df['high_conversion'] = df['conversion_rate'] > df['conversion_rate'].quantile(0.75)
    df['high_revenue'] = df['sales_total'] > df['sales_total'].quantile(0.75)
    
    print(f"  ✅ Calculated conversion rates")
    print(f"  ✅ Calculated average order values")
    print(f"  ✅ Calculated revenue per session")
    print(f"  ✅ Flagged high performers")
    
    return df

def identify_data_quality_issues(df):
    """Identify data quality issues"""
    print("\n🔍 Identifying data quality issues...")
    
    issues = []
    
    # Check for missing values
    missing_counts = df.isnull().sum()
    if missing_counts.sum() > 0:
        issues.append(f"Missing values found in {missing_counts[missing_counts > 0].count()} columns")
        print(f"  ⚠️  Missing values:")
        for col, count in missing_counts[missing_counts > 0].items():
            print(f"     {col}: {count} missing")
    
    # Check for duplicates
    duplicates = df.duplicated().sum()
    if duplicates > 0:
        issues.append(f"{duplicates} duplicate rows found")
        print(f"  ⚠️  {duplicates} duplicate rows")
    
    # Check for impossible values
    if (df['buy_box_percentage'] > 100).any():
        issues.append("Buy box percentages > 100% found")
        print(f"  ⚠️  Buy box percentages > 100%")
    
    if (df['conversion_rate'] > 100).any():
        issues.append("Conversion rates > 100% found")
        print(f"  ⚠️  Conversion rates > 100%")
    
    # Check for negative values where they shouldn't exist
    numeric_cols = ['sessions_total', 'units_ordered', 'sales_total']
    for col in numeric_cols:
        if col in df.columns and (df[col] < 0).any():
            issues.append(f"Negative values found in {col}")
            print(f"  ⚠️  Negative values in {col}")
    
    if not issues:
        print("  ✅ No major data quality issues found")
    
    return issues

def generate_summary_stats(df):
    """Generate summary statistics"""
    print("\n📊 Generating summary statistics...")
    
    # Basic statistics
    total_sessions = df['sessions_total'].sum()
    total_sales = df['sales_total'].sum()
    total_units = df['units_ordered'].sum()
    avg_conversion = df['conversion_rate'].mean()
    avg_order_value = df['avg_order_value'].mean()
    
    print(f"  📈 Total Sessions: {total_sessions:,}")
    print(f"  💰 Total Sales: £{total_sales:,.2f}")
    print(f"  📦 Total Units Ordered: {total_units:,}")
    print(f"  🎯 Average Conversion Rate: {avg_conversion:.2f}%")
    print(f"  💵 Average Order Value: £{avg_order_value:.2f}")
    
    # Top performers
    print(f"\n🏆 Top 5 Products by Sales:")
    top_sales = df.nlargest(5, 'sales_total')[['title', 'sku', 'sales_total', 'units_ordered']]
    for idx, row in top_sales.iterrows():
        print(f"  {row['sku']}: £{row['sales_total']:.2f} ({row['units_ordered']} units)")
    
    print(f"\n🎯 Top 5 Products by Conversion Rate:")
    top_conversion = df.nlargest(5, 'conversion_rate')[['title', 'sku', 'conversion_rate', 'units_ordered']]
    for idx, row in top_conversion.iterrows():
        print(f"  {row['sku']}: {row['conversion_rate']:.2f}% conversion")
    
    # Prime vs Non-Prime comparison
    if 'is_prime' in df.columns:
        prime_stats = df.groupby('is_prime').agg({
            'sales_total': 'sum',
            'units_ordered': 'sum',
            'conversion_rate': 'mean'
        })
        
        print(f"\n⭐ Prime vs Non-Prime Comparison:")
        print(f"  Prime Sales: £{prime_stats.loc[True, 'sales_total']:,.2f}")
        print(f"  Non-Prime Sales: £{prime_stats.loc[False, 'sales_total']:,.2f}")
        print(f"  Prime Avg Conversion: {prime_stats.loc[True, 'conversion_rate']:.2f}%")
        print(f"  Non-Prime Avg Conversion: {prime_stats.loc[False, 'conversion_rate']:.2f}%")

def save_cleaned_data(df, original_file_path):
    """Save the cleaned data to a new CSV file"""
    print("\n💾 Saving cleaned data...")
    
    # Generate output filename
    base_name = original_file_path.replace('.csv', '')
    output_file = f"{base_name}_cleaned.csv"
    
    # Save cleaned data
    df.to_csv(output_file, index=False)
    
    print(f"  ✅ Cleaned data saved to: {output_file}")
    return output_file

def main():
    """Main function to orchestrate the data cleaning process"""
    print("🚀 Amazon Business Report Data Cleaning and Analysis")
    print("=" * 55)
    
    # File path
    file_path = "/Users/jackweston/Projects/pre-prod/BusinessReport-23-07-2025.csv"
    
    try:
        # Load and examine data
        df = load_and_examine_data(file_path)
        
        # Clean the data
        df = clean_column_names(df)
        df = clean_percentage_columns(df)
        df = clean_currency_columns(df)
        df = clean_numeric_columns(df)
        df = extract_sku_info(df)
        df = calculate_derived_metrics(df)
        
        # Check data quality
        issues = identify_data_quality_issues(df)
        
        # Generate summary statistics
        generate_summary_stats(df)
        
        # Save cleaned data
        output_file = save_cleaned_data(df, file_path)
        
        print("\n" + "=" * 55)
        print("✅ Data cleaning and analysis completed successfully!")
        print(f"📁 Cleaned data available at: {output_file}")
        
        return df, output_file
        
    except Exception as e:
        print(f"❌ Error occurred: {str(e)}")
        raise

if __name__ == "__main__":
    cleaned_df, output_file = main()
