#!/usr/bin/env python3
"""
Traffic vs Conversion Analysis - BusinessReport (3) Version
Analyzes high-traffic products to find best and worst conversion rates using Sessions – Total and Units ordered.
"""

import pandas as pd
import numpy as np
from datetime import datetime

def load_and_examine_data():
    """Load and examine the new data structure"""
    file_path = "/Users/jackweston/Projects/pre-prod/BusinessReport-23-07-2025 (3).csv"
    df = pd.read_csv(file_path)
    
    print("📊 Data Structure:")
    print(f"Shape: {df.shape}")
    print(f"Key columns found:")
    key_cols = ['SKU', 'Sessions – Total', 'Units ordered', 'Ordered Product Sales']
    for col in key_cols:
        if col in df.columns:
            print(f"  ✅ {col}")
        else:
            print(f"  ❌ {col} (missing)")
    
    print(f"\nFirst few rows preview:")
    display_cols = ['SKU', 'Title', 'Sessions – Total', 'Units ordered', 'Ordered Product Sales']
    available_cols = [col for col in display_cols if col in df.columns]
    print(df[available_cols].head(3))
    
    return df

def clean_data(df):
    """Clean and prepare the data"""
    print("\n🧹 Cleaning data...")
    
    # Clean column names
    df.columns = df.columns.str.strip()
    
    # Handle comma-separated numbers in Sessions – Total
    if 'Sessions – Total' in df.columns:
        # Remove commas and convert to numeric
        df['Sessions – Total'] = df['Sessions – Total'].astype(str).str.replace(',', '').replace('nan', np.nan)
        df['Sessions – Total'] = pd.to_numeric(df['Sessions – Total'], errors='coerce')
        print("  ✅ Cleaned Sessions – Total (removed commas)")
    
    # Clean Units ordered
    if 'Units ordered' in df.columns:
        df['Units ordered'] = pd.to_numeric(df['Units ordered'], errors='coerce')
        print("  ✅ Cleaned Units ordered")
    
    # Clean sales data
    if 'Ordered Product Sales' in df.columns:
        # Remove £ and commas, then convert to numeric
        df['Ordered Product Sales'] = df['Ordered Product Sales'].astype(str).str.replace('£', '').str.replace(',', '').replace('nan', np.nan)
        df['Ordered Product Sales'] = pd.to_numeric(df['Ordered Product Sales'], errors='coerce')
        print("  ✅ Cleaned Ordered Product Sales")
    
    # Calculate conversion rate using Sessions – Total and Units ordered
    if 'Sessions – Total' in df.columns and 'Units ordered' in df.columns:
        df['conversion_rate'] = np.where(
            df['Sessions – Total'] > 0, 
            (df['Units ordered'] / df['Sessions – Total']) * 100, 
            0
        )
        print("  ✅ Calculated conversion rate (Units ordered / Sessions – Total * 100)")
    
    # Calculate AOV
    if 'Ordered Product Sales' in df.columns and 'Units ordered' in df.columns:
        df['aov'] = np.where(
            df['Units ordered'] > 0,
            df['Ordered Product Sales'] / df['Units ordered'], 
            0
        )
        print("  ✅ Calculated AOV (Average Order Value)")
    
    # Remove rows with missing critical data
    initial_count = len(df)
    df = df.dropna(subset=['Sessions – Total', 'Units ordered', 'conversion_rate'])
    final_count = len(df)
    
    if initial_count > final_count:
        print(f"  ⚠️  Removed {initial_count - final_count} rows with missing data")
    
    print(f"  📊 Final dataset: {final_count} products")
    
    return df

def find_top_and_bottom_performers(df, traffic_threshold_percentile=70, top_n=15, bottom_n=15):
    """Find top and bottom performers among high-traffic products"""
    
    # Calculate traffic threshold (top 30% by sessions)
    traffic_threshold = df['Sessions – Total'].quantile(traffic_threshold_percentile / 100)
    
    # Filter for high-traffic products
    high_traffic = df[df['Sessions – Total'] >= traffic_threshold].copy()
    
    print(f"\n📈 Analysis Parameters:")
    print(f"  • Traffic threshold (top {100-traffic_threshold_percentile}%): {traffic_threshold:.0f} sessions")
    print(f"  • High-traffic products found: {len(high_traffic)}")
    print(f"  • Total products in dataset: {len(df)}")
    
    if len(high_traffic) == 0:
        print("❌ No high-traffic products found!")
        return pd.DataFrame(), pd.DataFrame()
    
    # Sort by conversion rate
    high_traffic_sorted = high_traffic.sort_values('conversion_rate', ascending=False)
    
    # Get top and bottom performers
    top_performers = high_traffic_sorted.head(top_n)
    bottom_performers = high_traffic_sorted.tail(bottom_n)
    
    print(f"  • Top {top_n} performers identified")
    print(f"  • Bottom {bottom_n} performers identified")
    
    return top_performers, bottom_performers

