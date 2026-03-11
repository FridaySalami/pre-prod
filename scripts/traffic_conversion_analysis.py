#!/usr/bin/env python3
"""
Traffic vs Conversion Analysis - Fixed Version
Identifies high-traffic products with best and worst conversion rates for optimization.
"""

import pandas as pd
import numpy as np
from datetime import datetime

def load_and_examine_data():
    """Load and examine the data structure"""
    file_path = "/Users/jackweston/Projects/pre-prod/BusinessReport-23-07-2025 (1).csv"
    df = pd.read_csv(file_path)
    
    print("📊 Data Structure:")
    print(f"Shape: {df.shape}")
    print(f"Columns: {list(df.columns)}")
    print(f"\nFirst few rows:")
    print(df.head(2))
    
    return df

def clean_data(df):
    """Clean and prepare the data"""
    print("\n🧹 Cleaning data...")
    
    # Clean column names
    df.columns = df.columns.str.strip()
    
    # Find and clean numeric columns
    numeric_columns = []
    for col in df.columns:
        if col in ['Sessions – Total', 'Units ordered', 'Page views – Total']:
            # These should be numeric
            df[col] = pd.to_numeric(df[col], errors='coerce')
            numeric_columns.append(col)
    
    # Find and clean percentage columns
    percentage_columns = []
    for col in df.columns:
        if 'percentage' in col.lower() or col in ['Unit Session Percentage']:
            if df[col].dtype == 'object':
                # Clean percentage values
                df[col] = df[col].astype(str).str.replace('%', '').replace('nan', np.nan)
                df[col] = pd.to_numeric(df[col], errors='coerce')
            percentage_columns.append(col)
    
    # Find and clean currency columns
    currency_columns = []
    for col in df.columns:
        if 'Sales' in col:
            if df[col].dtype == 'object':
                # Clean currency values
                df[col] = df[col].astype(str).str.replace('£', '').str.replace(',', '').replace('nan', np.nan)
                df[col] = pd.to_numeric(df[col], errors='coerce')
            currency_columns.append(col)
    
    print(f"✅ Cleaned {len(numeric_columns)} numeric columns")
    print(f"✅ Cleaned {len(percentage_columns)} percentage columns")
    print(f"✅ Cleaned {len(currency_columns)} currency columns")
    
    # Calculate conversion rate if not already present
    if 'Unit Session Percentage' in df.columns:
        df['conversion_rate'] = df['Unit Session Percentage']
    elif 'Sessions – Total' in df.columns and 'Units ordered' in df.columns:
        df['conversion_rate'] = np.where(
            df['Sessions – Total'] > 0, 
            (df['Units ordered'] / df['Sessions – Total']) * 100, 
            0
        )
    else:
        print("❌ Could not find columns to calculate conversion rate")
        return df
    
    # Calculate AOV
    sales_col = None
    for col in df.columns:
        if 'Product Sales' in col and 'B2B' not in col:
            sales_col = col
            break
    
    if sales_col and 'Units ordered' in df.columns:
        df['aov'] = np.where(
            df['Units ordered'] > 0,
            df[sales_col] / df['Units ordered'], 
            0
        )
    
    return df

def find_high_traffic_high_conversion_products(df, top_n=15):
    """Find top N high-traffic, high-conversion products"""
    
    # Find sessions column
    sessions_col = 'Sessions – Total'
    if sessions_col not in df.columns:
        print("❌ Sessions column not found")
        return pd.DataFrame()
    
    # Filter for products with meaningful traffic (top 30% by sessions)
    traffic_threshold = df[sessions_col].quantile(0.7)
    high_traffic = df[df[sessions_col] >= traffic_threshold].copy()
    
    print(f"📈 High traffic threshold: {traffic_threshold:.0f} sessions")
    print(f"🎯 Found {len(high_traffic)} high-traffic products")
    
    # Sort by conversion rate (descending)
    high_traffic_sorted = high_traffic.sort_values('conversion_rate', ascending=False)
    
    # Get top performers
    top_performers = high_traffic_sorted.head(top_n)
    
    return top_performers, high_traffic_sorted

