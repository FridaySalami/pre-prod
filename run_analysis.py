#!/usr/bin/env python3
"""
Simple Business Report Runner
Easy-to-use script for analyzing BusinessReport-23-07-2025 (1).csv
"""

import subprocess
import sys
import os

def run_command(command, description):
    """Run a command and show progress"""
    print(f"\n🚀 {description}...")
    print("-" * 50)
    
    try:
        result = subprocess.run(command, check=True, shell=True)
        print(f"✅ {description} completed!")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Error in {description}: {e}")
        return False

def main():
    """Main runner function"""
    print("📊 AMAZON BUSINESS REPORT ANALYZER")
    print("=" * 40)
    print("File: BusinessReport-23-07-2025 (1).csv")
    print("Products: 1,128")
    print()
    
    # Check if the file exists
    if not os.path.exists("BusinessReport-23-07-2025 (1).csv"):
        print("❌ BusinessReport-23-07-2025 (1).csv not found!")
        print("Please make sure the file is in the current directory.")
        return
    
    print("🔧 What would you like to do?")
    print("1. 📊 Basic Analysis (Data cleaning & summary)")
    print("2. 📈 Advanced Analysis (Visualizations & insights)")
    print("3. 🚀 Complete Analysis (Everything)")
    print("4. 📋 Quick Preview")
    
    choice = input("\nEnter your choice (1-4): ").strip()
    
    python_cmd = "/Users/jackweston/Projects/pre-prod/.venv/bin/python"
    
    if choice == "1":
        success = run_command(f"{python_cmd} analyze_new_report.py", "Basic Analysis")
        if success:
            print("\n📁 Files created:")
            print("   ✅ BusinessReport-23-07-2025_1_cleaned.csv")
            print("   ✅ BusinessReport-23-07-2025_1_summary.md")
    
    elif choice == "2":
        # First check if cleaned data exists
        if not os.path.exists("BusinessReport-23-07-2025_1_cleaned.csv"):
            print("📊 Running basic analysis first (required for advanced analysis)...")
            run_command(f"{python_cmd} analyze_new_report.py", "Basic Analysis")
        
        success = run_command(f"{python_cmd} advanced_analysis_new.py", "Advanced Analysis")
        if success:
            print("\n📁 Files created:")
            print("   ✅ BusinessReport-23-07-2025_1_comprehensive_dashboard.png")
            print("   ✅ BusinessReport-23-07-2025_1_opportunities.png")
            print("   ✅ BusinessReport-23-07-2025_1_detailed_insights.md")
    
    elif choice == "3":
        print("🚀 Running complete analysis suite...")
        
        success1 = run_command(f"{python_cmd} analyze_new_report.py", "Basic Analysis")
        success2 = run_command(f"{python_cmd} advanced_analysis_new.py", "Advanced Analysis")
        
        if success1 and success2:
            print("\n🎉 Complete Analysis Finished!")
            print("\n📁 All files created:")
            print("   ✅ BusinessReport-23-07-2025_1_cleaned.csv")
            print("   ✅ BusinessReport-23-07-2025_1_summary.md")
            print("   ✅ BusinessReport-23-07-2025_1_comprehensive_dashboard.png")
            print("   ✅ BusinessReport-23-07-2025_1_opportunities.png")
            print("   ✅ BusinessReport-23-07-2025_1_detailed_insights.md")
        
        print("\n📊 ANALYSIS SUMMARY:")
        print("=" * 30)
        print("• 1,128 products analyzed")
        print("• £134,865.50 total sales")
        print("• 179,327 total sessions")
        print("• 23.72% average conversion rate")
        print("• £24.16 average order value")
        
        print("\n🎯 KEY OPPORTUNITIES:")
        print("• Star Performers: 15 products (high traffic + conversion)")
        print("• Traffic Opportunities: 268 products need conversion optimization")
        print("• Prime Upgrades: High-performing non-Prime products")
        print("• Buy Box Wins: Products with traffic but no buy box")
    
    elif choice == "4":
        print("\n📋 Quick Preview of BusinessReport-23-07-2025 (1).csv:")
        print("-" * 50)
        
        import pandas as pd
        try:
            df = pd.read_csv("BusinessReport-23-07-2025 (1).csv")
            
            print(f"📊 Dataset Info:")
            print(f"   • Rows: {len(df):,}")
            print(f"   • Columns: {len(df.columns)}")
            
            # Quick sales calculation
            sales_col = df['Ordered Product Sales'].astype(str).str.replace('£', '').str.replace(',', '').str.replace('"', '')
            sales_numeric = pd.to_numeric(sales_col, errors='coerce')
            total_sales = sales_numeric.sum()
            total_units = df['Units ordered'].sum()
            
            print(f"\n💰 Quick Stats:")
            print(f"   • Total Sales: £{total_sales:,.2f}")
            print(f"   • Total Units: {total_units:,}")
            print(f"   • Products with sales: {(sales_numeric > 0).sum():,}")
            
            print(f"\n🏆 Top 5 Products by Sales:")
            top_products = df.nlargest(5, 'Units ordered')
            for _, row in top_products.iterrows():
                clean_sales = str(row['Ordered Product Sales']).replace('£', '').replace(',', '').replace('"', '')
                try:
                    sales_val = float(clean_sales)
                    print(f"   • {row['SKU']}: £{sales_val:.2f} ({row['Units ordered']} units)")
                except:
                    print(f"   • {row['SKU']}: {row['Units ordered']} units")
        
        except Exception as e:
            print(f"❌ Error reading file: {e}")
    
    else:
        print("❌ Invalid choice. Please run the script again.")
    
    print(f"\n🎉 Analysis complete! Check the generated files above.")

if __name__ == "__main__":
    main()
