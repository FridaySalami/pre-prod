#!/usr/bin/env python3
"""
Shipment Efficiency Analysis
Calculates hours adjustment needed to achieve 18 shipments per hour target
"""

import pandas as pd
import numpy as np

def analyze_shipment_efficiency():
    # Read the CSV file
    df = pd.read_csv('amazon hours.csv')
    
    # Set the metric column as index for easier data access
    df = df.set_index('Metric')
    
    # Extract the data rows
    shipments_row = df.loc['1.1 Shipments Packed']
    hours_row = df.loc['1.3.2 Packing Hours Used']
    efficiency_row = df.loc['Shipments Per hour']
    
    # Get date columns (all except the first which is 'Metric')
    date_columns = df.columns
    
    # Create results list
    results = []
    
    # Target efficiency
    target_efficiency = 18.0
    
    print("Shipment Efficiency Analysis")
    print("=" * 60)
    print(f"Target: {target_efficiency} shipments per hour")
    print("=" * 60)
    
    for date in date_columns:
        try:
            shipments = float(shipments_row[date]) if pd.notna(shipments_row[date]) and shipments_row[date] != 0 else 0
            current_hours = float(hours_row[date]) if pd.notna(hours_row[date]) and hours_row[date] != 0 else 0
            current_efficiency = float(efficiency_row[date]) if pd.notna(efficiency_row[date]) and efficiency_row[date] != '' else 0
            
            # Skip days with no shipments or hours (likely weekends/holidays)
            if shipments == 0 or current_hours == 0:
                results.append({
                    'Date': date,
                    'Shipments': int(shipments) if shipments > 0 else 0,
                    'Current Hours': current_hours,
                    'Current Efficiency': 0,
                    'Target Hours Needed': 0,
                    'Hours Adjustment': 0,
                    'Status': 'No Work Day'
                })
                continue
            
            # Calculate hours needed to achieve target efficiency
            target_hours_needed = shipments / target_efficiency
            hours_adjustment = target_hours_needed - current_hours
            
            # Determine status
            if current_efficiency > target_efficiency:
                status = "Above Target"
            elif current_efficiency == target_efficiency:
                status = "On Target"
            else:
                status = "Below Target"
            
            results.append({
                'Date': date,
                'Shipments': int(shipments),
                'Current Hours': current_hours,
                'Current Efficiency': round(current_efficiency, 2),
                'Target Hours Needed': round(target_hours_needed, 2),
                'Hours Adjustment': round(hours_adjustment, 2),
                'Status': status
            })
            
            # Print daily analysis
            if shipments > 0:
                adjustment_text = f"{hours_adjustment:+.2f}" if hours_adjustment != 0 else "0.00"
                print(f"{date}: {int(shipments)} shipments, {current_hours}h used, "
                      f"{current_efficiency:.2f} s/h → Need {target_hours_needed:.2f}h "
                      f"({adjustment_text}h adjustment)")
                
        except (ValueError, TypeError) as e:
            print(f"Error processing {date}: {e}")
            continue
    
    # Create DataFrame from results
    results_df = pd.DataFrame(results)
    
    # Filter out non-working days for summary statistics
    working_days = results_df[results_df['Status'] != 'No Work Day']
    
    print("\n" + "=" * 60)
    print("SUMMARY STATISTICS")
    print("=" * 60)
    
    if len(working_days) > 0:
        total_shipments = working_days['Shipments'].sum()
        total_current_hours = working_days['Current Hours'].sum()
        total_target_hours = working_days['Target Hours Needed'].sum()
        total_adjustment = working_days['Hours Adjustment'].sum()
        avg_current_efficiency = working_days['Current Efficiency'].mean()
        
        days_above_target = len(working_days[working_days['Current Efficiency'] > target_efficiency])
        days_below_target = len(working_days[working_days['Current Efficiency'] < target_efficiency])
        days_on_target = len(working_days[working_days['Current Efficiency'] == target_efficiency])
        
        print(f"Working Days Analyzed: {len(working_days)}")
        print(f"Total Shipments: {total_shipments:,}")
        print(f"Total Current Hours: {total_current_hours:.1f}")
        print(f"Total Target Hours: {total_target_hours:.1f}")
        print(f"Total Hours Adjustment Needed: {total_adjustment:+.1f}")
        print(f"Average Current Efficiency: {avg_current_efficiency:.2f} shipments/hour")
        print(f"Days Above Target ({target_efficiency}+ s/h): {days_above_target}")
        print(f"Days On Target ({target_efficiency} s/h): {days_on_target}")
        print(f"Days Below Target (<{target_efficiency} s/h): {days_below_target}")
        
        if total_adjustment > 0:
            print(f"\n📈 Overall: Need {total_adjustment:.1f} MORE hours to reach target efficiency")
        elif total_adjustment < 0:
            print(f"\n📉 Overall: Could REDUCE hours by {abs(total_adjustment):.1f} while maintaining target efficiency")
        else:
            print(f"\n🎯 Overall: Already at optimal efficiency!")
    
    # Save detailed results to CSV
    output_filename = 'shipment_efficiency_analysis.csv'
    results_df.to_csv(output_filename, index=False)
    print(f"\n💾 Detailed analysis saved to: {output_filename}")
    
    return results_df

if __name__ == "__main__":
    try:
        results = analyze_shipment_efficiency()
        
        print("\n" + "=" * 60)
        print("RECOMMENDATIONS")
        print("=" * 60)
        
        # Calculate some insights
        working_days = results[results['Status'] != 'No Work Day']
        
        if len(working_days) > 0:
            worst_day = working_days.loc[working_days['Current Efficiency'].idxmin()]
            best_day = working_days.loc[working_days['Current Efficiency'].idxmax()]
            
            print(f"🔴 Worst Performance: {worst_day['Date']} ({worst_day['Current Efficiency']:.2f} s/h)")
            print(f"   → Need {worst_day['Hours Adjustment']:+.1f} hours adjustment")
            
            print(f"🟢 Best Performance: {best_day['Date']} ({best_day['Current Efficiency']:.2f} s/h)")
            print(f"   → Could reduce {abs(best_day['Hours Adjustment']):.1f} hours" if best_day['Hours Adjustment'] < 0 else f"   → Need {best_day['Hours Adjustment']:+.1f} hours")
            
            # Days needing most adjustment
            most_adjustment_needed = working_days.nlargest(3, 'Hours Adjustment')
            if len(most_adjustment_needed) > 0:
                print(f"\n📊 Days needing most additional hours:")
                for _, day in most_adjustment_needed.iterrows():
                    if day['Hours Adjustment'] > 0:
                        print(f"   • {day['Date']}: +{day['Hours Adjustment']:.1f}h")
        
    except FileNotFoundError:
        print("❌ Error: Could not find 'amazon hours.csv' in current directory")
        print("Make sure the CSV file is in the same folder as this script")
    except Exception as e:
        print(f"❌ Error: {e}")
