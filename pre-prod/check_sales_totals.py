import pandas as pd
import json

def parse_currency(x):
    if not isinstance(x, str): return 0.0
    val = str(x).replace('Â£', '').replace('£', '').replace(',', '').strip()
    try:
        return float(val) if val else 0.0
    except ValueError:
        return 0.0

try:
    df_old = pd.read_csv("docs/Week 11.csv")
    df_new = pd.read_csv("docs/Week 12.csv")

    df_old.columns = df_old.columns.str.strip()
    df_new.columns = df_new.columns.str.strip()

    # Sum up columns
    old_ordered = df_old['Ordered Product Sales'].apply(parse_currency).sum()
    old_b2b = df_old.get('Ordered product sales – B2B', pd.Series([0]*len(df_old))).apply(parse_currency).sum()

    new_ordered = df_new['Ordered Product Sales'].apply(parse_currency).sum()
    new_b2b = df_new.get('Ordered product sales – B2B', pd.Series([0]*len(df_new))).apply(parse_currency).sum()

    print(f"Old Ordered Product Sales (Column Sum): £{old_ordered:,.2f}")
    print(f"Old B2B Sales (Column Sum): £{old_b2b:,.2f}")
    
    print(f"New Ordered Product Sales (Column Sum): £{new_ordered:,.2f}")
    print(f"New B2B Sales (Column Sum): £{new_b2b:,.2f}")

    with open("weekly_comparison.json", "r") as f:
        data = json.load(f)
        summary = data["summary"]
        print("\nScript Summary Output:")
        print(f"Total Old Sales in Script: £{summary['total_old_sales']:,.2f}")
        print(f"Total New Sales in Script: £{summary['total_new_sales']:,.2f}")
        
    if abs(old_ordered - summary['total_old_sales']) < 1.0:
        print("\nMatches 'Ordered Product Sales' column.")
    else:
        print("\nMismatch with 'Ordered Product Sales' column.")

except Exception as e:
    import traceback
    traceback.print_exc()
