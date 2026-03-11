# Amazon Business Report Analysis Suite

A comprehensive Python toolkit for analyzing Amazon Business Reports with data cleaning, visualizations, and optimization insights.

## 📊 Quick Start

### For the new dataset: `BusinessReport-23-07-2025 (1).csv`

**Option 1: Use the simple runner (Recommended)**
```bash
python run_analysis.py
```

**Option 2: Run individual scripts**
```bash
# Basic analysis (required first)
python analyze_new_report.py

# Advanced analysis with visualizations
python advanced_analysis_new.py
```

### For the original dataset: `BusinessReport-23-07-2025.csv`

```bash
# Use the comprehensive suite
python business_report_suite.py
```

## 📁 Generated Files

### For BusinessReport-23-07-2025 (1).csv:
- `BusinessReport-23-07-2025_1_cleaned.csv` - Cleaned and processed data
- `BusinessReport-23-07-2025_1_summary.md` - Executive summary report
- `BusinessReport-23-07-2025_1_comprehensive_dashboard.png` - Performance dashboard
- `BusinessReport-23-07-2025_1_opportunities.png` - Optimization opportunities
- `BusinessReport-23-07-2025_1_detailed_insights.md` - Detailed analysis report

### For BusinessReport-23-07-2025.csv:
- `BusinessReport-23-07-2025_cleaned.csv` - Cleaned data
- `business_report_dashboard.png` - Performance visualizations
- `buy_box_analysis.png` - Buy box performance charts
- `business_report_summary.md` - Summary report
- `optimization_opportunities.md` - Detailed opportunities

## 🎯 Key Insights from Latest Analysis

### Dataset: 1,128 Products
- **Total Revenue:** £134,865.50
- **Total Sessions:** 179,327
- **Average Conversion Rate:** 23.72%
- **Average Order Value:** £24.16

### Performance Segments
1. **Star Performers** (15 products): High traffic + high conversion
2. **Traffic Opportunities** (268 products): High traffic, low conversion
3. **Conversion Stars** (268 products): Low traffic, high conversion  
4. **Question Marks** (577 products): Low traffic, low conversion

### Top Optimization Opportunities
1. **High Traffic, Low Conversion**: 5 products with massive traffic but 0% conversion
2. **Buy Box Wins**: Products with good traffic but no buy box ownership
3. **Prime Upgrades**: High-performing non-Prime products
4. **Bundle Opportunities**: Low AOV products with multiple sales

## 🛠 Requirements

- Python 3.9+
- pandas
- numpy
- matplotlib
- seaborn

## 📋 Scripts Overview

| Script | Purpose | Dataset |
|--------|---------|---------|
| `run_analysis.py` | Simple runner for new dataset | BusinessReport-23-07-2025 (1).csv |
| `analyze_new_report.py` | Basic analysis for new dataset | BusinessReport-23-07-2025 (1).csv |
| `advanced_analysis_new.py` | Advanced visualizations for new dataset | BusinessReport-23-07-2025 (1).csv |
| `business_report_suite.py` | Complete suite for original dataset | BusinessReport-23-07-2025.csv |
| `analyze_business_report.py` | Basic analysis for original dataset | BusinessReport-23-07-2025.csv |
| `advanced_business_analysis.py` | Advanced analysis for original dataset | BusinessReport-23-07-2025.csv |
| `opportunity_finder.py` | Opportunity analysis for original dataset | BusinessReport-23-07-2025.csv |

## 🚀 Features

### Data Cleaning
- Standardizes column names
- Cleans percentage and currency columns
- Handles missing values and data type conversions
- Extracts Prime status and SKU categories

### Metrics Calculation
- Conversion rates
- Average order values
- Revenue per session
- Performance categorization

### Visualizations
- Sales distribution analysis
- Performance quadrant analysis
- Buy box impact assessment
- Category performance comparison
- Prime vs non-Prime analysis

### Optimization Insights
- Buy box opportunities
- Prime upgrade candidates
- High traffic, low conversion products
- Bundle/upsell opportunities
- Category-specific recommendations

## 📈 How to Interpret Results

### Performance Quadrants
- **Stars**: High traffic + high conversion (focus on scaling)
- **Traffic Opportunities**: High traffic + low conversion (optimize pricing/content)
- **Conversion Stars**: Low traffic + high conversion (increase marketing)
- **Question Marks**: Low traffic + low conversion (evaluate or discontinue)

### Key Metrics to Monitor
- **Conversion Rate**: Units ordered ÷ Sessions
- **Average Order Value**: Sales ÷ Units ordered
- **Revenue per Session**: Sales ÷ Sessions
- **Buy Box Win Rate**: Percentage of time winning buy box

## 💡 Quick Tips

1. **Start with the simple runner**: `python run_analysis.py`
2. **Focus on Star Performers**: Scale what's working
3. **Fix Traffic Opportunities**: Biggest potential impact
4. **Consider Prime upgrades**: For high-performing non-Prime products
5. **Monitor buy box**: Critical for visibility and sales

## 🆘 Troubleshooting

If you get errors:
1. Make sure the CSV file is in the same directory
2. Check that Python virtual environment is activated
3. Ensure all required packages are installed
4. For data type errors, check for special characters in the CSV

---

**Need help?** Check the generated markdown reports for detailed insights and recommendations.
