#!/usr/bin/env python3
"""
Business Report Optimization Opportunities Finder
Identifies specific actionable opportunities for improving Amazon performance.
"""

import pandas as pd
import numpy as np

def load_cleaned_data():
    """Load the cleaned data"""
    file_path = "/Users/jackweston/Projects/pre-prod/BusinessReport-23-07-2025_cleaned.csv"
    return pd.read_csv(file_path)

def find_buy_box_opportunities(df):
    """Find products that could benefit from better buy box strategy"""
    print("🎯 Buy Box Optimization Opportunities")
    print("=" * 45)
    
    # Products with no buy box but good traffic
    no_buybox_traffic = df[
        (df['buy_box_percentage'] == 0) & 
        (df['sessions_total'] >= 5) & 
        (df['sales_total'] > 0)
    ].sort_values('sessions_total', ascending=False)
    
    print(f"📦 Products with NO buy box but good traffic ({len(no_buybox_traffic)}):")
    for _, product in no_buybox_traffic.head(10).iterrows():
        potential_lift = product['sessions_total'] * 0.1  # Assume 10% conversion if buy box won
        print(f"  • {product['sku']}: {product['sessions_total']} sessions, potential +{potential_lift:.0f} units")
    
    # Products with partial buy box that could be improved
    partial_buybox = df[
        (df['buy_box_percentage'] > 0) & 
        (df['buy_box_percentage'] < 80) & 
        (df['sessions_total'] >= 10)
    ].sort_values('sessions_total', ascending=False)
    
    print(f"\n📈 Products with partial buy box to improve ({len(partial_buybox)}):")
    for _, product in partial_buybox.head(10).iterrows():
        current_rate = product['buy_box_percentage']
        improvement_potential = (80 - current_rate) / 100 * product['sessions_total'] * 0.05
        print(f"  • {product['sku']}: {current_rate:.1f}% buy box, +{improvement_potential:.1f} potential units")

def find_pricing_opportunities(df):
    """Find pricing optimization opportunities"""
    print("\n💰 Pricing Optimization Opportunities")
    print("=" * 40)
    
    # High traffic, low conversion (pricing issue?)
    pricing_issues = df[
        (df['sessions_total'] >= df['sessions_total'].quantile(0.6)) &
        (df['conversion_rate'] <= df['conversion_rate'].quantile(0.4)) &
        (df['buy_box_percentage'] >= 50)
    ].sort_values('sessions_total', ascending=False)
    
    print(f"🔍 High traffic, low conversion - potential pricing issues ({len(pricing_issues)}):")
    for _, product in pricing_issues.head(10).iterrows():
        avg_aov = product['avg_order_value']
        sessions = product['sessions_total']
        conversion = product['conversion_rate']
        print(f"  • {product['sku']}: {sessions} sessions, {conversion:.1f}% conversion, £{avg_aov:.2f} AOV")
    
    # Low AOV products with multiple sales (bundle opportunities)
    bundle_opportunities = df[
        (df['avg_order_value'] <= df['avg_order_value'].quantile(0.3)) &
        (df['units_ordered'] >= 2) &
        (df['conversion_rate'] >= 20)
    ].sort_values('units_ordered', ascending=False)
    
    print(f"\n📦 Bundle/Upsell opportunities - low AOV, multiple sales ({len(bundle_opportunities)}):")
    for _, product in bundle_opportunities.head(10).iterrows():
        potential_increase = product['avg_order_value'] * 1.3  # 30% AOV increase
        revenue_lift = (potential_increase - product['avg_order_value']) * product['units_ordered']
        print(f"  • {product['sku']}: £{product['avg_order_value']:.2f} AOV, {product['units_ordered']} units, +£{revenue_lift:.2f} potential")

def find_content_opportunities(df):
    """Find content/listing optimization opportunities"""
    print("\n📝 Content Optimization Opportunities")
    print("=" * 38)
    
    # High page views but low sessions (poor listing conversion)
    content_issues = df[
        (df['page_views_total'] >= 10) &
        (df['sessions_total'] < df['page_views_total'] * 0.7)  # Less than 70% page view to session conversion
    ].sort_values('page_views_total', ascending=False)
    
    content_issues['pv_to_session_rate'] = content_issues['sessions_total'] / content_issues['page_views_total'] * 100
    
    print(f"👁️  Poor page view to session conversion ({len(content_issues)}):")
    for _, product in content_issues.head(10).iterrows():
        pv_rate = product['pv_to_session_rate']
        page_views = product['page_views_total']
        sessions = product['sessions_total']
        print(f"  • {product['sku']}: {page_views} page views → {sessions} sessions ({pv_rate:.1f}%)")

