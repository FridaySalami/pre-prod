#!/usr/bin/env python3
"""
Simple CSV Export for Top and Bottom Performers
Exports clean, focused data for business review
"""

import pandas as pd
import numpy as np
from datetime import datetime

def load_and_clean_data(file_path):
    """Load and clean the business report data"""
    print("📊 Loading data for simple export...")
    
    df = pd.read_csv(file_path)
    
    # Clean numeric columns
    df['Sessions – Total'] = df['Sessions – Total'].astype(str).str.replace(',', '').astype(float)
    df['Units ordered'] = df['Units ordered'].astype(float)
    df['Ordered Product Sales'] = df['Ordered Product Sales'].str.replace('£', '').str.replace(',', '').astype(float)
    
    # Calculate metrics
    df['conversion_rate'] = (df['Units ordered'] / df['Sessions – Total'] * 100).round(2)
    df['aov'] = (df['Ordered Product Sales'] / df['Units ordered']).round(2)
    
    # Remove invalid data
    df = df[df['conversion_rate'].notna() & np.isfinite(df['conversion_rate'])]
    df = df[df['aov'].notna() & np.isfinite(df['aov'])]
    
    return df

def categorize_products(df):
    """Categorize products into performance matrix"""
    traffic_threshold = df['Sessions – Total'].quantile(0.7)  # Top 30%
    conversion_threshold = df['conversion_rate'].quantile(0.7)  # Top 30%
    
    def get_category(row):
        high_traffic = row['Sessions – Total'] >= traffic_threshold
        high_conversion = row['conversion_rate'] >= conversion_threshold
        
        if high_traffic and high_conversion:
            return "Stars"
        elif high_traffic and not high_conversion:
            return "Problem Children"
        elif not high_traffic and high_conversion:
            return "Hidden Gems"
        else:
            return "Dogs"
    
    df['category'] = df.apply(get_category, axis=1)
    return df

def create_simple_exports(df):
    """Create simple CSV exports for each category"""
    print("📁 Creating simple CSV exports...")
    
    # Define columns for simple export
    export_columns = [
        'SKU', 
        'Title', 
        'Sessions – Total', 
        'Units ordered', 
        'conversion_rate', 
        'Ordered Product Sales', 
        'aov'
    ]
    
    # Rename columns for clarity
    column_mapping = {
        'Sessions – Total': 'Sessions',
        'Units ordered': 'Units',
        'conversion_rate': 'Conversion_%',
        'Ordered Product Sales': 'Revenue_£',
        'aov': 'AOV_£'
    }
    
    # Export top performers (Stars)
    stars = df[df['category'] == 'Stars'].copy()
    stars_export = stars[export_columns].rename(columns=column_mapping)
    stars_export = stars_export.sort_values('Conversion_%', ascending=False)
    stars_export.to_csv('/Users/jackweston/Projects/pre-prod/top_performers_stars.csv', index=False)
    print(f"   ✅ top_performers_stars.csv ({len(stars_export)} products)")
    
    # Export problem children (high traffic, low conversion)
    problems = df[df['category'] == 'Problem Children'].copy()
    problems_export = problems[export_columns].rename(columns=column_mapping)
    problems_export = problems_export.sort_values('Sessions', ascending=False)
    problems_export.to_csv('/Users/jackweston/Projects/pre-prod/bottom_performers_problem_children.csv', index=False)
    print(f"   ✅ bottom_performers_problem_children.csv ({len(problems_export)} products)")
    
    # Export hidden gems (low traffic, high conversion)
    gems = df[df['category'] == 'Hidden Gems'].copy()
    gems_export = gems[export_columns].rename(columns=column_mapping)
    gems_export = gems_export.sort_values('Conversion_%', ascending=False)
    gems_export.to_csv('/Users/jackweston/Projects/pre-prod/hidden_gems_high_conversion.csv', index=False)
    print(f"   ✅ hidden_gems_high_conversion.csv ({len(gems_export)} products)")
    
    # Create summary overview
    create_summary_overview(df)
    
    return {
        'stars': stars_export,
        'problems': problems_export,
        'gems': gems_export
    }

