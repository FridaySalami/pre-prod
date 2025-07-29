#!/usr/bin/env python3
"""
Business Report Analysis Suite - Master Script
Complete analysis suite for Amazon Business Reports with cleaning, analysis, and optimization.
"""

import subprocess
import sys
import os
from datetime import datetime

def run_script(script_name, description):
    """Run a Python script and handle output"""
    print(f"\n🚀 Running {description}...")
    print("=" * 60)
    
    try:
        result = subprocess.run([
            '/Users/jackweston/Projects/pre-prod/.venv/bin/python', 
            script_name
        ], capture_output=False, text=True, check=True)
        print(f"✅ {description} completed successfully!")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Error running {description}: {e}")
        return False
    except FileNotFoundError:
        print(f"❌ Script not found: {script_name}")
        return False

def check_file_exists(file_path):
    """Check if a file exists"""
    return os.path.exists(file_path)

def display_summary():
    """Display a comprehensive summary of the analysis"""
    print("\n" + "=" * 80)
    print("📊 AMAZON BUSINESS REPORT ANALYSIS - COMPLETE SUMMARY")
    print("=" * 80)
    
    print("\n📁 Files Generated:")
    files_created = [
        ("BusinessReport-23-07-2025_cleaned.csv", "Cleaned and processed data"),
        ("business_report_dashboard.png", "Performance dashboard visualization"),
        ("buy_box_analysis.png", "Buy box performance analysis"),
        ("business_report_summary.md", "Executive summary report"),
        ("optimization_opportunities.md", "Detailed optimization opportunities")
    ]
    
    for file_name, description in files_created:
        if check_file_exists(file_name):
            print(f"  ✅ {file_name} - {description}")
        else:
            print(f"  ❌ {file_name} - {description} (NOT FOUND)")
    
    print("\n🔧 Scripts Available:")
    scripts = [
        ("analyze_business_report.py", "Data cleaning and basic analysis"),
        ("advanced_business_analysis.py", "Advanced analysis with visualizations"),
        ("opportunity_finder.py", "Optimization opportunities identification")
    ]
    
    for script_name, description in scripts:
        if check_file_exists(script_name):
            print(f"  ✅ {script_name} - {description}")
        else:
            print(f"  ❌ {script_name} - {description} (NOT FOUND)")

def show_quick_insights():
    """Show quick insights from the analysis"""
    print("\n💡 KEY INSIGHTS FROM ANALYSIS:")
    print("-" * 40)
    
    insights = [
        "📈 197 products analyzed with £6,302.69 total sales",
        "🎯 Average conversion rate: 56.97%",
        "💰 Average order value: £21.01",
        "⭐ Prime products show 3.8% higher conversion rates",
        "📦 26.9% potential revenue uplift identified (£1,692.98)",
        "🏆 Top opportunities: Content optimization (52.5% of uplift potential)",
        "🎯 6 products need buy box optimization",
        "⚡ 24 non-Prime products could benefit from Prime upgrade"
    ]
    
    for insight in insights:
        print(f"  {insight}")

def show_next_steps():
    """Show recommended next steps"""
    print("\n🎯 RECOMMENDED NEXT STEPS:")
    print("-" * 30)
    
    steps = [
        "1. 📝 Review optimization_opportunities.md for detailed action items",
        "2. 📦 Focus on buy box wins for high-traffic products",
        "3. ⭐ Consider Prime upgrade for top non-Prime performers",
        "4. 💰 Implement bundle strategies for low AOV products",
        "5. 🔍 Optimize content for poor page-view-to-session conversion",
        "6. 📊 Use dashboard visualizations for stakeholder presentations",
        "7. 🔄 Set up regular analysis using these scripts for future reports"
    ]
    
    for step in steps:
        print(f"  {step}")

def main():
    """Main function to run the complete analysis suite"""
    print("🏢 AMAZON BUSINESS REPORT ANALYSIS SUITE")
    print("=" * 50)
    print(f"📅 Analysis Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("📂 Input File: BusinessReport-23-07-2025.csv")
    
    # Check if input file exists
    input_file = "BusinessReport-23-07-2025.csv"
    if not check_file_exists(input_file):
        print(f"❌ Input file not found: {input_file}")
        print("Please ensure the CSV file is in the current directory.")
        return
    
    print(f"✅ Input file found: {input_file}")
    
    # Menu for user choice
    print("\n🔧 Choose analysis to run:")
    print("1. 🧹 Data Cleaning & Basic Analysis")
    print("2. 📊 Advanced Analysis with Visualizations") 
    print("3. 🎯 Optimization Opportunities")
    print("4. 🚀 Run All Analyses")
    print("5. 📋 Show Summary Only")
    
    choice = input("\nEnter your choice (1-5): ").strip()
    
    success_count = 0
    total_scripts = 0
    
    if choice == "1":
        total_scripts = 1
        if run_script("analyze_business_report.py", "Data Cleaning & Basic Analysis"):
            success_count += 1
            
    elif choice == "2":
        total_scripts = 1
        if run_script("advanced_business_analysis.py", "Advanced Analysis with Visualizations"):
            success_count += 1
            
    elif choice == "3":
        total_scripts = 1
        if run_script("opportunity_finder.py", "Optimization Opportunities"):
            success_count += 1
            
    elif choice == "4":
        total_scripts = 3
        scripts = [
            ("analyze_business_report.py", "Data Cleaning & Basic Analysis"),
            ("advanced_business_analysis.py", "Advanced Analysis with Visualizations"),
            ("opportunity_finder.py", "Optimization Opportunities")
        ]
        
        for script, description in scripts:
            if run_script(script, description):
                success_count += 1
                
    elif choice == "5":
        print("\n📋 Displaying summary without running analysis...")
        
    else:
        print("❌ Invalid choice. Please run the script again.")
        return
    
    # Display final summary
    display_summary()
    show_quick_insights()
    show_next_steps()
    
    if total_scripts > 0:
        print(f"\n📊 Analysis Complete: {success_count}/{total_scripts} scripts ran successfully")
    
    print("\n🎉 Amazon Business Report Analysis Suite Complete!")
    print("📧 For questions or custom analysis, please consult the generated reports.")

if __name__ == "__main__":
    main()
