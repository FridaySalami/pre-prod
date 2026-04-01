#!/usr/bin/env python3
"""
Weekly Sales Comparison Script
Compares Amazon sales data between Week 28 and Week 29
Identifies products with significant changes in sales performance
"""

import pandas as pd
import sys
from decimal import Decimal
import os

def parse_currency(value):
    """Parse currency string to float"""
    if pd.isna(value) or value == '':
        return 0.0
    # Remove £ symbol, commas, and convert to float
    cleaned = str(value).replace('£', '').replace(',', '').strip()
    try:
        return float(cleaned)
    except ValueError:
        return 0.0

def parse_percentage(value):
    """Parse percentage string to float"""
    if pd.isna(value) or value == '':
        return 0.0
    # Remove % symbol and convert to float
    cleaned = str(value).replace('%', '').strip()
    try:
        return float(cleaned)
    except ValueError:
        return 0.0

def load_and_clean_data(filepath):
    """Load CSV and clean the data"""
    try:
        df = pd.read_csv(filepath)
        
        # Clean column names (remove extra spaces)
        df.columns = df.columns.str.strip()
        
        # Parse currency columns
        currency_columns = ['Ordered Product Sales', 'Ordered product sales – B2B']
        for col in currency_columns:
            if col in df.columns:
                df[col] = df[col].apply(parse_currency)
        
        # Parse percentage columns
        percentage_columns = [
            'Session percentage – Total', 'Session percentage – Total – B2B',
            'Page views percentage – Total', 'Page views percentage – Total – B2B',
            'Featured Offer (Buy Box) percentage', 'Featured Offer (Buy Box) percentage – B2B',
            'Unit Session Percentage', 'Unit session percentage – B2B'
        ]
        for col in percentage_columns:
            if col in df.columns:
                df[col] = df[col].apply(parse_percentage)
        
        # Ensure numeric columns are properly typed
        numeric_columns = [
            'Sessions – Total', 'Sessions – Total – B2B',
            'Page views – Total', 'Page views – Total – B2B',
            'Units ordered', 'Units ordered – B2B',
            'Total order items', 'Total order items – B2B'
        ]
        for col in numeric_columns:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
        
        return df
    
    except Exception as e:
        print(f"Error loading {filepath}: {e}")
        return None