def display_results(top_performers, bottom_performers):
    """Display the analysis results in a clear format with SKU and Title"""
    
    print("\n" + "="*120)
    print("🏆 TOP 15 HIGH-TRAFFIC, HIGH-CONVERSION PRODUCTS")
    print("="*120)
    print(f"{'Rank':<4} {'SKU':<25} {'Product Title':<40} {'Sessions':<8} {'Units':<6} {'Conv%':<8} {'Sales':<10} {'AOV':<8}")
    print("-"*120)
    
    for i, (_, product) in enumerate(top_performers.iterrows(), 1):
        sku = str(product.get('SKU', 'N/A'))[:24]
        title = str(product.get('Title', 'N/A'))[:39]
        sessions = int(product['Sessions – Total']) if pd.notna(product['Sessions – Total']) else 0
        units = int(product['Units ordered']) if pd.notna(product['Units ordered']) else 0
        conversion = product['conversion_rate'] if pd.notna(product['conversion_rate']) else 0
        sales = product['Ordered Product Sales'] if pd.notna(product['Ordered Product Sales']) else 0
        aov = product.get('aov', 0) if pd.notna(product.get('aov', 0)) else 0
        
        print(f"{i:<4} {sku:<25} {title:<40} {sessions:<8} {units:<6} {conversion:<8.1f} £{sales:<9.2f} £{aov:<7.2f}")
    
    print("\n" + "="*120)
    print("⚠️  BOTTOM 15 HIGH-TRAFFIC, LOW-CONVERSION PRODUCTS")
    print("="*120)
    print(f"{'Rank':<4} {'SKU':<25} {'Product Title':<40} {'Sessions':<8} {'Units':<6} {'Conv%':<8} {'Sales':<10} {'AOV':<8}")
    print("-"*120)
    
    # Show bottom performers from worst to best (reverse order)
    bottom_reversed = bottom_performers.iloc[::-1]
    for i, (_, product) in enumerate(bottom_reversed.iterrows(), 1):
        sku = str(product.get('SKU', 'N/A'))[:24]
        title = str(product.get('Title', 'N/A'))[:39]
        sessions = int(product['Sessions – Total']) if pd.notna(product['Sessions – Total']) else 0
        units = int(product['Units ordered']) if pd.notna(product['Units ordered']) else 0
        conversion = product['conversion_rate'] if pd.notna(product['conversion_rate']) else 0
        sales = product['Ordered Product Sales'] if pd.notna(product['Ordered Product Sales']) else 0
        aov = product.get('aov', 0) if pd.notna(product.get('aov', 0)) else 0
        
        print(f"{i:<4} {sku:<25} {title:<40} {sessions:<8} {units:<6} {conversion:<8.1f} £{sales:<9.2f} £{aov:<7.2f}")

