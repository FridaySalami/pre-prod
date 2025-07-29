#!/usr/bin/env python3
"""
Enhanced Traffic vs Conversion Analysis with Advanced Visualizations
Provides multiple presentation formats for better business insights
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

def load_and_clean_data(file_path):
    """Load and clean the business report data"""
    print("🚀 Enhanced Traffic vs Conversion Analysis")
    print("=" * 60)
    
    df = pd.read_csv(file_path)
    print(f"📊 Data loaded: {df.shape[0]} products, {df.shape[1]} columns")
    
    # Clean numeric columns
    df['Sessions – Total'] = df['Sessions – Total'].astype(str).str.replace(',', '').astype(float)
    df['Units ordered'] = df['Units ordered'].astype(float)
    df['Ordered Product Sales'] = df['Ordered Product Sales'].str.replace('£', '').str.replace(',', '').astype(float)
    
    # Calculate metrics
    df['conversion_rate'] = (df['Units ordered'] / df['Sessions – Total'] * 100).round(2)
    df['aov'] = (df['Ordered Product Sales'] / df['Units ordered']).round(2)
    
    # Remove infinite and NaN values
    df = df[df['conversion_rate'].notna() & np.isfinite(df['conversion_rate'])]
    df = df[df['aov'].notna() & np.isfinite(df['aov'])]
    
    return df

def create_traffic_conversion_matrix(df, threshold_percentile=70):
    """Create a 2x2 matrix categorizing products by traffic and conversion"""
    print(f"\n🎯 Creating Traffic-Conversion Performance Matrix")
    
    # Calculate thresholds
    traffic_threshold = df['Sessions – Total'].quantile(threshold_percentile / 100)
    conversion_threshold = df['conversion_rate'].quantile(threshold_percentile / 100)
    
    print(f"   Traffic threshold (top {100-threshold_percentile}%): {traffic_threshold:.0f} sessions")
    print(f"   Conversion threshold (top {100-threshold_percentile}%): {conversion_threshold:.1f}%")
    
    # Categorize products
    def categorize_product(row):
        high_traffic = row['Sessions – Total'] >= traffic_threshold
        high_conversion = row['conversion_rate'] >= conversion_threshold
        
        if high_traffic and high_conversion:
            return "🏆 Stars (High Traffic + High Conversion)"
        elif high_traffic and not high_conversion:
            return "⚠️ Problem Children (High Traffic + Low Conversion)"
        elif not high_traffic and high_conversion:
            return "💎 Hidden Gems (Low Traffic + High Conversion)" 
        else:
            return "🔍 Dogs (Low Traffic + Low Conversion)"
    
    df['category'] = df.apply(categorize_product, axis=1)
    
    # Count products in each category
    category_counts = df['category'].value_counts()
    print(f"\n📈 Product Distribution:")
    for category, count in category_counts.items():
        print(f"   {category}: {count} products")
    
    return df, traffic_threshold, conversion_threshold

def create_performance_dashboard(df):
    """Create comprehensive performance visualizations"""
    print(f"\n📊 Creating Performance Dashboard...")
    
    # Create figure with subplots
    fig = plt.figure(figsize=(20, 16))
    
    # 1. Scatter Plot: Traffic vs Conversion
    ax1 = plt.subplot(2, 3, 1)
    categories = df['category'].unique()
    colors = ['gold', 'red', 'green', 'gray']
    
    for i, category in enumerate(categories):
        category_data = df[df['category'] == category]
        plt.scatter(category_data['Sessions – Total'], 
                   category_data['conversion_rate'],
                   c=colors[i], 
                   alpha=0.6, 
                   label=category.split(' ')[1], 
                   s=50)
    
    plt.xlabel('Sessions (Total Traffic)')
    plt.ylabel('Conversion Rate (%)')
    plt.title('Traffic vs Conversion Rate by Category')
    plt.legend(bbox_to_anchor=(1.05, 1), loc='upper left')
    plt.xscale('log')
    
    # 2. Revenue Impact by Category
    ax2 = plt.subplot(2, 3, 2)
    category_revenue = df.groupby('category')['Ordered Product Sales'].sum()
    category_revenue.plot(kind='bar', color=['gold', 'red', 'green', 'gray'], ax=ax2)
    plt.title('Total Revenue by Category')
    plt.ylabel('Revenue (£)')
    plt.xticks(rotation=45, ha='right')
    
    # 3. Conversion Rate Distribution
    ax3 = plt.subplot(2, 3, 3)
    plt.hist(df['conversion_rate'], bins=50, alpha=0.7, color='skyblue', edgecolor='black')
    plt.axvline(df['conversion_rate'].mean(), color='red', linestyle='--', label=f'Mean: {df["conversion_rate"].mean():.1f}%')
    plt.axvline(df['conversion_rate'].median(), color='orange', linestyle='--', label=f'Median: {df["conversion_rate"].median():.1f}%')
    plt.xlabel('Conversion Rate (%)')
    plt.ylabel('Number of Products')
    plt.title('Conversion Rate Distribution')
    plt.legend()
    
    # 4. Traffic Distribution 
    ax4 = plt.subplot(2, 3, 4)
    plt.hist(df['Sessions – Total'], bins=50, alpha=0.7, color='lightgreen', edgecolor='black')
    plt.axvline(df['Sessions – Total'].mean(), color='red', linestyle='--', label=f'Mean: {df["Sessions – Total"].mean():.0f}')
    plt.axvline(df['Sessions – Total'].median(), color='orange', linestyle='--', label=f'Median: {df["Sessions – Total"].median():.0f}')
    plt.xlabel('Sessions (Total Traffic)')
    plt.ylabel('Number of Products')
    plt.title('Traffic Distribution')
    plt.xscale('log')
    plt.legend()
    
    # 5. AOV vs Conversion Rate
    ax5 = plt.subplot(2, 3, 5)
    plt.scatter(df['conversion_rate'], df['aov'], alpha=0.6, color='purple')
    plt.xlabel('Conversion Rate (%)')
    plt.ylabel('Average Order Value (£)')
    plt.title('AOV vs Conversion Rate')
    
    # 6. Revenue Efficiency (Revenue per Session)
    ax6 = plt.subplot(2, 3, 6)
    df['revenue_per_session'] = df['Ordered Product Sales'] / df['Sessions – Total']
    top_efficient = df.nlargest(20, 'revenue_per_session')
    
    plt.barh(range(len(top_efficient)), top_efficient['revenue_per_session'])
    plt.yticks(range(len(top_efficient)), [f"{sku[:15]}..." for sku in top_efficient['SKU']])
    plt.xlabel('Revenue per Session (£)')
    plt.title('Top 20 Most Efficient Products')
    
    plt.tight_layout()
    plt.savefig('/Users/jackweston/Projects/pre-prod/performance_dashboard.png', dpi=300, bbox_inches='tight')
    print("   ✅ Dashboard saved as performance_dashboard.png")
    
    return fig

def create_category_summary_table(df):
    """Create detailed summary table by category"""
    print(f"\n📋 Creating Category Summary Table...")
    
    summary = df.groupby('category').agg({
        'SKU': 'count',
        'Sessions – Total': ['sum', 'mean', 'median'],
        'Units ordered': ['sum', 'mean'],
        'conversion_rate': ['mean', 'median', 'std'],
        'Ordered Product Sales': ['sum', 'mean'],
        'aov': ['mean', 'median']
    }).round(2)
    
    # Flatten column names
    summary.columns = ['_'.join(col).strip() for col in summary.columns.values]
    summary = summary.rename(columns={
        'SKU_count': 'Product_Count',
        'Sessions – Total_sum': 'Total_Sessions',
        'Sessions – Total_mean': 'Avg_Sessions',
        'Sessions – Total_median': 'Median_Sessions',
        'Units ordered_sum': 'Total_Units',
        'Units ordered_mean': 'Avg_Units',
        'conversion_rate_mean': 'Avg_Conversion_%',
        'conversion_rate_median': 'Median_Conversion_%',
        'conversion_rate_std': 'Conversion_StdDev',
        'Ordered Product Sales_sum': 'Total_Revenue_£',
        'Ordered Product Sales_mean': 'Avg_Revenue_£',
        'aov_mean': 'Avg_AOV_£',
        'aov_median': 'Median_AOV_£'
    })
    
    return summary

def identify_opportunity_products(df, min_sessions=1000):
    """Identify specific opportunity products with actionable insights"""
    print(f"\n🎯 Identifying Opportunity Products (min {min_sessions} sessions)...")
    
    opportunities = df[
        (df['Sessions – Total'] >= min_sessions) & 
        (df['conversion_rate'] < df['conversion_rate'].quantile(0.3))
    ].copy()
    
    if len(opportunities) == 0:
        print(f"   No products found with {min_sessions}+ sessions and low conversion")
        return pd.DataFrame()
    
    # Calculate potential uplift
    target_conversion = df['conversion_rate'].quantile(0.7)  # 70th percentile
    opportunities['potential_additional_units'] = (
        opportunities['Sessions – Total'] * (target_conversion / 100) - 
        opportunities['Units ordered']
    ).round(0)
    
    opportunities['potential_additional_revenue'] = (
        opportunities['potential_additional_units'] * opportunities['aov']
    ).round(2)
    
    # Sort by potential revenue impact
    opportunities = opportunities.sort_values('potential_additional_revenue', ascending=False)
    
    return opportunities[['SKU', 'Title', 'Sessions – Total', 'Units ordered', 
                        'conversion_rate', 'aov', 'Ordered Product Sales',
                        'potential_additional_units', 'potential_additional_revenue']]

def create_executive_summary_report(df, category_summary, opportunities):
    """Create executive summary with key insights"""
    print(f"\n📝 Creating Executive Summary Report...")
    
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    report = f"""
# 🚀 ENHANCED TRAFFIC & CONVERSION ANALYSIS REPORT
**Generated:** {timestamp}
**Products Analyzed:** {len(df):,}