def create_summary_overview(df):
    """Create a simple summary CSV"""
    print("📋 Creating summary overview...")
    
    summary_data = []
    
    for category in ['Stars', 'Problem Children', 'Hidden Gems', 'Dogs']:
        cat_data = df[df['category'] == category]
        
        summary_data.append({
            'Category': category,
            'Product_Count': len(cat_data),
            'Total_Sessions': int(cat_data['Sessions – Total'].sum()),
            'Avg_Sessions': round(cat_data['Sessions – Total'].mean(), 0),
            'Total_Units': int(cat_data['Units ordered'].sum()),
            'Avg_Conversion_%': round(cat_data['conversion_rate'].mean(), 1),
            'Total_Revenue_£': round(cat_data['Ordered Product Sales'].sum(), 2),
            'Avg_AOV_£': round(cat_data['aov'].mean(), 2)
        })
    
    summary_df = pd.DataFrame(summary_data)
    summary_df.to_csv('/Users/jackweston/Projects/pre-prod/category_summary_overview.csv', index=False)
    print(f"   ✅ category_summary_overview.csv")
    
    return summary_df

def create_top_opportunities_csv(df):
    """Create a simple CSV of top opportunity products"""
    print("🎯 Creating top opportunities CSV...")
    
    # Focus on Problem Children with highest traffic
    opportunities = df[
        (df['category'] == 'Problem Children') & 
        (df['Sessions – Total'] >= 1000)
    ].copy()
    
    if len(opportunities) == 0:
        print("   No high-traffic opportunity products found")
        return pd.DataFrame()
    
    # Calculate potential uplift
    target_conversion = df[df['category'] == 'Stars']['conversion_rate'].median()
    opportunities['potential_units'] = (opportunities['Sessions – Total'] * target_conversion / 100).round(0)
    opportunities['potential_revenue_uplift'] = (
        (opportunities['potential_units'] - opportunities['Units ordered']) * 
        opportunities['aov']
    ).round(2)
    
    # Select and rename columns
    opp_export = opportunities[[
        'SKU', 'Title', 'Sessions – Total', 'Units ordered', 'conversion_rate', 
        'Ordered Product Sales', 'potential_revenue_uplift'
    ]].rename(columns={
        'Sessions – Total': 'Sessions',
        'Units ordered': 'Current_Units',
        'conversion_rate': 'Current_Conversion_%',
        'Ordered Product Sales': 'Current_Revenue_£',
        'potential_revenue_uplift': 'Revenue_Opportunity_£'
    })
    
    opp_export = opp_export.sort_values('Revenue_Opportunity_£', ascending=False)
    opp_export.to_csv('/Users/jackweston/Projects/pre-prod/top_opportunities_simple.csv', index=False)
    print(f"   ✅ top_opportunities_simple.csv ({len(opp_export)} products)")
    
    return opp_export

def main():
    """Main function"""
    file_path = '/Users/jackweston/Projects/pre-prod/BusinessReport-23-07-2025 (3).csv'
    
    # Load and process data
    df = load_and_clean_data(file_path)
    df = categorize_products(df)
    
    # Create exports
    exports = create_simple_exports(df)
    opportunities = create_top_opportunities_csv(df)
    
    print("\n" + "="*60)
    print("📁 SIMPLE CSV EXPORTS CREATED")
    print("="*60)
    print("✅ Files generated:")
    print("   📊 top_performers_stars.csv")
    print("   ⚠️  bottom_performers_problem_children.csv") 
    print("   💎 hidden_gems_high_conversion.csv")
    print("   📋 category_summary_overview.csv")
    print("   🎯 top_opportunities_simple.csv")
    
    # Display quick preview
    print(f"\n📈 Quick Summary:")
    for category in ['Stars', 'Problem Children', 'Hidden Gems', 'Dogs']:
        count = len(df[df['category'] == category])
        revenue = df[df['category'] == category]['Ordered Product Sales'].sum()
        print(f"   {category}: {count} products, £{revenue:,.0f} revenue")

if __name__ == "__main__":
    main()
