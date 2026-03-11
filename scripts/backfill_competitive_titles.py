#!/usr/bin/env python3
"""
Backfill Product Titles for Competitive ASINs
Updates existing competitive ASIN records with product titles where missing
"""

import pandas as pd
import requests
import time
from supabase import create_client, Client
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def main():
    # Initialize Supabase client
    url = os.getenv("PUBLIC_SUPABASE_URL")
    key = os.getenv("PRIVATE_SUPABASE_SERVICE_KEY")
    
    if not url or not key:
        print("❌ Error: Missing Supabase credentials")
        return
    
    supabase: Client = create_client(url, key)
    
    print("🔍 Fetching competitive ASINs with missing titles...")
    
    # Get all competitive ASINs that are missing titles
    response = supabase.table('competitive_asins').select('*').is_('competitive_product_title', 'null').execute()
    
    if not response.data:
        print("✅ No competitive ASINs missing titles!")
        return
    
    print(f"📝 Found {len(response.data)} competitive relationships missing titles")
    
    updated_count = 0
    
    for record in response.data:
        competitive_asin = record['competitive_asin']
        record_id = record['id']
        
        # Try to find the title in sku_asin_mapping
        mapping_response = supabase.table('sku_asin_mapping').select('item_name').eq('asin1', competitive_asin).execute()
        
        title = None
        if mapping_response.data and len(mapping_response.data) > 0:
            title = mapping_response.data[0].get('item_name')
        
        # If no title found, create a placeholder
        if not title:
            title = f"Product {competitive_asin}"
        
        # Update the record
        try:
            update_response = supabase.table('competitive_asins').update({
                'competitive_product_title': title
            }).eq('id', record_id).execute()
            
            if update_response.data:
                print(f"✅ Updated {competitive_asin}: {title}")
                updated_count += 1
            else:
                print(f"❌ Failed to update {competitive_asin}")
                
        except Exception as e:
            print(f"❌ Error updating {competitive_asin}: {e}")
        
        # Small delay to avoid overwhelming the database
        time.sleep(0.1)
    
    print(f"\n🎉 Backfill complete! Updated {updated_count} records")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"❌ Error: {e}")