## 📊 EXECUTIVE SUMMARY

### Performance Matrix Overview
{category_summary['Product_Count'].to_string()}

### Key Performance Indicators
- **Average Conversion Rate:** {df['conversion_rate'].mean():.2f}%
- **Median Conversion Rate:** {df['conversion_rate'].median():.2f}%
- **Total Revenue:** £{df['Ordered Product Sales'].sum():,.2f}
- **Total Sessions:** {df['Sessions – Total'].sum():,.0f}
- **Overall Conversion:** {(df['Units ordered'].sum() / df['Sessions – Total'].sum() * 100):.2f}%

## 🏆 CATEGORY PERFORMANCE BREAKDOWN

```
{category_summary.to_string()}
```

## 🎯 TOP OPPORTUNITY PRODUCTS
*High traffic products with conversion improvement potential*

"""
    
    if len(opportunities) > 0:
        report += f"""
| Rank | SKU | Current Conv% | Potential Revenue | Sessions |
|------|-----|---------------|------------------|----------|
"""
        for i, (_, row) in enumerate(opportunities.head(10).iterrows(), 1):
            report += f"| {i} | {row['SKU'][:20]} | {row['conversion_rate']:.1f}% | £{row['potential_additional_revenue']:,.0f} | {row['Sessions – Total']:,.0f} |\n"
    
    report += f"""