def find_high_traffic_low_conversion_products(high_traffic_sorted, bottom_n=15):
    """Find bottom N high-traffic, low-conversion products"""
    
    # Get bottom performers from high traffic products
    bottom_performers = high_traffic_sorted.tail(bottom_n)
    
    return bottom_performers

def display_results(top_performers, bottom_performers):
    """Display the analysis results"""
    
    print("\n🏆 TOP 15 HIGH-TRAFFIC, HIGH-CONVERSION PRODUCTS")
    print("=" * 80)
    print(f"{'SKU':<30} {'Sessions':<10} {'Conv%':<10} {'Sales':<12} {'Units':<8} {'AOV':<10}")
    print("=" * 80)
    
    sales_col = None
    for col in top_performers.columns:
        if 'Product Sales' in col and 'B2B' not in col:
            sales_col = col
            break
        elif 'Ordered Product Sales' in col:
            sales_col = col
            break
    
    for _, product in top_performers.iterrows():
        sku = str(product.get('SKU', 'N/A'))[:29]
        sessions = int(product['Sessions – Total']) if pd.notna(product['Sessions – Total']) else 0
        conversion = product['conversion_rate'] if pd.notna(product['conversion_rate']) else 0
        sales = product[sales_col] if sales_col and pd.notna(product[sales_col]) else 0
        units = int(product['Units ordered']) if pd.notna(product['Units ordered']) else 0
        aov = product.get('aov', 0) if pd.notna(product.get('aov', 0)) else 0
        
        print(f"{sku:<30} {sessions:<10} {conversion:<10.1f} £{sales:<11.2f} {units:<8} £{aov:<9.2f}")
    
    print("\n⚠️  BOTTOM 15 HIGH-TRAFFIC, LOW-CONVERSION PRODUCTS")
    print("=" * 80)
    print(f"{'SKU':<30} {'Sessions':<10} {'Conv%':<10} {'Sales':<12} {'Units':<8} {'AOV':<10}")
    print("=" * 80)
    
    for _, product in bottom_performers.iterrows():
        sku = str(product.get('SKU', 'N/A'))[:29]
        sessions = int(product['Sessions – Total']) if pd.notna(product['Sessions – Total']) else 0
        conversion = product['conversion_rate'] if pd.notna(product['conversion_rate']) else 0
        sales = product[sales_col] if sales_col and pd.notna(product[sales_col]) else 0
        units = int(product['Units ordered']) if pd.notna(product['Units ordered']) else 0
        aov = product.get('aov', 0) if pd.notna(product.get('aov', 0)) else 0
        
        print(f"{sku:<30} {sessions:<10} {conversion:<10.1f} £{sales:<11.2f} {units:<8} £{aov:<9.2f}")

