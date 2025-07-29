#!/usr/bin/env python3
"""
Advanced Analysis and Visualization for BusinessReport-23-07-2025 (1).csv
Creates comprehensive dashboards and insights for the larger dataset.
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

# Set style for better-looking plots
plt.style.use('default')
sns.set_palette("husl")

def load_cleaned_data():
    """Load the cleaned data"""
    try:
        df = pd.read_csv("BusinessReport-23-07-2025_1_cleaned.csv")
        print(f"📊 Loaded cleaned data: {len(df)} products")
        return df
    except FileNotFoundError:
        print("❌ Cleaned data not found. Please run analyze_new_report.py first.")
        return None

def create_comprehensive_dashboard(df):
    """Create a comprehensive performance dashboard"""
    print("📊 Creating comprehensive dashboard...")
    
    # Create a large figure with multiple subplots
    fig, axes = plt.subplots(3, 3, figsize=(24, 18))
    fig.suptitle('Amazon Business Report - Comprehensive Performance Dashboard\n1,128 Products Analysis', 
                 fontsize=20, fontweight='bold')
    
    # 1. Sales Distribution (Log Scale)
    sales_data = df[df['sales_total'] > 0]['sales_total']
    axes[0, 0].hist(np.log10(sales_data), bins=40, edgecolor='black', alpha=0.7, color='skyblue')
    axes[0, 0].set_title('Sales Distribution (Log Scale)', fontsize=14, fontweight='bold')
    axes[0, 0].set_xlabel('Log10(Sales £)')
    axes[0, 0].set_ylabel('Frequency')
    axes[0, 0].axvline(np.log10(sales_data.mean()), color='red', linestyle='--', 
                      label=f'Mean: £{sales_data.mean():.0f}')
    axes[0, 0].legend()
    
    # 2. Sessions vs Sales Scatter
    scatter = axes[0, 1].scatter(df['sessions_total'], df['sales_total'], 
                                alpha=0.6, c=df['conversion_rate'], cmap='viridis', s=30)
    axes[0, 1].set_title('Sessions vs Sales (colored by Conversion Rate)', fontsize=14, fontweight='bold')
    axes[0, 1].set_xlabel('Sessions')
    axes[0, 1].set_ylabel('Sales (£)')
    axes[0, 1].set_xlim(0, df['sessions_total'].quantile(0.95))  # Remove extreme outliers for better view
    plt.colorbar(scatter, ax=axes[0, 1], label='Conversion Rate %')
    
    # 3. Prime vs Non-Prime Performance
    prime_data = df.groupby('is_prime').agg({
        'sales_total': 'sum',
        'units_ordered': 'sum',
        'conversion_rate': 'mean'
    }).reset_index()
    
    prime_labels = ['Non-Prime', 'Prime']
    x_pos = np.arange(len(prime_labels))
    bars = axes[0, 2].bar(x_pos, prime_data['sales_total'], color=['lightcoral', 'lightgreen'])
    axes[0, 2].set_title('Prime vs Non-Prime Total Sales', fontsize=14, fontweight='bold')
    axes[0, 2].set_ylabel('Total Sales (£)')
    axes[0, 2].set_xticks(x_pos)
    axes[0, 2].set_xticklabels(prime_labels)
    
    # Add value labels on bars
    for i, (bar, value) in enumerate(zip(bars, prime_data['sales_total'])):
        axes[0, 2].text(bar.get_x() + bar.get_width()/2, bar.get_height() + 1000, 
                       f'£{value:,.0f}', ha='center', va='bottom', fontweight='bold')
    
    # 4. Conversion Rate Distribution
    conv_data = df[df['conversion_rate'] <= 100]['conversion_rate']  # Filter out impossible values
    axes[1, 0].hist(conv_data, bins=50, edgecolor='black', alpha=0.7, color='orange')
    axes[1, 0].set_title('Conversion Rate Distribution', fontsize=14, fontweight='bold')
    axes[1, 0].set_xlabel('Conversion Rate (%)')
    axes[1, 0].set_ylabel('Frequency')
    axes[1, 0].axvline(conv_data.mean(), color='red', linestyle='--', 
                      label=f'Mean: {conv_data.mean():.1f}%')
    axes[1, 0].legend()
    
    # 5. Top 15 Categories by Sales
    category_sales = df.groupby('sku_category')['sales_total'].sum().sort_values(ascending=False).head(15)
    y_pos = np.arange(len(category_sales))
    axes[1, 1].barh(y_pos, category_sales.values, color='lightblue')
    axes[1, 1].set_yticks(y_pos)
    axes[1, 1].set_yticklabels(category_sales.index)
    axes[1, 1].set_title('Top 15 Categories by Sales', fontsize=14, fontweight='bold')
    axes[1, 1].set_xlabel('Sales (£)')
    
    # 6. Buy Box Performance
    bb_data = df[df['buy_box_percentage'].notna()]
    if len(bb_data) > 0:
        axes[1, 2].scatter(bb_data['buy_box_percentage'], bb_data['sales_total'], alpha=0.6, color='purple')
        axes[1, 2].set_title('Buy Box % vs Sales', fontsize=14, fontweight='bold')
        axes[1, 2].set_xlabel('Buy Box Win Rate (%)')
        axes[1, 2].set_ylabel('Sales (£)')
        axes[1, 2].set_ylim(0, df['sales_total'].quantile(0.95))
    else:
        axes[1, 2].text(0.5, 0.5, 'No Buy Box Data', ha='center', va='center', 
                       transform=axes[1, 2].transAxes, fontsize=14)
        axes[1, 2].set_title('Buy Box Analysis', fontsize=14, fontweight='bold')
    
    # 7. Sessions Distribution (Log Scale)
    session_data = df[df['sessions_total'] > 0]['sessions_total']
    axes[2, 0].hist(np.log10(session_data), bins=40, edgecolor='black', alpha=0.7, color='lightgreen')
    axes[2, 0].set_title('Sessions Distribution (Log Scale)', fontsize=14, fontweight='bold')
    axes[2, 0].set_xlabel('Log10(Sessions)')
    axes[2, 0].set_ylabel('Frequency')
    
    # 8. AOV vs Units Ordered
    axes[2, 1].scatter(df['units_ordered'], df['avg_order_value'], alpha=0.6, color='red')
    axes[2, 1].set_title('Units Ordered vs Average Order Value', fontsize=14, fontweight='bold')
    axes[2, 1].set_xlabel('Units Ordered')
    axes[2, 1].set_ylabel('Average Order Value (£)')
    axes[2, 1].set_xlim(0, df['units_ordered'].quantile(0.95))
    axes[2, 1].set_ylim(0, df['avg_order_value'].quantile(0.95))
    
    # 9. Performance Quadrants
    # Define thresholds
    high_sessions_threshold = df['sessions_total'].quantile(0.75)
    high_conversion_threshold = df['conversion_rate'].quantile(0.75)
    
    # Create quadrant plot
    colors = []
    for _, row in df.iterrows():
        if row['sessions_total'] >= high_sessions_threshold and row['conversion_rate'] >= high_conversion_threshold:
            colors.append('green')  # Star performers
        elif row['sessions_total'] >= high_sessions_threshold and row['conversion_rate'] < high_conversion_threshold:
            colors.append('red')    # High traffic, low conversion
        elif row['sessions_total'] < high_sessions_threshold and row['conversion_rate'] >= high_conversion_threshold:
            colors.append('blue')   # Low traffic, high conversion
        else:
            colors.append('gray')   # Underperformers
    
    scatter = axes[2, 2].scatter(df['sessions_total'], df['conversion_rate'], 
                                c=colors, alpha=0.6, s=30)
    axes[2, 2].axvline(high_sessions_threshold, color='black', linestyle='--', alpha=0.5)
    axes[2, 2].axhline(high_conversion_threshold, color='black', linestyle='--', alpha=0.5)
    axes[2, 2].set_title('Performance Quadrants', fontsize=14, fontweight='bold')
    axes[2, 2].set_xlabel('Sessions')
    axes[2, 2].set_ylabel('Conversion Rate (%)')
    axes[2, 2].set_xlim(0, df['sessions_total'].quantile(0.95))
    
    # Add quadrant labels
    axes[2, 2].text(0.75, 0.75, 'Stars', transform=axes[2, 2].transAxes, 
                   fontsize=12, fontweight='bold', color='green')
    axes[2, 2].text(0.75, 0.25, 'Traffic\nOpportunity', transform=axes[2, 2].transAxes, 
                   fontsize=12, fontweight='bold', color='red')
    axes[2, 2].text(0.25, 0.75, 'Conversion\nStars', transform=axes[2, 2].transAxes, 
                   fontsize=12, fontweight='bold', color='blue')
    axes[2, 2].text(0.25, 0.25, 'Question\nMarks', transform=axes[2, 2].transAxes, 
                   fontsize=12, fontweight='bold', color='gray')
    
    plt.tight_layout()
    plt.savefig('BusinessReport-23-07-2025_1_comprehensive_dashboard.png', dpi=300, bbox_inches='tight')
    print("✅ Comprehensive dashboard saved")
    plt.show()

def analyze_performance_segments(df):
    """Analyze products by performance segments"""
    print("\n🎯 Performance Segment Analysis...")
    
    # Define segments based on sessions and conversion
    high_sessions = df['sessions_total'].quantile(0.75)
    high_conversion = df['conversion_rate'].quantile(0.75)
    
    # Segment the data
    segments = {
        'Star Performers': df[(df['sessions_total'] >= high_sessions) & 
                             (df['conversion_rate'] >= high_conversion)],
        'Traffic Opportunities': df[(df['sessions_total'] >= high_sessions) & 
                                  (df['conversion_rate'] < high_conversion)],
        'Conversion Stars': df[(df['sessions_total'] < high_sessions) & 
                              (df['conversion_rate'] >= high_conversion)],
        'Question Marks': df[(df['sessions_total'] < high_sessions) & 
                           (df['conversion_rate'] < high_conversion)]
    }
    
    print("📊 Segment Summary:")
    for segment_name, segment_df in segments.items():
        total_sales = segment_df['sales_total'].sum()
        avg_aov = segment_df['avg_order_value'].mean()
        product_count = len(segment_df)
        
        print(f"\n{segment_name} ({product_count} products):")
        print(f"  💰 Total Sales: £{total_sales:,.2f}")
        print(f"  💵 Average AOV: £{avg_aov:.2f}")
        
        if product_count > 0:
            print(f"  🏆 Top 3 products:")
            top_products = segment_df.nlargest(3, 'sales_total')
            for _, product in top_products.iterrows():
                print(f"    • {product['sku']}: £{product['sales_total']:,.2f}")
    
    return segments

def create_opportunity_analysis(df):
    """Create detailed opportunity analysis"""
    print("\n💡 Detailed Opportunity Analysis...")
    
    # Create figure for opportunity analysis
    fig, axes = plt.subplots(2, 2, figsize=(16, 12))
    fig.suptitle('Optimization Opportunity Analysis', fontsize=16, fontweight='bold')
    
    # 1. No Buy Box Opportunities
    no_buybox = df[(df['buy_box_percentage'] == 0) & (df['sessions_total'] > 0)]
    if len(no_buybox) > 0:
        top_no_buybox = no_buybox.nlargest(20, 'sessions_total')
        y_pos = np.arange(len(top_no_buybox))
        axes[0, 0].barh(y_pos, top_no_buybox['sessions_total'])
        axes[0, 0].set_yticks(y_pos)
        axes[0, 0].set_yticklabels(top_no_buybox['sku'], fontsize=8)
        axes[0, 0].set_title(f'Top 20 No Buy Box Opportunities\n({len(no_buybox)} total products)')
        axes[0, 0].set_xlabel('Sessions')
    
    # 2. Prime Upgrade Opportunities
    non_prime_high_sales = df[(df['is_prime'] == False) & 
                              (df['sales_total'] >= df['sales_total'].quantile(0.8))]
    if len(non_prime_high_sales) > 0:
        top_prime_ops = non_prime_high_sales.nlargest(15, 'sales_total')
        y_pos = np.arange(len(top_prime_ops))
        axes[0, 1].barh(y_pos, top_prime_ops['sales_total'])
        axes[0, 1].set_yticks(y_pos)
        axes[0, 1].set_yticklabels(top_prime_ops['sku'], fontsize=8)
        axes[0, 1].set_title(f'Top 15 Prime Upgrade Opportunities\n({len(non_prime_high_sales)} total products)')
        axes[0, 1].set_xlabel('Sales (£)')
    
    # 3. High Traffic, Low Conversion
    high_traffic_low_conv = df[(df['sessions_total'] >= df['sessions_total'].quantile(0.9)) &
                               (df['conversion_rate'] <= df['conversion_rate'].quantile(0.1))]
    if len(high_traffic_low_conv) > 0:
        axes[1, 0].scatter(high_traffic_low_conv['sessions_total'], 
                          high_traffic_low_conv['conversion_rate'], alpha=0.7)
        axes[1, 0].set_title(f'High Traffic, Low Conversion\n({len(high_traffic_low_conv)} products)')
        axes[1, 0].set_xlabel('Sessions')
        axes[1, 0].set_ylabel('Conversion Rate (%)')
        
        # Add product labels for top opportunities
        for _, row in high_traffic_low_conv.nlargest(5, 'sessions_total').iterrows():
            axes[1, 0].annotate(row['sku'], (row['sessions_total'], row['conversion_rate']),
                              xytext=(5, 5), textcoords='offset points', fontsize=8)
    
    # 4. Bundle Opportunities (Low AOV, Multiple Sales)
    bundle_ops = df[(df['avg_order_value'] <= df['avg_order_value'].quantile(0.3)) &
                    (df['units_ordered'] >= 5)]
    if len(bundle_ops) > 0:
        top_bundle_ops = bundle_ops.nlargest(15, 'units_ordered')
        y_pos = np.arange(len(top_bundle_ops))
        axes[1, 1].barh(y_pos, top_bundle_ops['units_ordered'])
        axes[1, 1].set_yticks(y_pos)
        axes[1, 1].set_yticklabels(top_bundle_ops['sku'], fontsize=8)
        axes[1, 1].set_title(f'Top 15 Bundle Opportunities\n({len(bundle_ops)} total products)')
        axes[1, 1].set_xlabel('Units Ordered')
    
    plt.tight_layout()
    plt.savefig('BusinessReport-23-07-2025_1_opportunities.png', dpi=300, bbox_inches='tight')
    print("✅ Opportunity analysis saved")
    plt.show()

def export_detailed_insights(df, segments):
    """Export detailed insights to markdown"""
    print("\n📄 Exporting detailed insights...")
    
    with open('BusinessReport-23-07-2025_1_detailed_insights.md', 'w') as f:
        f.write("# Detailed Business Report Insights\n")
        f.write(f"**Analysis Date:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"**Dataset:** 1,128 products from BusinessReport-23-07-2025 (1).csv\n\n")
        
        # Executive Summary
        f.write("## Executive Summary\n\n")
        total_sales = df['sales_total'].sum()
        total_sessions = df['sessions_total'].sum()
        total_units = df['units_ordered'].sum()
        
        f.write(f"- **Total Revenue:** £{total_sales:,.2f}\n")
        f.write(f"- **Total Sessions:** {total_sessions:,}\n")
        f.write(f"- **Total Units Sold:** {total_units:,}\n")
        f.write(f"- **Overall Conversion Rate:** {(total_units/total_sessions*100):.2f}%\n")
        f.write(f"- **Average Order Value:** £{(total_sales/total_units):.2f}\n\n")
        
        # Performance Segments
        f.write("## Performance Segments\n\n")
        for segment_name, segment_df in segments.items():
            f.write(f"### {segment_name} ({len(segment_df)} products)\n")
            f.write(f"- **Total Sales:** £{segment_df['sales_total'].sum():,.2f}\n")
            f.write(f"- **Average Conversion:** {segment_df['conversion_rate'].mean():.1f}%\n")
            f.write(f"- **Average AOV:** £{segment_df['avg_order_value'].mean():.2f}\n\n")
        
        # Top Opportunities
        f.write("## Key Optimization Opportunities\n\n")
        
        # No Buy Box
        no_buybox = df[(df['buy_box_percentage'] == 0) & (df['sessions_total'] > 0)]
        potential_buybox_revenue = no_buybox['sessions_total'].sum() * 0.05 * df['avg_order_value'].mean()
        f.write(f"### 1. Buy Box Opportunities\n")
        f.write(f"- **Products without buy box:** {len(no_buybox)}\n")
        f.write(f"- **Potential revenue impact:** £{potential_buybox_revenue:,.0f}\n\n")
        
        # Prime Opportunities
        non_prime = df[(df['is_prime'] == False) & (df['sales_total'] > 100)]
        prime_potential = non_prime['sales_total'].sum() * 0.15
        f.write(f"### 2. Prime Upgrade Opportunities\n")
        f.write(f"- **High-performing non-Prime products:** {len(non_prime)}\n")
        f.write(f"- **Potential revenue lift:** £{prime_potential:,.0f} (15% improvement)\n\n")
        
        # Category Analysis
        f.write("## Category Performance\n\n")
        category_stats = df.groupby('sku_category').agg({
            'sales_total': 'sum',
            'units_ordered': 'sum',
            'conversion_rate': 'mean'
        }).sort_values('sales_total', ascending=False).head(10)
        
        f.write("| Category | Sales | Units | Avg Conversion |\n")
        f.write("|----------|-------|-------|----------------|\n")
        for category, stats in category_stats.iterrows():
            f.write(f"| {category} | £{stats['sales_total']:,.0f} | {stats['units_ordered']:,} | {stats['conversion_rate']:.1f}% |\n")
    
    print("✅ Detailed insights exported")

def main():
    """Main function"""
    print("🚀 Advanced Business Report Analysis")
    print("=" * 45)
    
    # Load data
    df = load_cleaned_data()
    if df is None:
        return
    
    # Create visualizations
    create_comprehensive_dashboard(df)
    
    # Analyze segments
    segments = analyze_performance_segments(df)
    
    # Create opportunity analysis
    create_opportunity_analysis(df)
    
    # Export insights
    export_detailed_insights(df, segments)
    
    print("\n" + "=" * 45)
    print("✅ Advanced analysis completed!")
    print("📁 Files generated:")
    print("   - BusinessReport-23-07-2025_1_comprehensive_dashboard.png")
    print("   - BusinessReport-23-07-2025_1_opportunities.png")
    print("   - BusinessReport-23-07-2025_1_detailed_insights.md")

if __name__ == "__main__":
    main()
