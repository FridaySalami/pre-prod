#!/usr/bin/env python3
"""
Robust Business Report Analysis for the new BusinessReport-23-07-2025 (1).csv
Handles the larger dataset with proper data cleaning and analysis.
"""

import pandas as pd
import numpy as np
import re
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

def load_and_clean_data(file_path):
    """Load and clean the business report data"""
    print(f"📊 Loading {file_path}...")
    
    # Load the data
    df = pd.read_csv(file_path)
    print(f"✅ Loaded {len(df)} rows and {len(df.columns)} columns")
    
    # Display original column names for debugging
    print("📋 Original columns:")
    for i, col in enumerate(df.columns, 1):
        print(f"  {i:2d}. {col}")
    
    return df

def clean_column_names(df):
    """Clean and standardize column names"""
    print("\n🧹 Standardizing column names...")
    
    # Create mapping for the actual column names we see
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
    print(f"✅ Columns standardized")
    
    return df

def clean_data_types(df):
    """Clean and convert data types"""
    print("\n🔧 Cleaning data types...")
    
    # Clean percentage columns
    percentage_columns = [
        'session_percentage_total', 'session_percentage_b2b',
        'page_views_percentage_total', 'page_views_percentage_b2b',
        'buy_box_percentage', 'buy_box_percentage_b2b',
        'unit_session_percentage', 'unit_session_percentage_b2b'
    ]
    
    for col in percentage_columns:
        if col in df.columns:
            df[col] = df[col].astype(str).str.replace('%', '').replace('nan', np.nan)
            df[col] = pd.to_numeric(df[col], errors='coerce')
    
    # Clean currency columns
    currency_columns = ['sales_total', 'sales_b2b']
    for col in currency_columns:
        if col in df.columns:
            # Handle both regular and quoted values with commas
            df[col] = df[col].astype(str).str.replace('£', '').str.replace(',', '').str.replace('"', '').replace('nan', np.nan)
            df[col] = pd.to_numeric(df[col], errors='coerce')
    
    # Clean numeric columns that might have commas
    numeric_columns = ['sessions_total', 'sessions_b2b', 'page_views_total', 'page_views_b2b']
    for col in numeric_columns:
        if col in df.columns:
            df[col] = df[col].astype(str).str.replace(',', '').replace('nan', np.nan)
            df[col] = pd.to_numeric(df[col], errors='coerce')
    
    print("✅ Data types cleaned")
    return df

def calculate_metrics(df):
    """Calculate derived metrics"""
    print("\n📈 Calculating derived metrics...")
    
    # Conversion rate
    df['conversion_rate'] = np.where(df['sessions_total'] > 0, 
                                   (df['units_ordered'] / df['sessions_total']) * 100, 0)
    
    # Average order value
    df['avg_order_value'] = np.where(df['units_ordered'] > 0,
                                   df['sales_total'] / df['units_ordered'], 0)
    
    # Revenue per session
    df['revenue_per_session'] = np.where(df['sessions_total'] > 0,
                                       df['sales_total'] / df['sessions_total'], 0)
    
    # Extract Prime status
    df['is_prime'] = df['sku'].str.contains('Prime|prime', case=False, na=False)
    
    # Extract SKU category (letters before numbers/dashes)
    df['sku_category'] = df['sku'].str.extract(r'^([A-Z]+)', expand=False)
    
    print("✅ Metrics calculated")
    return df

def generate_summary(df):
    """Generate summary statistics"""
    print("\n📊 Summary Statistics:")
    print("=" * 40)
    
    # Basic stats
    total_products = len(df)
    total_sessions = df['sessions_total'].sum()
    total_sales = df['sales_total'].sum()
    total_units = df['units_ordered'].sum()
    avg_conversion = df['conversion_rate'].mean()
    avg_aov = df['avg_order_value'].mean()
    
    print(f"📦 Total Products: {total_products:,}")
    print(f"👥 Total Sessions: {total_sessions:,}")
    print(f"💰 Total Sales: £{total_sales:,.2f}")
    print(f"📦 Total Units Ordered: {total_units:,}")
    print(f"🎯 Average Conversion Rate: {avg_conversion:.2f}%")
    print(f"💵 Average Order Value: £{avg_aov:.2f}")
    
    # Top performers
    print(f"\n🏆 Top 10 Products by Sales:")
    top_sales = df.nlargest(10, 'sales_total')[['sku', 'sales_total', 'units_ordered', 'conversion_rate']]
    for idx, row in top_sales.iterrows():
        print(f"  {row['sku']}: £{row['sales_total']:,.2f} ({row['units_ordered']} units, {row['conversion_rate']:.1f}% conv)")
    
    # Prime comparison
    if df['is_prime'].any():
        prime_stats = df.groupby('is_prime').agg({
            'sales_total': 'sum',
            'units_ordered': 'sum',
            'conversion_rate': 'mean'
        })
        
        print(f"\n⭐ Prime vs Non-Prime:")
        if True in prime_stats.index:
            print(f"  Prime Sales: £{prime_stats.loc[True, 'sales_total']:,.2f}")
            print(f"  Prime Conversion: {prime_stats.loc[True, 'conversion_rate']:.2f}%")
        if False in prime_stats.index:
            print(f"  Non-Prime Sales: £{prime_stats.loc[False, 'sales_total']:,.2f}")
            print(f"  Non-Prime Conversion: {prime_stats.loc[False, 'conversion_rate']:.2f}%")
    
    # Category performance
    if 'sku_category' in df.columns:
        category_sales = df.groupby('sku_category')['sales_total'].sum().sort_values(ascending=False).head(10)
        print(f"\n🏷️ Top 10 Categories by Sales:")
        for category, sales in category_sales.items():
            print(f"  {category}: £{sales:,.2f}")