def calculate_optimization_potential(top_performers, bottom_performers):
    """Calculate optimization potential"""
    
    print("\n💡 OPTIMIZATION POTENTIAL ANALYSIS")
    print("=" * 50)
    
    # Calculate average conversion rate of top performers
    avg_top_conversion = top_performers['conversion_rate'].mean()
    median_top_conversion = top_performers['conversion_rate'].median()
    
    print(f"📊 Top performers average conversion: {avg_top_conversion:.2f}%")
    print(f"📊 Top performers median conversion: {median_top_conversion:.2f}%")
    
    # Use median as target (more conservative)
    target_conversion = median_top_conversion
    
    # Find sales column
    sales_col = None
    for col in bottom_performers.columns:
        if 'Product Sales' in col and 'B2B' not in col:
            sales_col = col
            break
        elif 'Ordered Product Sales' in col:
            sales_col = col
            break
    
    if not sales_col:
        print("❌ Could not find sales column")
        print(f"Available columns: {list(bottom_performers.columns)}")
        return
    
    print(f"\n🎯 POTENTIAL IF BOTTOM PERFORMERS REACHED {target_conversion:.1f}% CONVERSION:")
    print("=" * 90)
    print(f"{'SKU':<30} {'Current':<12} {'Target':<12} {'Add Revenue':<15} {'% Uplift':<12}")
    print("=" * 90)
    
    total_additional_revenue = 0
    total_current_sales = 0
    
    for _, product in bottom_performers.iterrows():
        sku = str(product.get('SKU', 'N/A'))[:29]
        current_conv = product['conversion_rate']
        current_sessions = product['Sessions – Total']
        current_sales = product[sales_col] if pd.notna(product[sales_col]) else 0
        current_aov = product.get('aov', 0) if pd.notna(product.get('aov', 0)) else 0
        
        # Calculate potential additional revenue
        current_units = current_sessions * (current_conv / 100)
        target_units = current_sessions * (target_conversion / 100)
        additional_units = target_units - current_units
        additional_revenue = additional_units * current_aov
        
        # Calculate percentage uplift
        uplift_percent = (additional_revenue / current_sales * 100) if current_sales > 0 else 0
        
        total_additional_revenue += additional_revenue
        total_current_sales += current_sales
        
        print(f"{sku:<30} {current_conv:<12.1f} {target_conversion:<12.1f} £{additional_revenue:<14.2f} {uplift_percent:<11.1f}%")
    
    print("=" * 90)
    total_uplift_percent = (total_additional_revenue / total_current_sales * 100) if total_current_sales > 0 else 0
    print(f"{'TOTAL':<30} {'':<12} {'':<12} £{total_additional_revenue:<14.2f} {total_uplift_percent:<11.1f}%")
    
    print(f"\n🚀 Summary:")
    print(f"   • Total potential additional revenue: £{total_additional_revenue:,.2f}")
    print(f"   • Current sales of bottom performers: £{total_current_sales:,.2f}")
    print(f"   • Potential uplift: {total_uplift_percent:.1f}%")

def export_results(top_performers, bottom_performers):
    """Export results to files"""
    print("\n💾 Exporting results...")
    
    # Export CSV files
    top_performers.to_csv('/Users/jackweston/Projects/pre-prod/top_15_high_traffic_high_conversion.csv', index=False)
    bottom_performers.to_csv('/Users/jackweston/Projects/pre-prod/bottom_15_high_traffic_low_conversion.csv', index=False)
    
    # Create detailed summary report
    with open('/Users/jackweston/Projects/pre-prod/traffic_conversion_analysis_report.md', 'w') as f:
        f.write("# Traffic vs Conversion Analysis Report\n")
        f.write(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"**File:** BusinessReport-23-07-2025 (1).csv\n\n")
        
        f.write("## Executive Summary\n")
        f.write(f"- **Top 15 High-Traffic, High-Conversion Products** identified for benchmarking\n")
        f.write(f"- **Bottom 15 High-Traffic, Low-Conversion Products** identified for optimization\n")
        f.write(f"- **Average conversion rate of top performers:** {top_performers['conversion_rate'].mean():.2f}%\n")
        f.write(f"- **Average conversion rate of bottom performers:** {bottom_performers['conversion_rate'].mean():.2f}%\n\n")
        
        # Find sales column
        sales_col = None
        for col in top_performers.columns:
            if 'Product Sales' in col and 'B2B' not in col:
                sales_col = col
                break
            elif 'Ordered Product Sales' in col:
                sales_col = col
                break
        
        f.write("## Top 15 High-Traffic, High-Conversion Products\n")
        f.write("*These products are performing excellently and can serve as benchmarks for optimization strategies.*\n\n")
        f.write("| SKU | Sessions | Conversion % | Sales | Units | AOV |\n")
        f.write("|-----|----------|-------------|--------|-------|-----|\n")
        
        for _, product in top_performers.iterrows():
            sku = str(product.get('SKU', 'N/A'))
            sessions = int(product['Sessions – Total']) if pd.notna(product['Sessions – Total']) else 0
            conversion = product['conversion_rate'] if pd.notna(product['conversion_rate']) else 0
            sales = product[sales_col] if sales_col and pd.notna(product[sales_col]) else 0
            units = int(product['Units ordered']) if pd.notna(product['Units ordered']) else 0
            aov = product.get('aov', 0) if pd.notna(product.get('aov', 0)) else 0
            f.write(f"| {sku} | {sessions} | {conversion:.1f}% | £{sales:.2f} | {units} | £{aov:.2f} |\n")
        
        f.write("\n## Bottom 15 High-Traffic, Low-Conversion Products\n")
        f.write("*These products have good traffic but poor conversion - prime candidates for optimization.*\n\n")
        f.write("| SKU | Sessions | Conversion % | Sales | Units | AOV |\n")
        f.write("|-----|----------|-------------|--------|-------|-----|\n")
        
        for _, product in bottom_performers.iterrows():
            sku = str(product.get('SKU', 'N/A'))
            sessions = int(product['Sessions – Total']) if pd.notna(product['Sessions – Total']) else 0
            conversion = product['conversion_rate'] if pd.notna(product['conversion_rate']) else 0
            sales = product[sales_col] if sales_col and pd.notna(product[sales_col]) else 0
            units = int(product['Units ordered']) if pd.notna(product['Units ordered']) else 0
            aov = product.get('aov', 0) if pd.notna(product.get('aov', 0)) else 0
            f.write(f"| {sku} | {sessions} | {conversion:.1f}% | £{sales:.2f} | {units} | £{aov:.2f} |\n")
        
        f.write("\n## Recommended Actions\n")
        f.write("### For Top Performers:\n")
        f.write("- Analyze what makes these products successful\n")
        f.write("- Use their strategies as templates for other products\n")
        f.write("- Consider increasing advertising spend to drive more traffic\n\n")
        
        f.write("### For Bottom Performers:\n")
        f.write("- Review product listings and images\n")
        f.write("- Optimize pricing strategy\n")
        f.write("- Improve product descriptions and keywords\n")
        f.write("- Check competitor analysis\n")
        f.write("- Consider A/B testing different approaches\n")
    
    print("✅ Files exported:")
    print("   • top_15_high_traffic_high_conversion.csv")
    print("   • bottom_15_high_traffic_low_conversion.csv") 
    print("   • traffic_conversion_analysis_report.md")

