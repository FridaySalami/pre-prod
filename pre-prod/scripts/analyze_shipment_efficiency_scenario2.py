#!/usr/bin/env python3
"""
Enhanced Shipment Efficiency Analysis (Scenario 2)
Calculates hours adjustment needed to achieve 18 shipments per hour target
Now includes both packing and picking hours in the calculation
"""

import pandas as pd
import numpy as np

def analyze_shipment_efficiency_enhanced():
    # Read the CSV file
    df = pd.read_csv('shipment analysis scenario 2.csv')
    
    # Set the metric column as index for easier data access
    df = df.set_index('Metric')
    
    # Extract the data rows
    shipments_row = df.loc['1.1 Shipments Packed']
    packing_hours_row = df.loc['1.3.2 Packing Hours Used']
    picking_hours_row = df.loc['1.3.3 Picking Hours Used']
    efficiency_row = df.loc['Shipments Per hour']
    
    # Get date columns (all except the first which is 'Metric')
    date_columns = df.columns
    
    # Create results list
    results = []
    
    # Target efficiency
    target_efficiency = 18.0
    
    print("Enhanced Shipment Efficiency Analysis (Scenario 2)")
    print("=" * 70)
    print(f"Target: {target_efficiency} shipments per hour")
    print("Analysis includes: Packing Hours + Picking Hours = Total Hours")
    print("=" * 70)
    
    for date in date_columns:
        try:
            shipments = float(shipments_row[date]) if pd.notna(shipments_row[date]) and shipments_row[date] != 0 else 0
            packing_hours = float(packing_hours_row[date]) if pd.notna(packing_hours_row[date]) and packing_hours_row[date] != 0 else 0
            picking_hours = float(picking_hours_row[date]) if pd.notna(picking_hours_row[date]) and picking_hours_row[date] != 0 else 0
            current_efficiency = float(efficiency_row[date]) if pd.notna(efficiency_row[date]) and efficiency_row[date] != '' else 0
            
            # Calculate total hours (packing + picking)
            total_current_hours = packing_hours + picking_hours
            
            # Skip days with no shipments or hours (likely weekends/holidays)
            if shipments == 0 or total_current_hours == 0:
                results.append({
                    'Date': date,
                    'Shipments': int(shipments) if shipments > 0 else 0,
                    'Packing Hours': packing_hours,
                    'Picking Hours': picking_hours,
                    'Total Current Hours': total_current_hours,
                    'Current Efficiency': 0,
                    'Target Total Hours': 0,
                    'Hours Adjustment': 0,
                    'Packing %': 0,
                    'Picking %': 0,
                    'Status': 'No Work Day'
                })
                continue
            
            # Calculate hours needed to achieve target efficiency
            target_total_hours = shipments / target_efficiency
            hours_adjustment = target_total_hours - total_current_hours
            
            # Calculate percentage breakdown of hours
            packing_percentage = (packing_hours / total_current_hours * 100) if total_current_hours > 0 else 0
            picking_percentage = (picking_hours / total_current_hours * 100) if total_current_hours > 0 else 0
            
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
                'Packing Hours': packing_hours,
                'Picking Hours': picking_hours,
                'Total Current Hours': total_current_hours,
                'Current Efficiency': round(current_efficiency, 2),
                'Target Total Hours': round(target_total_hours, 2),
                'Hours Adjustment': round(hours_adjustment, 2),
                'Packing %': round(packing_percentage, 1),
                'Picking %': round(picking_percentage, 1),
                'Status': status
            })
            
            # Print daily analysis
            if shipments > 0:
                adjustment_text = f"{hours_adjustment:+.2f}" if hours_adjustment != 0 else "0.00"
                print(f"{date}: {int(shipments)} shipments")
                print(f"  Hours: {packing_hours}h pack + {picking_hours}h pick = {total_current_hours}h total")
                print(f"  Efficiency: {current_efficiency:.2f} s/h → Need {target_total_hours:.2f}h ({adjustment_text}h adjustment)")
                print(f"  Breakdown: {packing_percentage:.1f}% packing, {picking_percentage:.1f}% picking")
                print()
                
        except (ValueError, TypeError) as e:
            print(f"Error processing {date}: {e}")
            continue
    
    # Create DataFrame from results
    results_df = pd.DataFrame(results)
    
    # Filter out non-working days for summary statistics
    working_days = results_df[results_df['Status'] != 'No Work Day']
    
    print("=" * 70)
    print("SUMMARY STATISTICS")
    print("=" * 70)
    
    if len(working_days) > 0:
        total_shipments = working_days['Shipments'].sum()
        total_packing_hours = working_days['Packing Hours'].sum()
        total_picking_hours = working_days['Picking Hours'].sum()
        total_current_hours = working_days['Total Current Hours'].sum()
        total_target_hours = working_days['Target Total Hours'].sum()
        total_adjustment = working_days['Hours Adjustment'].sum()
        avg_current_efficiency = working_days['Current Efficiency'].mean()
        avg_packing_percentage = working_days['Packing %'].mean()
        avg_picking_percentage = working_days['Picking %'].mean()
        
        days_above_target = len(working_days[working_days['Current Efficiency'] > target_efficiency])
        days_below_target = len(working_days[working_days['Current Efficiency'] < target_efficiency])
        days_on_target = len(working_days[working_days['Current Efficiency'] == target_efficiency])
        
        print(f"Working Days Analyzed: {len(working_days)}")
        print(f"Total Shipments: {total_shipments:,}")
        print(f"Total Packing Hours: {total_packing_hours:.1f}")
        print(f"Total Picking Hours: {total_picking_hours:.1f}")
        print(f"Total Current Hours: {total_current_hours:.1f}")
        print(f"Total Target Hours: {total_target_hours:.1f}")
        print(f"Total Hours Adjustment Needed: {total_adjustment:+.1f}")
        print(f"Average Current Efficiency: {avg_current_efficiency:.2f} shipments/hour")
        print(f"Average Hour Breakdown: {avg_packing_percentage:.1f}% packing, {avg_picking_percentage:.1f}% picking")
        print(f"Days Above Target ({target_efficiency}+ s/h): {days_above_target}")
        print(f"Days On Target ({target_efficiency} s/h): {days_on_target}")
        print(f"Days Below Target (<{target_efficiency} s/h): {days_below_target}")
        
        if total_adjustment > 0:
            print(f"\n📈 Overall: Need {total_adjustment:.1f} MORE hours to reach target efficiency")
        elif total_adjustment < 0:
            print(f"\n📉 Overall: Could REDUCE hours by {abs(total_adjustment):.1f} while maintaining target efficiency")
        else:
            print(f"\n🎯 Overall: Already at optimal efficiency!")
            
        # Hour allocation insights
        print(f"\n📊 HOUR ALLOCATION INSIGHTS:")
        print(f"Current allocation: {avg_packing_percentage:.1f}% packing, {avg_picking_percentage:.1f}% picking")
        
        # Find days with unusual picking/packing ratios
        high_picking_days = working_days[working_days['Picking %'] > (avg_picking_percentage + 10)]
        low_picking_days = working_days[working_days['Picking %'] < max(0, avg_picking_percentage - 10)]
        
        if len(high_picking_days) > 0:
            print(f"Days with unusually high picking %: {len(high_picking_days)}")
            for _, day in high_picking_days.iterrows():
                print(f"  • {day['Date']}: {day['Picking %']:.1f}% picking")
        
        if len(low_picking_days) > 0:
            print(f"Days with unusually low picking %: {len(low_picking_days)}")
            for _, day in low_picking_days.iterrows():
                print(f"  • {day['Date']}: {day['Picking %']:.1f}% picking")
    
    # Save detailed results to CSV
    output_filename = 'shipment_efficiency_analysis_scenario2.csv'
    results_df.to_csv(output_filename, index=False)
    print(f"\n💾 Detailed analysis saved to: {output_filename}")
    
    return results_df