def calculate_optimization_potential(top_performers, bottom_performers):
    """Calculate optimization potential for bottom performers"""
    
    print("\n" + "="*80)
    print("💡 OPTIMIZATION POTENTIAL ANALYSIS")
    print("="*80)
    
    # Calculate key metrics for top performers
    avg_top_conversion = top_performers['conversion_rate'].mean()
    median_top_conversion = top_performers['conversion_rate'].median()
    min_top_conversion = top_performers['conversion_rate'].min()
    
    print(f"📊 Top Performers Conversion Statistics:")
    print(f"  • Average: {avg_top_conversion:.2f}%")
    print(f"  • Median: {median_top_conversion:.2f}%")
    print(f"  • Minimum: {min_top_conversion:.2f}%")
    
    # Calculate key metrics for bottom performers
    avg_bottom_conversion = bottom_performers['conversion_rate'].mean()
    median_bottom_conversion = bottom_performers['conversion_rate'].median()
    max_bottom_conversion = bottom_performers['conversion_rate'].max()
    
    print(f"\n📊 Bottom Performers Conversion Statistics:")
    print(f"  • Average: {avg_bottom_conversion:.2f}%")
    print(f"  • Median: {median_bottom_conversion:.2f}%")
    print(f"  • Maximum: {max_bottom_conversion:.2f}%")
    
    # Use median of top performers as target (conservative approach)
    target_conversion = median_top_conversion
    
    print(f"\n🎯 OPTIMIZATION SCENARIO:")
    print(f"Target: Improve bottom performers to {target_conversion:.1f}% conversion rate")
    print("-"*95)
    print(f"{'SKU':<25} {'Product Title':<35} {'Current%':<10} {'Target%':<10} {'Add Revenue':<12}")
    print("-"*95)
    
    total_additional_revenue = 0
    total_current_sales = 0
    total_additional_units = 0
    
    for _, product in bottom_performers.iterrows():
        sku = str(product.get('SKU', 'N/A'))[:24]
        title = str(product.get('Title', 'N/A'))[:34]
        current_conv = product['conversion_rate']
        current_sessions = product['Sessions – Total']
        current_sales = product['Ordered Product Sales'] if pd.notna(product['Ordered Product Sales']) else 0
        current_aov = product.get('aov', 0) if pd.notna(product.get('aov', 0)) else 0
        
        # Calculate potential additional revenue
        current_units = current_sessions * (current_conv / 100)
        target_units = current_sessions * (target_conversion / 100)
        additional_units = target_units - current_units
        additional_revenue = additional_units * current_aov
        
        total_additional_revenue += additional_revenue
        total_current_sales += current_sales
        total_additional_units += additional_units
        
        print(f"{sku:<25} {title:<35} {current_conv:<10.2f} {target_conversion:<10.1f} £{additional_revenue:<11.2f}")
    
    print("-"*95)
    print(f"{'TOTAL POTENTIAL':<25} {'':<35} {'':<10} {'':<10} £{total_additional_revenue:<11.2f}")
    
    # Calculate percentage uplift
    total_uplift_percent = (total_additional_revenue / total_current_sales * 100) if total_current_sales > 0 else 0
    
    print(f"\n🚀 OPTIMIZATION IMPACT SUMMARY:")
    print(f"  • Additional units potential: {total_additional_units:.0f} units")
    print(f"  • Additional revenue potential: £{total_additional_revenue:,.2f}")
    print(f"  • Current sales (bottom 15): £{total_current_sales:,.2f}")
    print(f"  • Potential uplift: {total_uplift_percent:.1f}%")
    
    # Calculate efficiency gap
    avg_efficiency_gap = avg_top_conversion - avg_bottom_conversion
    print(f"  • Conversion efficiency gap: {avg_efficiency_gap:.1f} percentage points")