def analyze_traffic_conversion(df):
    """Analyze traffic vs conversion patterns"""
    print("\n📊 Analyzing Traffic vs Conversion Patterns")
    print("=" * 50)
    
    # Find sessions column
    sessions_col = None
    for col in df.columns:
        if 'Sessions' in col and 'Total' in col and 'B2B' not in col:
            sessions_col = col
            break
    
    if sessions_col is None:
        print("❌ Could not find sessions column")
        return
    
    # Calculate traffic quartiles to define "high traffic"
    traffic_threshold = df[sessions_col].quantile(0.7)  # Top 30% traffic
    print(f"📈 High traffic threshold: {traffic_threshold:.0f} sessions")
    
    # Get high traffic products
    high_traffic = df[df[sessions_col] >= traffic_threshold].copy()
    
    if len(high_traffic) == 0:
        print("❌ No high-traffic products found")
        return
    
    print(f"🎯 Found {len(high_traffic)} high-traffic products")
    
    # Sort by conversion rate
    high_traffic_sorted = high_traffic.sort_values('conversion_rate', ascending=False)
    
    # Top 15 high-traffic, high-conversion
    top_performers = high_traffic_sorted.head(15)
    
    # Bottom 15 high-traffic, low-conversion
    bottom_performers = high_traffic_sorted.tail(15)
    
    # Display results
    print("\n🏆 TOP 15 HIGH-TRAFFIC, HIGH-CONVERSION PRODUCTS")
    print("-" * 55)
    print(f"{'SKU':<25} {'Sessions':<10} {'Conv%':<8} {'Sales':<12} {'Units':<8}")
    print("-" * 55)
    
    for _, product in top_performers.iterrows():
        sku = str(product.get('SKU', 'N/A'))[:24]
        sessions = int(product[sessions_col]) if pd.notna(product[sessions_col]) else 0
        conversion = product['conversion_rate'] if pd.notna(product['conversion_rate']) else 0
        
        # Find sales column
        sales = 0
        for col in df.columns:
            if 'Sales' in col and 'Total' in col and 'B2B' not in col:
                sales = product[col] if pd.notna(product[col]) else 0
                break
        
        # Find units column
        units = 0
        for col in df.columns:
            if 'Units ordered' in col and 'B2B' not in col:
                units = int(product[col]) if pd.notna(product[col]) else 0
                break
        
        print(f"{sku:<25} {sessions:<10} {conversion:<8.1f} £{sales:<11.2f} {units:<8}")
    
    print("\n⚠️  BOTTOM 15 HIGH-TRAFFIC, LOW-CONVERSION PRODUCTS")
    print("-" * 58)
    print(f"{'SKU':<25} {'Sessions':<10} {'Conv%':<8} {'Sales':<12} {'Units':<8}")
    print("-" * 58)
    
    for _, product in bottom_performers.iterrows():
        sku = str(product.get('SKU', 'N/A'))[:24]
        sessions = int(product[sessions_col]) if pd.notna(product[sessions_col]) else 0
        conversion = product['conversion_rate'] if pd.notna(product['conversion_rate']) else 0
        
        # Find sales column
        sales = 0
        for col in df.columns:
            if 'Sales' in col and 'Total' in col and 'B2B' not in col:
                sales = product[col] if pd.notna(product[col]) else 0
                break
        
        # Find units column
        units = 0
        for col in df.columns:
            if 'Units ordered' in col and 'B2B' not in col:
                units = int(product[col]) if pd.notna(product[col]) else 0
                break
        
        print(f"{sku:<25} {sessions:<10} {conversion:<8.1f} £{sales:<11.2f} {units:<8}")
    
    return top_performers, bottom_performers