def find_prime_opportunities(df):
    """Find Prime optimization opportunities"""
    print("\n⭐ Prime Optimization Opportunities")
    print("=" * 35)
    
    # Non-Prime products with good performance
    non_prime_performers = df[
        (df['is_prime'] == False) &
        (df['sales_total'] >= df['sales_total'].quantile(0.6)) &
        (df['conversion_rate'] >= df['conversion_rate'].quantile(0.5))
    ].sort_values('sales_total', ascending=False)
    
    print(f"🚀 Non-Prime products that could benefit from Prime ({len(non_prime_performers)}):")
    for _, product in non_prime_performers.head(10).iterrows():
        # Estimate Prime impact based on average lift
        prime_lift_estimate = product['conversion_rate'] * 1.15  # 15% lift
        additional_units = (prime_lift_estimate - product['conversion_rate']) / 100 * product['sessions_total']
        revenue_impact = additional_units * product['avg_order_value']
        print(f"  • {product['sku']}: £{product['sales_total']:.2f} sales, +£{revenue_impact:.2f} potential with Prime")

def find_category_opportunities(df):
    """Find category-specific opportunities"""
    print("\n🏷️  Category-Specific Opportunities")
    print("=" * 32)
    
    # Category performance analysis
    category_stats = df.groupby('sku_category').agg({
        'sales_total': ['sum', 'mean', 'count'],
        'conversion_rate': 'mean',
        'buy_box_percentage': 'mean',
        'is_prime': 'mean'
    }).round(2)
    
    # Find categories with low Prime adoption
    low_prime_categories = category_stats[
        (category_stats[('is_prime', 'mean')] < 0.5) &
        (category_stats[('sales_total', 'count')] >= 2)
    ].sort_values(('sales_total', 'sum'), ascending=False)
    
    print(f"📊 Categories with low Prime adoption ({len(low_prime_categories)}):")
    for category in low_prime_categories.head(10).index:
        prime_rate = category_stats.loc[category, ('is_prime', 'mean')] * 100
        total_sales = category_stats.loc[category, ('sales_total', 'sum')]
        product_count = category_stats.loc[category, ('sales_total', 'count')]
        print(f"  • {category}: {prime_rate:.0f}% Prime, £{total_sales:.2f} sales, {product_count} products")
    
    # Find categories with low buy box performance
    low_bb_categories = category_stats[
        (category_stats[('buy_box_percentage', 'mean')] < 70) &
        (category_stats[('sales_total', 'count')] >= 2)
    ].sort_values(('sales_total', 'sum'), ascending=False)
    
    print(f"\n📦 Categories with low buy box performance ({len(low_bb_categories)}):")
    for category in low_bb_categories.head(10).index:
        bb_rate = category_stats.loc[category, ('buy_box_percentage', 'mean')]
        total_sales = category_stats.loc[category, ('sales_total', 'sum')]
        product_count = category_stats.loc[category, ('sales_total', 'count')]
        print(f"  • {category}: {bb_rate:.1f}% avg buy box, £{total_sales:.2f} sales, {product_count} products")