def compare_weeks(week28_df, week29_df):
    """Compare sales data between two weeks"""
    
    # Use Child ASIN as the primary key for comparison
    week28_df = week28_df.set_index('(Child) ASIN')
    week29_df = week29_df.set_index('(Child) ASIN')
    
    # Create comparison dataframe
    comparison_results = []
    
    # Get all unique ASINs from both weeks
    all_asins = set(week28_df.index) | set(week29_df.index)
    
    for asin in all_asins:
        result = {'ASIN': asin}
        
        # Get data for each week (default to 0 if not present)
        if asin in week28_df.index:
            week28_data = week28_df.loc[asin]
            # Handle multiple rows with same ASIN - take first one
            if isinstance(week28_data, pd.DataFrame):
                week28_data = week28_data.iloc[0]
        else:
            week28_data = None
            
        if asin in week29_df.index:
            week29_data = week29_df.loc[asin]
            # Handle multiple rows with same ASIN - take first one
            if isinstance(week29_data, pd.DataFrame):
                week29_data = week29_data.iloc[0]
        else:
            week29_data = None
        
        # Product title (prefer Week 29, fallback to Week 28)
        if week29_data is not None:
            result['Product_Title'] = week29_data.get('Title', 'Unknown')
            result['SKU'] = week29_data.get('SKU', 'Unknown')
        elif week28_data is not None:
            result['Product_Title'] = week28_data.get('Title', 'Unknown')
            result['SKU'] = week28_data.get('SKU', 'Unknown')
        else:
            result['Product_Title'] = 'Unknown'
            result['SKU'] = 'Unknown'
        
        # Sales data comparison
        week28_sales = week28_data['Ordered Product Sales'] if week28_data is not None else 0
        week29_sales = week29_data['Ordered Product Sales'] if week29_data is not None else 0
        
        result['Week28_Sales'] = week28_sales
        result['Week29_Sales'] = week29_sales
        result['Sales_Change'] = week29_sales - week28_sales
        result['Sales_Change_Percent'] = ((week29_sales - week28_sales) / week28_sales * 100) if week28_sales > 0 else (100 if week29_sales > 0 else 0)
        
        # Units ordered comparison
        week28_units = week28_data['Units ordered'] if week28_data is not None else 0
        week29_units = week29_data['Units ordered'] if week29_data is not None else 0
        
        result['Week28_Units'] = week28_units
        result['Week29_Units'] = week29_units
        result['Units_Change'] = week29_units - week28_units
        result['Units_Change_Percent'] = ((week29_units - week28_units) / week28_units * 100) if week28_units > 0 else (100 if week29_units > 0 else 0)
        
        # Sessions comparison
        week28_sessions = week28_data['Sessions – Total'] if week28_data is not None else 0
        week29_sessions = week29_data['Sessions – Total'] if week29_data is not None else 0
        
        result['Week28_Sessions'] = week28_sessions
        result['Week29_Sessions'] = week29_sessions
        result['Sessions_Change'] = week29_sessions - week28_sessions
        
        # Buy Box percentage comparison
        week28_buybox = week28_data['Featured Offer (Buy Box) percentage'] if week28_data is not None else 0
        week29_buybox = week29_data['Featured Offer (Buy Box) percentage'] if week29_data is not None else 0
        
        result['Week28_BuyBox_Percent'] = week28_buybox
        result['Week29_BuyBox_Percent'] = week29_buybox
        result['BuyBox_Change'] = week29_buybox - week28_buybox
        
        # Status classification
        if week28_sales == 0 and week29_sales > 0:
            result['Status'] = 'NEW_PRODUCT'
        elif week28_sales > 0 and week29_sales == 0:
            result['Status'] = 'DISCONTINUED'
        elif result['Sales_Change_Percent'] > 50:
            result['Status'] = 'MAJOR_INCREASE'
        elif result['Sales_Change_Percent'] > 20:
            result['Status'] = 'INCREASE'
        elif result['Sales_Change_Percent'] < -50:
            result['Status'] = 'MAJOR_DECREASE'
        elif result['Sales_Change_Percent'] < -20:
            result['Status'] = 'DECREASE'
        else:
            result['Status'] = 'STABLE'
        
        comparison_results.append(result)
    
    return pd.DataFrame(comparison_results)