def calculate_optimization_potential(top_performers, bottom_performers):
    """Calculate optimization potential for bottom performers"""
    print("\n💡 OPTIMIZATION POTENTIAL ANALYSIS")
    print("=" * 40)
    
    if len(top_performers) == 0 or len(bottom_performers) == 0:
        print("❌ Insufficient data for optimization analysis")
        return
    
    # Calculate average conversion rate of top performers
    avg_top_conversion = top_performers['conversion_rate'].mean()
    print(f"📊 Average conversion rate of top performers: {avg_top_conversion:.2f}%")
    
    # Find sessions and sales columns
    sessions_col = None
    sales_col = None
    
    for col in top_performers.columns:
        if 'Sessions' in col and 'Total' in col and 'B2B' not in col:
            sessions_col = col
        if 'Sales' in col and 'Total' in col and 'B2B' not in col:
            sales_col = col
    
    if sessions_col is None or sales_col is None:
        print("❌ Could not find required columns for optimization analysis")
        return
    
    print(f"\n🎯 OPTIMIZATION OPPORTUNITIES (if bottom performers reached top performer avg conversion):")
    print("-" * 85)
    print(f"{'SKU':<25} {'Current Conv%':<12} {'Potential Conv%':<15} {'Additional Revenue':<18}")
    print("-" * 85)
    
    total_additional_revenue = 0
    
    for _, product in bottom_performers.iterrows():
        sku = str(product.get('SKU', 'N/A'))[:24]
        current_conv = product['conversion_rate']
        current_sessions = product[sessions_col]
        current_aov = product.get('aov', 0)
        
        if current_aov == 0 and product.get('Units ordered', 0) > 0:
            current_aov = product[sales_col] / product['Units ordered']
        
        # Calculate potential if conversion reached top performer average
        potential_conv = avg_top_conversion
        current_units = current_sessions * (current_conv / 100)
        potential_units = current_sessions * (potential_conv / 100)
        additional_units = potential_units - current_units
        additional_revenue = additional_units * current_aov
        
        total_additional_revenue += additional_revenue
        
        print(f"{sku:<25} {current_conv:<12.1f} {potential_conv:<15.1f} £{additional_revenue:<17.2f}")
    
    print("-" * 85)
    print(f"{'TOTAL POTENTIAL':<53} £{total_additional_revenue:<17.2f}")
    
    # Calculate percentage uplift
    current_total_sales = bottom_performers[sales_col].sum()
    uplift_percentage = (total_additional_revenue / current_total_sales * 100) if current_total_sales > 0 else 0
    
    print(f"\n📈 Total optimization potential: £{total_additional_revenue:.2f}")
    print(f"🚀 Potential uplift for bottom performers: {uplift_percentage:.1f}%")