def identify_opportunities(df):
    """Identify key optimization opportunities"""
    print(f"\n🎯 Key Optimization Opportunities:")
    print("=" * 40)
    
    opportunities = []
    
    # High traffic, low conversion
    high_traffic_low_conv = df[
        (df['sessions_total'] >= df['sessions_total'].quantile(0.75)) &
        (df['conversion_rate'] <= df['conversion_rate'].quantile(0.25))
    ]
    
    if len(high_traffic_low_conv) > 0:
        opportunities.append(f"🔍 {len(high_traffic_low_conv)} products with high traffic but low conversion")
        print(f"  Top 5 high traffic, low conversion:")
        for _, row in high_traffic_low_conv.nlargest(5, 'sessions_total').iterrows():
            print(f"    {row['sku']}: {row['sessions_total']} sessions, {row['conversion_rate']:.1f}% conversion")
    
    # No buy box products with good traffic
    no_buybox = df[
        (df['buy_box_percentage'] == 0) & 
        (df['sessions_total'] >= 50)
    ]
    
    if len(no_buybox) > 0:
        opportunities.append(f"📦 {len(no_buybox)} products with good traffic but no buy box")
        print(f"  Top 5 no buy box opportunities:")
        for _, row in no_buybox.nlargest(5, 'sessions_total').iterrows():
            print(f"    {row['sku']}: {row['sessions_total']} sessions, £{row['sales_total']:.2f} sales")
    
    # Prime opportunities
    non_prime_performers = df[
        (df['is_prime'] == False) &
        (df['sales_total'] >= df['sales_total'].quantile(0.75))
    ]
    
    if len(non_prime_performers) > 0:
        opportunities.append(f"⭐ {len(non_prime_performers)} high-performing non-Prime products")
        print(f"  Top 5 Prime upgrade opportunities:")
        for _, row in non_prime_performers.nlargest(5, 'sales_total').iterrows():
            print(f"    {row['sku']}: £{row['sales_total']:.2f} sales")
    
    return opportunities

def save_results(df, input_file):
    """Save cleaned data and summary"""
    output_prefix = input_file.replace('.csv', '').replace(' ', '_').replace('(', '').replace(')', '')
    
    # Save cleaned data
    cleaned_file = f"{output_prefix}_cleaned.csv"
    df.to_csv(cleaned_file, index=False)
    print(f"\n💾 Cleaned data saved to: {cleaned_file}")
    
    # Save summary report
    summary_file = f"{output_prefix}_summary.md"
    with open(summary_file, 'w') as f:
        f.write(f"# Business Report Analysis Summary\n")
        f.write(f"**File:** {input_file}\n")
        f.write(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        
        f.write("## Key Metrics\n")
        f.write(f"- **Total Products:** {len(df):,}\n")
        f.write(f"- **Total Sales:** £{df['sales_total'].sum():,.2f}\n")
        f.write(f"- **Total Units:** {df['units_ordered'].sum():,}\n")
        f.write(f"- **Average Conversion:** {df['conversion_rate'].mean():.2f}%\n")
        f.write(f"- **Average AOV:** £{df['avg_order_value'].mean():.2f}\n\n")
        
        f.write("## Top 10 Products by Sales\n")
        f.write("| SKU | Sales | Units | Conversion Rate |\n")
        f.write("|-----|-------|-------|----------------|\n")
        top_products = df.nlargest(10, 'sales_total')
        for _, row in top_products.iterrows():
            f.write(f"| {row['sku']} | £{row['sales_total']:,.2f} | {row['units_ordered']} | {row['conversion_rate']:.1f}% |\n")
    
    print(f"📄 Summary report saved to: {summary_file}")
    
    return cleaned_file, summary_file

def main():
    """Main analysis function"""
    input_file = "BusinessReport-23-07-2025 (1).csv"
    
    print("🚀 Business Report Analysis - Enhanced Version")
    print("=" * 50)
    
    try:
        # Load and process data
        df = load_and_clean_data(input_file)
        df = clean_column_names(df)
        df = clean_data_types(df)
        df = calculate_metrics(df)
        
        # Generate insights
        generate_summary(df)
        opportunities = identify_opportunities(df)
        
        # Save results
        cleaned_file, summary_file = save_results(df, input_file)
        
        print("\n" + "=" * 50)
        print("✅ Analysis completed successfully!")
        print(f"📁 Files created:")
        print(f"   - {cleaned_file}")
        print(f"   - {summary_file}")
        
        return df
        
    except Exception as e:
        print(f"❌ Error during analysis: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    result = main()