## 💡 STRATEGIC RECOMMENDATIONS

### Immediate Actions (Stars - High Traffic + High Conversion)
- **Protect & Scale:** Ensure adequate inventory and consider expanding similar products
- **Learn:** Analyze what makes these products successful for replication

### Priority Focus (Problem Children - High Traffic + Low Conversion)
- **Urgent Investigation:** These represent the biggest immediate revenue opportunity
- **A/B Testing:** Test pricing, descriptions, images, and positioning
- **Customer Research:** Understand barriers to conversion

### Growth Opportunities (Hidden Gems - Low Traffic + High Conversion)
- **Marketing Investment:** Increase visibility through advertising and SEO
- **Cross-Promotion:** Bundle with high-traffic products

### Strategic Review (Dogs - Low Traffic + Low Conversion)
- **Cost Analysis:** Evaluate if these products justify shelf space
- **Repositioning:** Consider niche targeting or discontinuation

## 📈 FINANCIAL IMPACT SUMMARY
- **Total Opportunity Value:** £{opportunities['potential_additional_revenue'].sum():,.2f}
- **Products with 1000+ sessions:** {len(opportunities)}
- **Average uplift potential per product:** £{opportunities['potential_additional_revenue'].mean():,.2f}

---
*Analysis based on Sessions – Total and Units ordered metrics*
"""
    
    # Save report
    with open('/Users/jackweston/Projects/pre-prod/executive_summary_report.md', 'w') as f:
        f.write(report)
    
    print("   ✅ Executive summary saved as executive_summary_report.md")
    
    return report

def main():
    """Main analysis function"""
    file_path = '/Users/jackweston/Projects/pre-prod/BusinessReport-23-07-2025 (3).csv'
    
    # Load and clean data
    df = load_and_clean_data(file_path)
    
    # Create performance matrix
    df, traffic_threshold, conversion_threshold = create_traffic_conversion_matrix(df)
    
    # Create visualizations
    create_performance_dashboard(df)
    
    # Create category summary
    category_summary = create_category_summary_table(df)
    
    # Identify opportunities
    opportunities = identify_opportunity_products(df)
    
    # Create executive report
    executive_report = create_executive_summary_report(df, category_summary, opportunities)
    
    # Display key findings
    print("\n" + "="*80)
    print("🎯 KEY FINDINGS SUMMARY")
    print("="*80)
    
    print(f"📊 Performance Matrix:")
    for category, count in df['category'].value_counts().items():
        total_revenue = df[df['category'] == category]['Ordered Product Sales'].sum()
        print(f"   {category}: {count} products (£{total_revenue:,.0f} revenue)")
    
    if len(opportunities) > 0:
        print(f"\n💰 Top 3 Opportunity Products:")
        for i, (_, row) in enumerate(opportunities.head(3).iterrows(), 1):
            print(f"   {i}. {row['SKU']}: {row['Sessions – Total']:,.0f} sessions, "
                  f"{row['conversion_rate']:.1f}% conversion, "
                  f"£{row['potential_additional_revenue']:,.0f} potential")
    
    print(f"\n✅ Analysis Complete! Files generated:")
    print(f"   📊 performance_dashboard.png")
    print(f"   📝 executive_summary_report.md")
    print(f"   📈 Enhanced insights for strategic decision making")

if __name__ == "__main__":
    main()