def calculate_opportunity_value(df):
    """Calculate the total opportunity value"""
    print("\n💎 Total Opportunity Value Estimation")
    print("=" * 35)
    
    opportunities = {}
    
    # Buy box opportunities
    no_buybox = df[(df['buy_box_percentage'] == 0) & (df['sessions_total'] >= 5)]
    buybox_opportunity = (no_buybox['sessions_total'] * 0.1 * no_buybox['avg_order_value']).sum()
    opportunities['Buy Box Wins'] = buybox_opportunity
    
    # Prime opportunities
    non_prime_good = df[(df['is_prime'] == False) & (df['sales_total'] >= df['sales_total'].quantile(0.5))]
    prime_opportunity = (non_prime_good['sales_total'] * 0.15).sum()  # 15% lift
    opportunities['Prime Upgrades'] = prime_opportunity
    
    # Pricing opportunities (bundle/upsell)
    bundle_ops = df[(df['avg_order_value'] <= df['avg_order_value'].quantile(0.3)) & (df['units_ordered'] >= 2)]
    bundle_opportunity = (bundle_ops['sales_total'] * 0.3).sum()  # 30% AOV increase
    opportunities['Bundle/Upsell'] = bundle_opportunity
    
    # Content optimization
    content_ops = df[(df['page_views_total'] >= 10) & (df['sessions_total'] < df['page_views_total'] * 0.7)]
    content_opportunity = (content_ops['page_views_total'] * 0.2 * content_ops['avg_order_value']).sum()
    opportunities['Content Optimization'] = content_opportunity
    
    total_opportunity = sum(opportunities.values())
    
    print("📊 Estimated Revenue Opportunities:")
    for category, value in opportunities.items():
        percentage = (value / total_opportunity * 100) if total_opportunity > 0 else 0
        print(f"  • {category}: £{value:,.2f} ({percentage:.1f}%)")
    
    print(f"\n🎯 Total Estimated Opportunity: £{total_opportunity:,.2f}")
    print(f"📈 Current Total Sales: £{df['sales_total'].sum():,.2f}")
    print(f"🚀 Potential Uplift: {(total_opportunity / df['sales_total'].sum() * 100):.1f}%")

def export_opportunities_report(df):
    """Export detailed opportunities report"""
    print("\n📄 Exporting opportunities report...")
    
    with open('/Users/jackweston/Projects/pre-prod/optimization_opportunities.md', 'w') as f:
        f.write("# Amazon Business Report - Optimization Opportunities\n\n")
        
        # Buy Box Opportunities
        f.write("## 🎯 Buy Box Optimization\n\n")
        no_buybox = df[(df['buy_box_percentage'] == 0) & (df['sessions_total'] >= 5)].head(15)
        f.write("### Products with No Buy Box (High Priority)\n")
        f.write("| SKU | Sessions | Current Sales | Potential Units |\n")
        f.write("|-----|----------|---------------|----------------|\n")
        for _, product in no_buybox.iterrows():
            potential = product['sessions_total'] * 0.1
            f.write(f"| {product['sku']} | {product['sessions_total']} | £{product['sales_total']:.2f} | +{potential:.0f} |\n")
        
        # Prime Opportunities
        f.write("\n## ⭐ Prime Optimization\n\n")
        non_prime = df[(df['is_prime'] == False) & (df['sales_total'] >= df['sales_total'].quantile(0.6))].head(15)
        f.write("### Non-Prime High Performers\n")
        f.write("| SKU | Current Sales | Estimated Prime Lift |\n")
        f.write("|-----|---------------|----------------------|\n")
        for _, product in non_prime.iterrows():
            lift = product['sales_total'] * 0.15
            f.write(f"| {product['sku']} | £{product['sales_total']:.2f} | +£{lift:.2f} |\n")
        
        # Pricing Opportunities
        f.write("\n## 💰 Pricing/Bundle Opportunities\n\n")
        bundle_ops = df[(df['avg_order_value'] <= df['avg_order_value'].quantile(0.3)) & (df['units_ordered'] >= 2)].head(15)
        f.write("### Low AOV Bundle Opportunities\n")
        f.write("| SKU | Current AOV | Units Sold | Bundle Potential |\n")
        f.write("|-----|-------------|------------|------------------|\n")
        for _, product in bundle_ops.iterrows():
            potential = product['avg_order_value'] * 0.3 * product['units_ordered']
            f.write(f"| {product['sku']} | £{product['avg_order_value']:.2f} | {product['units_ordered']} | +£{potential:.2f} |\n")
    
    print("  ✅ Opportunities report saved as optimization_opportunities.md")

def main():
    """Main function to find optimization opportunities"""
    print("🔍 Amazon Business Report - Optimization Opportunities Finder")
    print("=" * 65)
    
    # Load data
    df = load_cleaned_data()
    
    # Find different types of opportunities
    find_buy_box_opportunities(df)
    find_pricing_opportunities(df)
    find_content_opportunities(df)
    find_prime_opportunities(df)
    find_category_opportunities(df)
    
    # Calculate total opportunity value
    calculate_opportunity_value(df)
    
    # Export detailed report
    export_opportunities_report(df)
    
    print("\n" + "=" * 65)
    print("✅ Opportunity analysis completed!")
    print("📁 Report saved as: optimization_opportunities.md")

if __name__ == "__main__":
    main()
