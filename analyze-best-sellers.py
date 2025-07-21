import csv
import re

def parse_currency(value):
    """Parse currency values like £1,234.56 to float"""
    if not value or value.strip() == '':
        return 0.0
    # Remove £ symbol and commas
    cleaned = re.sub(r'[£,]', '', str(value).strip())
    try:
        return float(cleaned)
    except:
        return 0.0

def parse_number(value):
    """Parse numbers with commas like 1,234 to int"""
    if not value or value.strip() == '':
        return 0
    # Remove commas
    cleaned = re.sub(r'[,]', '', str(value).strip())
    try:
        return int(cleaned)
    except:
        return 0

# Read and analyze the CSV
csv_file = "/Users/jackweston/Projects/pre-prod/BusinessReport-16-07-2025 (2).csv"
products = []

with open(csv_file, 'r', encoding='utf-8') as file:
    reader = csv.DictReader(file)
    
    for row in reader:
        parent_asin = row.get('(Parent) ASIN', '').strip()
        child_asin = row.get('(Child) ASIN', '').strip()
        sku = row.get('SKU', '').strip()
        title = row.get('Title', '').strip()
        
        # Parse sales metrics
        units_ordered = parse_number(row.get('Units ordered', '0'))
        units_ordered_b2b = parse_number(row.get('Units ordered – B2B', '0'))
        total_units = units_ordered + units_ordered_b2b
        
        sales_value = parse_currency(row.get('Ordered Product Sales', '£0'))
        sales_value_b2b = parse_currency(row.get('Ordered product sales – B2B', '£0'))
        total_sales = sales_value + sales_value_b2b
        
        sessions_total = parse_number(row.get('Sessions – Total', '0'))
        sessions_b2b = parse_number(row.get('Sessions – Total – B2B', '0'))
        total_sessions = sessions_total + sessions_b2b
        
        # Skip empty rows
        if not sku or not child_asin:
            continue
            
        products.append({
            'parent_asin': parent_asin,
            'child_asin': child_asin,
            'sku': sku,
            'title': title,
            'units_ordered': total_units,
            'sales_value': total_sales,
            'sessions': total_sessions,
            'conversion_rate': (total_units / total_sessions * 100) if total_sessions > 0 else 0
        })

# Sort by total sales value (primary) and units ordered (secondary)
products.sort(key=lambda x: (x['sales_value'], x['units_ordered']), reverse=True)

print(f"📊 BUSINESS REPORT ANALYSIS")
print(f"📅 Report Date: 16-07-2025")
print(f"📦 Total Products: {len(products)}")
print(f"💰 Total Sales Value: £{sum(p['sales_value'] for p in products):,.2f}")
print(f"📈 Total Units Sold: {sum(p['units_ordered'] for p in products):,}")
print("\n" + "="*80)

print(f"\n🏆 TOP 100 BEST SELLERS (by Sales Value)\n")
print(f"{'Rank':<4} {'ASIN':<12} {'SKU':<25} {'Sales':<12} {'Units':<8} {'Title':<30}")
print("-" * 95)

top_100 = products[:100]
for i, product in enumerate(top_100, 1):
    title_short = product['title'][:27] + "..." if len(product['title']) > 30 else product['title']
    print(f"{i:<4} {product['child_asin']:<12} {product['sku']:<25} £{product['sales_value']:<10.2f} {product['units_ordered']:<8} {title_short}")

print(f"\n📋 SUMMARY OF TOP 100:")
print(f"💰 Combined Sales: £{sum(p['sales_value'] for p in top_100):,.2f}")
print(f"📦 Combined Units: {sum(p['units_ordered'] for p in top_100):,}")
print(f"📊 Average Sale Value: £{sum(p['sales_value'] for p in top_100) / len(top_100):.2f}")

# Generate ASIN and SKU lists for bulk operations
print(f"\n🎯 EXTRACTED DATA FOR BULK OPERATIONS:")
print(f"\n📝 ASINs (Top 100):")
asins = [p['child_asin'] for p in top_100 if p['child_asin']]
print(f"Total ASINs: {len(asins)}")
print(f"Sample: {', '.join(asins[:10])}...")

print(f"\n📝 SKUs (Top 100):")
skus = [p['sku'] for p in top_100 if p['sku']]
print(f"Total SKUs: {len(skus)}")
print(f"Sample: {', '.join(skus[:10])}...")

# Check for missing data
missing_asin = [p for p in top_100 if not p['child_asin']]
missing_sku = [p for p in top_100 if not p['sku']]

print(f"\n⚠️  DATA QUALITY CHECK:")
print(f"Missing ASINs: {len(missing_asin)}")
print(f"Missing SKUs: {len(missing_sku)}")

# Save top 100 to a focused CSV
output_file = "/Users/jackweston/Projects/pre-prod/top-100-best-sellers.csv"
with open(output_file, 'w', newline='', encoding='utf-8') as file:
    writer = csv.writer(file)
    writer.writerow(['Rank', 'Child_ASIN', 'Parent_ASIN', 'SKU', 'Title', 'Sales_Value', 'Units_Ordered', 'Sessions', 'Conversion_Rate'])
    
    for i, product in enumerate(top_100, 1):
        writer.writerow([
            i,
            product['child_asin'],
            product['parent_asin'], 
            product['sku'],
            product['title'],
            product['sales_value'],
            product['units_ordered'],
            product['sessions'],
            round(product['conversion_rate'], 2)
        ])

print(f"\n💾 Saved top 100 to: {output_file}")
print(f"\n🚀 NEXT STEPS:")
print(f"1. Use these ASINs for bulk buy box monitoring")
print(f"2. Focus shipping type detection on top performers")
print(f"3. Monitor these SKUs for pricing opportunities")