def export_results(top_performers, bottom_performers):
    """Export results to CSV files and create summary report"""
    print("\n💾 Exporting Results...")
    
    # Export CSV files
    top_file = '/Users/jackweston/Projects/pre-prod/top_15_conversion_performers_report3.csv'
    bottom_file = '/Users/jackweston/Projects/pre-prod/bottom_15_conversion_performers_report3.csv'
    
    top_performers.to_csv(top_file, index=False)
    bottom_performers.to_csv(bottom_file, index=False)
    
    # Create comprehensive markdown report
    report_file = '/Users/jackweston/Projects/pre-prod/conversion_analysis_report3.md'
    
    with open(report_file, 'w') as f:
        f.write("# Traffic vs Conversion Analysis Report\n")
        f.write(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"**Source:** BusinessReport-23-07-2025 (3).csv\n")
        f.write(f"**Analysis Method:** Sessions – Total vs Units ordered\n\n")
        
        f.write("## Executive Summary\n\n")
        f.write(f"- **Dataset Size:** {len(top_performers) + len(bottom_performers)} high-traffic products analyzed\n")
        f.write(f"- **Top Performers Average Conversion:** {top_performers['conversion_rate'].mean():.2f}%\n")
        f.write(f"- **Bottom Performers Average Conversion:** {bottom_performers['conversion_rate'].mean():.2f}%\n")
        f.write(f"- **Conversion Gap:** {top_performers['conversion_rate'].mean() - bottom_performers['conversion_rate'].mean():.1f} percentage points\n\n")
        
        f.write("## 🏆 Top 15 High-Traffic, High-Conversion Products\n\n")
        f.write("| Rank | SKU | Title | Sessions | Units | Conversion % | Sales | AOV |\n")
        f.write("|------|-----|-------|----------|-------|-------------|--------|-----|\n")
        
        for i, (_, product) in enumerate(top_performers.iterrows(), 1):
            sku = str(product.get('SKU', 'N/A'))
            title = str(product.get('Title', 'N/A'))[:50]  # Truncate long titles
            sessions = int(product['Sessions – Total']) if pd.notna(product['Sessions – Total']) else 0
            units = int(product['Units ordered']) if pd.notna(product['Units ordered']) else 0
            conversion = product['conversion_rate'] if pd.notna(product['conversion_rate']) else 0
            sales = product['Ordered Product Sales'] if pd.notna(product['Ordered Product Sales']) else 0
            aov = product.get('aov', 0) if pd.notna(product.get('aov', 0)) else 0
            f.write(f"| {i} | {sku} | {title} | {sessions} | {units} | {conversion:.1f}% | £{sales:.2f} | £{aov:.2f} |\n")
        
        f.write("\n## ⚠️ Bottom 15 High-Traffic, Low-Conversion Products\n\n")
        f.write("| Rank | SKU | Title | Sessions | Units | Conversion % | Sales | AOV |\n")
        f.write("|------|-----|-------|----------|-------|-------------|--------|-----|\n")
        
        bottom_reversed = bottom_performers.iloc[::-1]
        for i, (_, product) in enumerate(bottom_reversed.iterrows(), 1):
            sku = str(product.get('SKU', 'N/A'))
            title = str(product.get('Title', 'N/A'))[:50]  # Truncate long titles
            sessions = int(product['Sessions – Total']) if pd.notna(product['Sessions – Total']) else 0
            units = int(product['Units ordered']) if pd.notna(product['Units ordered']) else 0
            conversion = product['conversion_rate'] if pd.notna(product['conversion_rate']) else 0
            sales = product['Ordered Product Sales'] if pd.notna(product['Ordered Product Sales']) else 0
            aov = product.get('aov', 0) if pd.notna(product.get('aov', 0)) else 0
            f.write(f"| {i} | {sku} | {title} | {sessions} | {units} | {conversion:.1f}% | £{sales:.2f} | £{aov:.2f} |\n")
        
        f.write("\n## 💡 Key Insights & Recommendations\n\n")
        f.write("### What Top Performers Do Right:\n")
        f.write("- Analyze common characteristics of top converting products\n")
        f.write("- Study their product listings, pricing, and positioning\n")
        f.write("- Consider expanding advertising for these high-performers\n\n")
        
        f.write("### Opportunities for Bottom Performers:\n")
        f.write("- **Product Listing Optimization:** Improve titles, descriptions, images\n")
        f.write("- **Pricing Strategy:** Review competitive positioning\n")
        f.write("- **User Experience:** Optimize mobile and browser experience\n")
        f.write("- **A/B Testing:** Test different approaches systematically\n")
        f.write("- **Quality Score:** Ensure product quality meets customer expectations\n")
    
    print(f"✅ Files exported:")
    print(f"   • {top_file}")
    print(f"   • {bottom_file}")
    print(f"   • {report_file}")

def main():
    """Main function to run the complete analysis"""
    print("🚀 Traffic vs Conversion Analysis - Business Report (3)")
    print("=" * 60)
    
    # Load and examine data
    df = load_and_examine_data()
    
    # Clean data
    df = clean_data(df)
    
    if len(df) == 0:
        print("❌ No valid data found after cleaning!")
        return
    
    # Find top and bottom performers
    top_performers, bottom_performers = find_top_and_bottom_performers(df)
    
    if len(top_performers) == 0 or len(bottom_performers) == 0:
        print("❌ Could not find enough high-traffic products for analysis!")
        return
    
    # Display results
    display_results(top_performers, bottom_performers)
    
    # Calculate optimization potential
    calculate_optimization_potential(top_performers, bottom_performers)
    
    # Export results
    export_results(top_performers, bottom_performers)
    
    print(f"\n✅ Analysis completed successfully!")
    print(f"📊 Analyzed conversion rates using Sessions – Total and Units ordered")

if __name__ == "__main__":
    main()