def export_results(top_performers, bottom_performers):
    """Export results to files"""
    print("\n💾 Exporting results...")
    
    # Export top performers
    if len(top_performers) > 0:
        top_performers.to_csv('/Users/jackweston/Projects/pre-prod/top_15_high_traffic_high_conversion.csv', index=False)
        print("✅ Top performers exported to: top_15_high_traffic_high_conversion.csv")
    
    # Export bottom performers
    if len(bottom_performers) > 0:
        bottom_performers.to_csv('/Users/jackweston/Projects/pre-prod/bottom_15_high_traffic_low_conversion.csv', index=False)
        print("✅ Bottom performers exported to: bottom_15_high_traffic_low_conversion.csv")
    
    # Create summary report
    with open('/Users/jackweston/Projects/pre-prod/traffic_conversion_summary.md', 'w') as f:
        f.write("# Traffic vs Conversion Analysis Summary\n")
        f.write(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        
        f.write("## Top 15 High-Traffic, High-Conversion Products\n")
        f.write("These products are performing well and can serve as benchmarks:\n\n")
        f.write("| SKU | Sessions | Conversion % | Sales |\n")
        f.write("|-----|----------|-------------|-------|\n")
        
        # Find column names
        sessions_col = None
        sales_col = None
        for col in top_performers.columns:
            if 'Sessions' in col and 'Total' in col and 'B2B' not in col:
                sessions_col = col
            if 'Sales' in col and 'Total' in col and 'B2B' not in col:
                sales_col = col
        
        for _, product in top_performers.iterrows():
            sku = str(product.get('SKU', 'N/A'))
            sessions = int(product[sessions_col]) if sessions_col and pd.notna(product[sessions_col]) else 0
            conversion = product['conversion_rate'] if pd.notna(product['conversion_rate']) else 0
            sales = product[sales_col] if sales_col and pd.notna(product[sales_col]) else 0
            f.write(f"| {sku} | {sessions} | {conversion:.1f}% | £{sales:.2f} |\n")
        
        f.write("\n## Bottom 15 High-Traffic, Low-Conversion Products\n")
        f.write("These products need optimization attention:\n\n")
        f.write("| SKU | Sessions | Conversion % | Sales |\n")
        f.write("|-----|----------|-------------|-------|\n")
        
        for _, product in bottom_performers.iterrows():
            sku = str(product.get('SKU', 'N/A'))
            sessions = int(product[sessions_col]) if sessions_col and pd.notna(product[sessions_col]) else 0
            conversion = product['conversion_rate'] if pd.notna(product['conversion_rate']) else 0
            sales = product[sales_col] if sales_col and pd.notna(product[sales_col]) else 0
            f.write(f"| {sku} | {sessions} | {conversion:.1f}% | £{sales:.2f} |\n")
    
    print("✅ Summary report exported to: traffic_conversion_summary.md")

def main():
    """Main function"""
    print("🚀 Traffic vs Conversion Analysis")
    print("=" * 50)
    
    # Load and examine data
    df = load_and_examine_data()
    
    # Clean data
    df = clean_data(df)
    
    # Find high-traffic products and analyze
    top_performers, high_traffic_sorted = find_high_traffic_high_conversion_products(df)
    bottom_performers = find_high_traffic_low_conversion_products(high_traffic_sorted)
    
    if len(top_performers) == 0 or len(bottom_performers) == 0:
        print("❌ Could not find enough products for analysis")
        return
    
    # Display results
    display_results(top_performers, bottom_performers)
    
    # Calculate optimization potential
    calculate_optimization_potential(top_performers, bottom_performers)
    
    # Export results
    export_results(top_performers, bottom_performers)
    
    print("\n✅ Analysis completed successfully!")

if __name__ == "__main__":
    main()