def generate_report(comparison_df, output_file='weekly_comparison_report.csv'):
    """Generate comprehensive comparison report"""
    
    print("="*80)
    print("WEEKLY SALES COMPARISON REPORT - Week 28 vs Week 29")
    print("="*80)
    
    # Summary statistics
    total_week28_sales = comparison_df['Week28_Sales'].sum()
    total_week29_sales = comparison_df['Week29_Sales'].sum()
    total_change = total_week29_sales - total_week28_sales
    total_change_percent = (total_change / total_week28_sales * 100) if total_week28_sales > 0 else 0
    
    print(f"\n📊 OVERALL SUMMARY:")
    print(f"Week 28 Total Sales: £{total_week28_sales:,.2f}")
    print(f"Week 29 Total Sales: £{total_week29_sales:,.2f}")
    print(f"Total Change: £{total_change:,.2f} ({total_change_percent:+.1f}%)")
    
    # Product count by status
    status_counts = comparison_df['Status'].value_counts()
    print(f"\n📈 PRODUCT STATUS BREAKDOWN:")
    for status, count in status_counts.items():
        print(f"{status.replace('_', ' ').title()}: {count} products")
    
    # Top performers
    print(f"\n🚀 TOP 10 SALES INCREASES:")
    top_increases = comparison_df[comparison_df['Sales_Change'] > 0].nlargest(10, 'Sales_Change')
    for _, row in top_increases.iterrows():
        print(f"  {row['SKU']}: £{row['Sales_Change']:,.2f} (+{row['Sales_Change_Percent']:.1f}%)")
        print(f"    {row['Product_Title'][:60]}...")
    
    # Biggest drops
    print(f"\n📉 TOP 10 SALES DECREASES:")
    top_decreases = comparison_df[comparison_df['Sales_Change'] < 0].nsmallest(10, 'Sales_Change')
    for _, row in top_decreases.iterrows():
        print(f"  {row['SKU']}: £{row['Sales_Change']:,.2f} ({row['Sales_Change_Percent']:.1f}%)")
        print(f"    {row['Product_Title'][:60]}...")
    
    # New products
    new_products = comparison_df[comparison_df['Status'] == 'NEW_PRODUCT']
    if len(new_products) > 0:
        print(f"\n🆕 NEW PRODUCTS (Week 29):")
        for _, row in new_products.head(10).iterrows():
            print(f"  {row['SKU']}: £{row['Week29_Sales']:.2f} ({row['Week29_Units']} units)")
            print(f"    {row['Product_Title'][:60]}...")
    
    # Discontinued products
    discontinued = comparison_df[comparison_df['Status'] == 'DISCONTINUED']
    if len(discontinued) > 0:
        print(f"\n❌ DISCONTINUED PRODUCTS (Week 28 only):")
        for _, row in discontinued.head(10).iterrows():
            print(f"  {row['SKU']}: £{row['Week28_Sales']:.2f} lost ({row['Week28_Units']} units)")
            print(f"    {row['Product_Title'][:60]}...")
    
    # Save detailed report
    # Sort by absolute sales change for most impactful changes first
    comparison_df['Abs_Sales_Change'] = comparison_df['Sales_Change'].abs()
    detailed_report = comparison_df.sort_values('Abs_Sales_Change', ascending=False)
    detailed_report = detailed_report.drop('Abs_Sales_Change', axis=1)
    
    detailed_report.to_csv(output_file, index=False)
    print(f"\n💾 Detailed report saved to: {output_file}")
    
    # Buy Box Analysis
    print(f"\n🎯 BUY BOX ANALYSIS:")
    avg_week28_buybox = comparison_df['Week28_BuyBox_Percent'].mean()
    avg_week29_buybox = comparison_df['Week29_BuyBox_Percent'].mean()
    buybox_change = avg_week29_buybox - avg_week28_buybox
    
    print(f"Average Buy Box % Week 28: {avg_week28_buybox:.1f}%")
    print(f"Average Buy Box % Week 29: {avg_week29_buybox:.1f}%")
    print(f"Buy Box Change: {buybox_change:+.1f}%")
    
    # Products with significant Buy Box changes
    significant_buybox_changes = comparison_df[
        (comparison_df['BuyBox_Change'].abs() > 20) & 
        (comparison_df['Week28_Sales'] > 50)  # Only for products with meaningful sales
    ].sort_values('BuyBox_Change', ascending=False)
    
    if len(significant_buybox_changes) > 0:
        print(f"\n🎯 SIGNIFICANT BUY BOX CHANGES:")
        for _, row in significant_buybox_changes.head(10).iterrows():
            print(f"  {row['SKU']}: {row['BuyBox_Change']:+.1f}% (£{row['Week29_Sales']:.2f} sales)")
            print(f"    {row['Product_Title'][:60]}...")

def main():
    """Main function to run the comparison"""
    
    # File paths
    week28_file = '/Users/jackweston/Projects/pre-prod/Wk28.csv'
    week29_file = '/Users/jackweston/Projects/pre-prod/Wk29.csv'
    
    # Check if files exist
    if not os.path.exists(week28_file):
        print(f"Error: Week 28 file not found: {week28_file}")
        return
    
    if not os.path.exists(week29_file):
        print(f"Error: Week 29 file not found: {week29_file}")
        return
    
    print("Loading Week 28 data...")
    week28_df = load_and_clean_data(week28_file)
    if week28_df is None:
        return
    
    print("Loading Week 29 data...")
    week29_df = load_and_clean_data(week29_file)
    if week29_df is None:
        return
    
    print(f"Week 28: {len(week28_df)} products")
    print(f"Week 29: {len(week29_df)} products")
    
    print("\nComparing data...")
    comparison_df = compare_weeks(week28_df, week29_df)
    
    print("Generating report...")
    generate_report(comparison_df)
    
    print("\n✅ Analysis complete!")

if __name__ == "__main__":
    main()