if __name__ == "__main__":
    try:
        results = analyze_shipment_efficiency_enhanced()
        
        print("\n" + "=" * 70)
        print("RECOMMENDATIONS")
        print("=" * 70)
        
        # Calculate some insights
        working_days = results[results['Status'] != 'No Work Day']
        
        if len(working_days) > 0:
            worst_day = working_days.loc[working_days['Current Efficiency'].idxmin()]
            best_day = working_days.loc[working_days['Current Efficiency'].idxmax()]
            
            print(f"🔴 Worst Performance: {worst_day['Date']} ({worst_day['Current Efficiency']:.2f} s/h)")
            print(f"   → {worst_day['Packing Hours']:.1f}h pack + {worst_day['Picking Hours']:.1f}h pick = {worst_day['Total Current Hours']:.1f}h total")
            print(f"   → Need {worst_day['Hours Adjustment']:+.1f} hours adjustment")
            
            print(f"🟢 Best Performance: {best_day['Date']} ({best_day['Current Efficiency']:.2f} s/h)")
            print(f"   → {best_day['Packing Hours']:.1f}h pack + {best_day['Picking Hours']:.1f}h pick = {best_day['Total Current Hours']:.1f}h total")
            adjustment_text = f"Could reduce {abs(best_day['Hours Adjustment']):.1f} hours" if best_day['Hours Adjustment'] < 0 else f"Need {best_day['Hours Adjustment']:+.1f} hours"
            print(f"   → {adjustment_text}")
            
            # Days needing most adjustment
            most_adjustment_needed = working_days.nlargest(3, 'Hours Adjustment')
            if len(most_adjustment_needed) > 0:
                print(f"\n📊 Days needing most additional hours:")
                for _, day in most_adjustment_needed.iterrows():
                    if day['Hours Adjustment'] > 0:
                        print(f"   • {day['Date']}: +{day['Hours Adjustment']:.1f}h (Pack: {day['Packing Hours']:.1f}h, Pick: {day['Picking Hours']:.1f}h)")
            
            # Days with most excess hours
            most_excess = working_days.nsmallest(3, 'Hours Adjustment')
            if len(most_excess) > 0:
                print(f"\n📉 Days with most excess hours:")
                for _, day in most_excess.iterrows():
                    if day['Hours Adjustment'] < 0:
                        print(f"   • {day['Date']}: {day['Hours Adjustment']:.1f}h (Pack: {day['Packing Hours']:.1f}h, Pick: {day['Picking Hours']:.1f}h)")
        
    except FileNotFoundError:
        print("❌ Error: Could not find 'shipment analysis scenario 2.csv' in current directory")
        print("Make sure the CSV file is in the same folder as this script")
    except Exception as e:
        print(f"❌ Error: {e}")
