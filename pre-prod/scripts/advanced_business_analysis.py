#!/usr/bin/env python3
"""
Advanced Business Report Analysis with Visualizations
Provides detailed insights and charts for the Amazon Business Report data.
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
    file_path = "/Users/jackweston/Projects/pre-prod/BusinessReport-23-07-2025_cleaned.csv"
    df = pd.read_csv(file_path)
    return df

def create_performance_dashboard(df):
    """Create a comprehensive performance dashboard"""
    print("📊 Creating performance dashboard...")
    
    # Create a figure with multiple subplots
    fig, axes = plt.subplots(2, 3, figsize=(20, 12))
    fig.suptitle('Amazon Business Report - Performance Dashboard', fontsize=16, fontweight='bold')
    
    # 1. Sales Distribution
    axes[0, 0].hist(df['sales_total'], bins=30, edgecolor='black', alpha=0.7)
    axes[0, 0].set_title('Sales Distribution')
    axes[0, 0].set_xlabel('Sales (£)')
    axes[0, 0].set_ylabel('Frequency')
    axes[0, 0].axvline(df['sales_total'].mean(), color='red', linestyle='--', label=f'Mean: £{df["sales_total"].mean():.2f}')
    axes[0, 0].legend()
    
    # 2. Conversion Rate vs Sales
    scatter = axes[0, 1].scatter(df['conversion_rate'], df['sales_total'], 
                                alpha=0.6, c=df['sessions_total'], cmap='viridis')
    axes[0, 1].set_title('Conversion Rate vs Sales')
    axes[0, 1].set_xlabel('Conversion Rate (%)')
    axes[0, 1].set_ylabel('Sales (£)')
    plt.colorbar(scatter, ax=axes[0, 1], label='Sessions')
    
    # 3. Prime vs Non-Prime Performance
    prime_comparison = df.groupby('is_prime').agg({
        'sales_total': 'sum',
        'units_ordered': 'sum',
        'conversion_rate': 'mean'
    }).reset_index()
    
    prime_labels = ['Non-Prime', 'Prime']
    axes[0, 2].bar(prime_labels, prime_comparison['sales_total'])
    axes[0, 2].set_title('Prime vs Non-Prime Sales')
    axes[0, 2].set_ylabel('Total Sales (£)')
    
    # Add value labels on bars
    for i, v in enumerate(prime_comparison['sales_total']):
        axes[0, 2].text(i, v + 50, f'£{v:.0f}', ha='center', va='bottom')
    
    # 4. Buy Box Win Rate Distribution
    axes[1, 0].hist(df['buy_box_percentage'].dropna(), bins=20, edgecolor='black', alpha=0.7)
    axes[1, 0].set_title('Buy Box Win Rate Distribution')
    axes[1, 0].set_xlabel('Buy Box Win Rate (%)')
    axes[1, 0].set_ylabel('Frequency')
    
    # 5. Top 15 SKU Categories by Sales
    category_sales = df.groupby('sku_category')['sales_total'].sum().sort_values(ascending=False).head(15)
    axes[1, 1].barh(range(len(category_sales)), category_sales.values)
    axes[1, 1].set_yticks(range(len(category_sales)))
    axes[1, 1].set_yticklabels(category_sales.index)
    axes[1, 1].set_title('Top 15 SKU Categories by Sales')
    axes[1, 1].set_xlabel('Sales (£)')
    
    # 6. Sessions vs Revenue Efficiency
    df['revenue_efficiency'] = df['sales_total'] / (df['sessions_total'] + 1)  # +1 to avoid division by zero
    axes[1, 2].scatter(df['sessions_total'], df['revenue_efficiency'], alpha=0.6)
    axes[1, 2].set_title('Sessions vs Revenue Efficiency')
    axes[1, 2].set_xlabel('Total Sessions')
    axes[1, 2].set_ylabel('Revenue per Session (£)')
    
    plt.tight_layout()
    plt.savefig('/Users/jackweston/Projects/pre-prod/business_report_dashboard.png', dpi=300, bbox_inches='tight')
    print("  ✅ Dashboard saved as business_report_dashboard.png")
    plt.show()

def analyze_product_performance_tiers(df):
    """Analyze products by performance tiers"""
    print("\n🎯 Analyzing product performance tiers...")
    
    # Define performance tiers based on sales and conversion
    df['sales_quartile'] = pd.qcut(df['sales_total'], q=4, labels=['Low', 'Medium', 'High', 'Top'])
    df['conversion_quartile'] = pd.qcut(df['conversion_rate'], q=4, labels=['Low', 'Medium', 'High', 'Top'])
    
    # Create performance matrix
    performance_matrix = pd.crosstab(df['sales_quartile'], df['conversion_quartile'], margins=True)
    
    print("📊 Performance Matrix (Sales vs Conversion):")
    print(performance_matrix)
    
    # Identify star performers (High sales + High conversion)
    star_performers = df[(df['sales_quartile'] == 'Top') & (df['conversion_quartile'].isin(['High', 'Top']))]
    
    print(f"\n⭐ Star Performers ({len(star_performers)} products):")
    for _, product in star_performers.iterrows():
        print(f"  • {product['sku']}: £{product['sales_total']:.2f} sales, {product['conversion_rate']:.1f}% conversion")
    
    # Identify underperformers (Low sales + Low conversion)
    underperformers = df[(df['sales_quartile'] == 'Low') & (df['conversion_quartile'] == 'Low')]
    
    print(f"\n⚠️  Underperformers ({len(underperformers)} products):")
    for _, product in underperformers.head(10).iterrows():
        print(f"  • {product['sku']}: £{product['sales_total']:.2f} sales, {product['conversion_rate']:.1f}% conversion")
    
    return star_performers, underperformers

def analyze_buy_box_impact(df):
    """Analyze the impact of buy box ownership"""
    print("\n📦 Analyzing Buy Box impact...")
    
    # Filter out products with no buy box data
    bb_data = df[df['buy_box_percentage'].notna() & (df['buy_box_percentage'] > 0)]
    
    if len(bb_data) == 0:
        print("  ⚠️  No buy box data available for analysis")
        return
    
    # Categorize buy box performance
    bb_data['bb_category'] = pd.cut(bb_data['buy_box_percentage'], 
                                   bins=[0, 25, 50, 75, 100], 
                                   labels=['Low (0-25%)', 'Medium (25-50%)', 'High (50-75%)', 'Dominant (75-100%)'])
    
    bb_impact = bb_data.groupby('bb_category').agg({
        'sales_total': ['mean', 'sum', 'count'],
        'conversion_rate': 'mean',
        'units_ordered': 'sum'
    }).round(2)
    
    print("📊 Buy Box Impact Analysis:")
    print(bb_impact)
    
    # Create visualization
    plt.figure(figsize=(12, 8))
    
    plt.subplot(2, 2, 1)
    bb_sales = bb_data.groupby('bb_category')['sales_total'].mean()
    plt.bar(range(len(bb_sales)), bb_sales.values)
    plt.xticks(range(len(bb_sales)), bb_sales.index, rotation=45)
    plt.title('Average Sales by Buy Box Category')
    plt.ylabel('Average Sales (£)')
    
    plt.subplot(2, 2, 2)
    bb_conversion = bb_data.groupby('bb_category')['conversion_rate'].mean()
    plt.bar(range(len(bb_conversion)), bb_conversion.values)
    plt.xticks(range(len(bb_conversion)), bb_conversion.index, rotation=45)
    plt.title('Average Conversion Rate by Buy Box Category')
    plt.ylabel('Conversion Rate (%)')
    
    plt.subplot(2, 2, 3)
    plt.scatter(bb_data['buy_box_percentage'], bb_data['sales_total'], alpha=0.6)
    plt.xlabel('Buy Box Win Rate (%)')
    plt.ylabel('Sales (£)')
    plt.title('Buy Box Win Rate vs Sales')
    
    plt.subplot(2, 2, 4)
    plt.scatter(bb_data['buy_box_percentage'], bb_data['conversion_rate'], alpha=0.6)
    plt.xlabel('Buy Box Win Rate (%)')
    plt.ylabel('Conversion Rate (%)')
    plt.title('Buy Box Win Rate vs Conversion Rate')
    
    plt.tight_layout()
    plt.savefig('/Users/jackweston/Projects/pre-prod/buy_box_analysis.png', dpi=300, bbox_inches='tight')
    print("  ✅ Buy box analysis saved as buy_box_analysis.png")
    plt.show()

def generate_actionable_insights(df, star_performers, underperformers):
    """Generate actionable business insights"""
    print("\n💡 Generating actionable insights...")
    
    insights = []
    
    # 1. Prime Performance Analysis
    prime_performance = df.groupby('is_prime').agg({
        'sales_total': ['sum', 'mean'],
        'conversion_rate': 'mean',
        'avg_order_value': 'mean'
    }).round(2)
    
    prime_lift = ((prime_performance.loc[True, ('conversion_rate', 'mean')] - 
                  prime_performance.loc[False, ('conversion_rate', 'mean')]) / 
                  prime_performance.loc[False, ('conversion_rate', 'mean')] * 100)
    
    insights.append(f"🚀 Prime products show {prime_lift:.1f}% higher conversion rates")
    
    # 2. Buy Box Opportunities
    no_buybox = df[(df['buy_box_percentage'] == 0) & (df['sessions_total'] > 5)]
    if len(no_buybox) > 0:
        insights.append(f"📦 {len(no_buybox)} products with good traffic but no buy box ownership")
    
    # 3. High Traffic, Low Conversion
    high_traffic_low_conv = df[(df['sessions_total'] > df['sessions_total'].quantile(0.7)) & 
                              (df['conversion_rate'] < df['conversion_rate'].quantile(0.3))]
    if len(high_traffic_low_conv) > 0:
        insights.append(f"⚠️  {len(high_traffic_low_conv)} products have high traffic but low conversion")
    
    # 4. Category Performance
    category_performance = df.groupby('sku_category').agg({
        'sales_total': 'sum',
        'conversion_rate': 'mean',
        'units_ordered': 'sum'
    }).sort_values('sales_total', ascending=False)
    
    top_category = category_performance.index[0]
    insights.append(f"🏆 Top performing category: {top_category} (£{category_performance.loc[top_category, 'sales_total']:.2f})")
    
    # 5. Low AOV opportunities
    low_aov = df[(df['avg_order_value'] < df['avg_order_value'].quantile(0.25)) & 
                 (df['units_ordered'] > 2)]
    if len(low_aov) > 0:
        insights.append(f"💰 {len(low_aov)} products with low AOV but multiple sales - bundle opportunities")
    
    print("\n📋 Key Business Insights:")
    for i, insight in enumerate(insights, 1):
        print(f"  {i}. {insight}")
    
    return insights

def export_summary_report(df, insights, star_performers, underperformers):
    """Export a comprehensive summary report"""
    print("\n📄 Exporting summary report...")
    
    report_date = datetime.now().strftime("%Y-%m-%d %H:%M")
    
    with open('/Users/jackweston/Projects/pre-prod/business_report_summary.md', 'w') as f:
        f.write(f"# Amazon Business Report Analysis Summary\n")
        f.write(f"**Generated:** {report_date}\n\n")
        
        f.write("## 📊 Key Metrics\n")
        f.write(f"- **Total Products:** {len(df)}\n")
        f.write(f"- **Total Sessions:** {df['sessions_total'].sum():,}\n")
        f.write(f"- **Total Sales:** £{df['sales_total'].sum():,.2f}\n")
        f.write(f"- **Total Units Ordered:** {df['units_ordered'].sum():,}\n")
        f.write(f"- **Average Conversion Rate:** {df['conversion_rate'].mean():.2f}%\n")
        f.write(f"- **Average Order Value:** £{df['avg_order_value'].mean():.2f}\n\n")
        
        f.write("## 💡 Key Insights\n")
        for insight in insights:
            f.write(f"- {insight}\n")
        f.write("\n")
        
        f.write("## ⭐ Star Performers (Top Sales + High Conversion)\n")
        f.write("| SKU | Sales | Conversion Rate | Units Ordered |\n")
        f.write("|-----|-------|----------------|---------------|\n")
        for _, product in star_performers.head(10).iterrows():
            f.write(f"| {product['sku']} | £{product['sales_total']:.2f} | {product['conversion_rate']:.1f}% | {product['units_ordered']} |\n")
        f.write("\n")
        
        f.write("## ⚠️ Improvement Opportunities\n")
        f.write("| SKU | Sales | Conversion Rate | Sessions |\n")
        f.write("|-----|-------|----------------|----------|\n")
        for _, product in underperformers.head(10).iterrows():
            f.write(f"| {product['sku']} | £{product['sales_total']:.2f} | {product['conversion_rate']:.1f}% | {product['sessions_total']} |\n")
        f.write("\n")
        
        f.write("## 📈 Prime vs Non-Prime Comparison\n")
        prime_stats = df.groupby('is_prime').agg({
            'sales_total': 'sum',
            'units_ordered': 'sum',
            'conversion_rate': 'mean'
        })
        
        f.write("| Metric | Prime | Non-Prime |\n")
        f.write("|--------|-------|----------|\n")
        f.write(f"| Total Sales | £{prime_stats.loc[True, 'sales_total']:,.2f} | £{prime_stats.loc[False, 'sales_total']:,.2f} |\n")
        f.write(f"| Units Ordered | {prime_stats.loc[True, 'units_ordered']:,} | {prime_stats.loc[False, 'units_ordered']:,} |\n")
        f.write(f"| Avg Conversion Rate | {prime_stats.loc[True, 'conversion_rate']:.2f}% | {prime_stats.loc[False, 'conversion_rate']:.2f}% |\n")
    
    print("  ✅ Summary report saved as business_report_summary.md")

def main():
    """Main function to run advanced analysis"""
    print("🔍 Advanced Amazon Business Report Analysis")
    print("=" * 50)
    
    # Load cleaned data
    df = load_cleaned_data()
    print(f"📊 Loaded {len(df)} products for analysis")
    
    # Create visualizations
    create_performance_dashboard(df)
    
    # Analyze performance tiers
    star_performers, underperformers = analyze_product_performance_tiers(df)
    
    # Analyze buy box impact
    analyze_buy_box_impact(df)
    
    # Generate insights
    insights = generate_actionable_insights(df, star_performers, underperformers)
    
    # Export summary report
    export_summary_report(df, insights, star_performers, underperformers)
    
    print("\n" + "=" * 50)
    print("✅ Advanced analysis completed!")
    print("📁 Files generated:")
    print("   - business_report_dashboard.png")
    print("   - buy_box_analysis.png") 
    print("   - business_report_summary.md")

if __name__ == "__main__":
    main()
