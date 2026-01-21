export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      amazon_catalog_cache: {
        Row: {
          asin: string
          attributes: Json | null
          brand: string | null
          bullet_points: string[] | null
          category: string | null
          created_at: string
          customer_review_count: number | null
          dimensions: Json | null
          id: number
          images: Json | null
          keywords: Json | null
          marketplace_id: string
          product_type: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          asin: string
          attributes?: Json | null
          brand?: string | null
          bullet_points?: string[] | null
          category?: string | null
          created_at?: string
          customer_review_count?: number | null
          dimensions?: Json | null
          id?: number
          images?: Json | null
          keywords?: Json | null
          marketplace_id?: string
          product_type?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          asin?: string
          attributes?: Json | null
          brand?: string | null
          bullet_points?: string[] | null
          category?: string | null
          created_at?: string
          customer_review_count?: number | null
          dimensions?: Json | null
          id?: number
          images?: Json | null
          keywords?: Json | null
          marketplace_id?: string
          product_type?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      amazon_fees_cache: {
        Row: {
          asin: string
          created_at: string
          estimated_proceeds: number
          fba_fee: number | null
          fee_details: Json | null
          id: number
          is_amazon_fulfilled: boolean
          listing_price: number
          marketplace_id: string
          referral_fee: number
          total_fees: number
          updated_at: string
          variable_closing_fee: number | null
        }
        Insert: {
          asin: string
          created_at?: string
          estimated_proceeds: number
          fba_fee?: number | null
          fee_details?: Json | null
          id?: number
          is_amazon_fulfilled?: boolean
          listing_price: number
          marketplace_id?: string
          referral_fee: number
          total_fees: number
          updated_at?: string
          variable_closing_fee?: number | null
        }
        Update: {
          asin?: string
          created_at?: string
          estimated_proceeds?: number
          fba_fee?: number | null
          fee_details?: Json | null
          id?: number
          is_amazon_fulfilled?: boolean
          listing_price?: number
          marketplace_id?: string
          referral_fee?: number
          total_fees?: number
          updated_at?: string
          variable_closing_fee?: number | null
        }
        Relationships: []
      }
      amazon_listings: {
        Row: {
          created_at: string | null
          id: string
          item_name: string
          merchant_shipping_group: string | null
          price: number | null
          seller_sku: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_name: string
          merchant_shipping_group?: string | null
          price?: number | null
          seller_sku: string
          status: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          item_name?: string
          merchant_shipping_group?: string | null
          price?: number | null
          seller_sku?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      amazon_order_items: {
        Row: {
          amazon_order_id: string | null
          amazon_order_item_id: string
          asin: string | null
          condition_id: string | null
          condition_subtype_id: string | null
          created_at: string | null
          is_gift: boolean | null
          item_price_amount: number | null
          item_price_currency: string | null
          item_tax_amount: number | null
          item_tax_currency: string | null
          promotion_discount_amount: number | null
          promotion_discount_currency: string | null
          quantity_ordered: number | null
          quantity_shipped: number | null
          raw_data: Json | null
          seller_sku: string | null
          shipping_price_amount: number | null
          shipping_price_currency: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          amazon_order_id?: string | null
          amazon_order_item_id: string
          asin?: string | null
          condition_id?: string | null
          condition_subtype_id?: string | null
          created_at?: string | null
          is_gift?: boolean | null
          item_price_amount?: number | null
          item_price_currency?: string | null
          item_tax_amount?: number | null
          item_tax_currency?: string | null
          promotion_discount_amount?: number | null
          promotion_discount_currency?: string | null
          quantity_ordered?: number | null
          quantity_shipped?: number | null
          raw_data?: Json | null
          seller_sku?: string | null
          shipping_price_amount?: number | null
          shipping_price_currency?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          amazon_order_id?: string | null
          amazon_order_item_id?: string
          asin?: string | null
          condition_id?: string | null
          condition_subtype_id?: string | null
          created_at?: string | null
          is_gift?: boolean | null
          item_price_amount?: number | null
          item_price_currency?: string | null
          item_tax_amount?: number | null
          item_tax_currency?: string | null
          promotion_discount_amount?: number | null
          promotion_discount_currency?: string | null
          quantity_ordered?: number | null
          quantity_shipped?: number | null
          raw_data?: Json | null
          seller_sku?: string | null
          shipping_price_amount?: number | null
          shipping_price_currency?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "amazon_order_items_amazon_order_id_fkey"
            columns: ["amazon_order_id"]
            isOneToOne: false
            referencedRelation: "amazon_orders"
            referencedColumns: ["amazon_order_id"]
          },
        ]
      }
      amazon_orders: {
        Row: {
          amazon_order_id: string
          automated_carrier: string | null
          automated_ship_method: string | null
          buyer_email: string | null
          buyer_name: string | null
          created_at: string | null
          currency_code: string | null
          earliest_delivery_date: string | null
          earliest_ship_date: string | null
          fulfillment_channel: string | null
          is_business_order: boolean | null
          is_global_express_enabled: boolean | null
          is_premium_order: boolean | null
          is_prime: boolean | null
          is_replacement_order: boolean | null
          is_sold_by_ab: boolean | null
          last_update_date: string | null
          latest_delivery_date: string | null
          latest_ship_date: string | null
          marketplace_id: string | null
          number_of_items_shipped: number | null
          number_of_items_unshipped: number | null
          order_status: string | null
          order_total: number | null
          order_type: string | null
          payment_method: string | null
          purchase_date: string | null
          raw_data: Json | null
          sales_channel: string | null
          seller_order_id: string | null
          shipment_service_level_category: string | null
          shipping_cost: number | null
          shipping_imported_at: string | null
          shipping_source: string | null
          tracking_id: string | null
          updated_at: string | null
        }
        Insert: {
          amazon_order_id: string
          automated_carrier?: string | null
          automated_ship_method?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          created_at?: string | null
          currency_code?: string | null
          earliest_delivery_date?: string | null
          earliest_ship_date?: string | null
          fulfillment_channel?: string | null
          is_business_order?: boolean | null
          is_global_express_enabled?: boolean | null
          is_premium_order?: boolean | null
          is_prime?: boolean | null
          is_replacement_order?: boolean | null
          is_sold_by_ab?: boolean | null
          last_update_date?: string | null
          latest_delivery_date?: string | null
          latest_ship_date?: string | null
          marketplace_id?: string | null
          number_of_items_shipped?: number | null
          number_of_items_unshipped?: number | null
          order_status?: string | null
          order_total?: number | null
          order_type?: string | null
          payment_method?: string | null
          purchase_date?: string | null
          raw_data?: Json | null
          sales_channel?: string | null
          seller_order_id?: string | null
          shipment_service_level_category?: string | null
          shipping_cost?: number | null
          shipping_imported_at?: string | null
          shipping_source?: string | null
          tracking_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amazon_order_id?: string
          automated_carrier?: string | null
          automated_ship_method?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          created_at?: string | null
          currency_code?: string | null
          earliest_delivery_date?: string | null
          earliest_ship_date?: string | null
          fulfillment_channel?: string | null
          is_business_order?: boolean | null
          is_global_express_enabled?: boolean | null
          is_premium_order?: boolean | null
          is_prime?: boolean | null
          is_replacement_order?: boolean | null
          is_sold_by_ab?: boolean | null
          last_update_date?: string | null
          latest_delivery_date?: string | null
          latest_ship_date?: string | null
          marketplace_id?: string | null
          number_of_items_shipped?: number | null
          number_of_items_unshipped?: number | null
          order_status?: string | null
          order_total?: number | null
          order_type?: string | null
          payment_method?: string | null
          purchase_date?: string | null
          raw_data?: Json | null
          sales_channel?: string | null
          seller_order_id?: string | null
          shipment_service_level_category?: string | null
          shipping_cost?: number | null
          shipping_imported_at?: string | null
          shipping_source?: string | null
          tracking_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      amazon_sales_data: {
        Row: {
          asin: string
          average_offer_count: number | null
          average_sales_price: number | null
          buy_box_percentage: number | null
          currency_code: string | null
          id: number
          imported_at: string | null
          marketplace_id: string | null
          ordered_product_sales: number | null
          ordered_units: number | null
          page_views: number | null
          page_views_percentage: number | null
          parent_asin: string | null
          report_date: string
          report_id: string | null
          session_percentage: number | null
          sessions: number | null
          sku: string | null
          title: string | null
          total_order_items: number | null
          unit_session_percentage: number | null
          updated_at: string | null
        }
        Insert: {
          asin: string
          average_offer_count?: number | null
          average_sales_price?: number | null
          buy_box_percentage?: number | null
          currency_code?: string | null
          id?: number
          imported_at?: string | null
          marketplace_id?: string | null
          ordered_product_sales?: number | null
          ordered_units?: number | null
          page_views?: number | null
          page_views_percentage?: number | null
          parent_asin?: string | null
          report_date: string
          report_id?: string | null
          session_percentage?: number | null
          sessions?: number | null
          sku?: string | null
          title?: string | null
          total_order_items?: number | null
          unit_session_percentage?: number | null
          updated_at?: string | null
        }
        Update: {
          asin?: string
          average_offer_count?: number | null
          average_sales_price?: number | null
          buy_box_percentage?: number | null
          currency_code?: string | null
          id?: number
          imported_at?: string | null
          marketplace_id?: string | null
          ordered_product_sales?: number | null
          ordered_units?: number | null
          page_views?: number | null
          page_views_percentage?: number | null
          parent_asin?: string | null
          report_date?: string
          report_id?: string | null
          session_percentage?: number | null
          sessions?: number | null
          sku?: string | null
          title?: string | null
          total_order_items?: number | null
          unit_session_percentage?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      api_credentials: {
        Row: {
          created_at: string | null
          created_by: string | null
          credential_type: string
          encrypted_value: string
          expires_at: string | null
          id: string
          is_active: boolean | null
          last_used: string | null
          service_name: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          credential_type: string
          encrypted_value: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          last_used?: string | null
          service_name: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          credential_type?: string
          encrypted_value?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          last_used?: string | null
          service_name?: string
        }
        Relationships: []
      }
      api_usage_tracking: {
        Row: {
          api_endpoint: string
          daily_requests: number | null
          error_count: number | null
          id: string
          last_request: string | null
          last_reset_date: string | null
          quota_limit: number | null
          quota_remaining: number | null
          request_count: number | null
          reset_time: string | null
          success_count: number | null
          user_id: string | null
        }
        Insert: {
          api_endpoint: string
          daily_requests?: number | null
          error_count?: number | null
          id?: string
          last_request?: string | null
          last_reset_date?: string | null
          quota_limit?: number | null
          quota_remaining?: number | null
          request_count?: number | null
          reset_time?: string | null
          success_count?: number | null
          user_id?: string | null
        }
        Update: {
          api_endpoint?: string
          daily_requests?: number | null
          error_count?: number | null
          id?: string
          last_request?: string | null
          last_reset_date?: string | null
          quota_limit?: number | null
          quota_remaining?: number | null
          request_count?: number | null
          reset_time?: string | null
          success_count?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          changes: string | null
          entity: string
          entity_id: string
          id: string
          timestamp: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changes?: string | null
          entity: string
          entity_id: string
          id?: string
          timestamp?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changes?: string | null
          entity?: string
          entity_id?: string
          id?: string
          timestamp?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      buy_box_history: {
        Row: {
          asin: string
          buy_box_owner: string
          buy_box_price: number | null
          competitor_info: Json | null
          created_at: string
          has_buy_box: boolean
          id: string
          item_name: string | null
          seller_id: string | null
          sku: string | null
          your_offers: Json | null
        }
        Insert: {
          asin: string
          buy_box_owner: string
          buy_box_price?: number | null
          competitor_info?: Json | null
          created_at?: string
          has_buy_box?: boolean
          id?: string
          item_name?: string | null
          seller_id?: string | null
          sku?: string | null
          your_offers?: Json | null
        }
        Update: {
          asin?: string
          buy_box_owner?: string
          buy_box_price?: number | null
          competitor_info?: Json | null
          created_at?: string
          has_buy_box?: boolean
          id?: string
          item_name?: string | null
          seller_id?: string | null
          sku?: string | null
          your_offers?: Json | null
        }
        Relationships: []
      }
      buybox_data: {
        Row: {
          asin: string
          break_even_price: number | null
          breakeven_calculation: string | null
          buybox_actual_profit: number | null
          buybox_margin_calculation: string | null
          buybox_merchant_token: string | null
          buybox_price: number | null
          buybox_profit_breakdown: string | null
          buybox_shipping: number | null
          buybox_total: number | null
          captured_at: string | null
          competitor_id: string | null
          competitor_name: string | null
          competitor_price: number | null
          currency: string | null
          current_actual_profit: number | null
          current_margin_calculation: string | null
          current_profit_breakdown: string | null
          id: string
          is_winner: boolean | null
          item_name: string | null
          last_price_update: string | null
          margin_at_buybox: number | null
          margin_at_buybox_price: number | null
          margin_difference: number | null
          margin_percent_at_buybox: number | null
          margin_percent_at_buybox_price: number | null
          material_cost_breakdown: string | null
          material_cost_only: number | null
          merchant_shipping_group: string | null
          merchant_token: string | null
          min_profitable_price: number | null
          operating_cost_breakdown: string | null
          opportunity_flag: boolean | null
          price: number | null
          price_adjustment_needed: number | null
          price_gap: number | null
          price_gap_percentage: number | null
          pricing_status: string | null
          product_type: string | null
          profit_opportunity: number | null
          recommended_action: string | null
          run_id: string
          sku: string
          source: string | null
          total_investment_buybox: number | null
          total_investment_current: number | null
          total_offers: number | null
          total_offers_count: number | null
          total_operating_cost: number | null
          update_attempts: number | null
          update_source: string | null
          your_box_cost: number | null
          your_cost: number | null
          your_current_price: number | null
          your_current_shipping: number | null
          your_current_total: number | null
          your_fragile_charge: number | null
          your_margin_at_current_price: number | null
          your_margin_percent_at_current_price: number | null
          your_material_total_cost: number | null
          your_offer_found: boolean | null
          your_offers_count: number | null
          your_shipping_cost: number | null
          your_vat_amount: number | null
        }
        Insert: {
          asin: string
          break_even_price?: number | null
          breakeven_calculation?: string | null
          buybox_actual_profit?: number | null
          buybox_margin_calculation?: string | null
          buybox_merchant_token?: string | null
          buybox_price?: number | null
          buybox_profit_breakdown?: string | null
          buybox_shipping?: number | null
          buybox_total?: number | null
          captured_at?: string | null
          competitor_id?: string | null
          competitor_name?: string | null
          competitor_price?: number | null
          currency?: string | null
          current_actual_profit?: number | null
          current_margin_calculation?: string | null
          current_profit_breakdown?: string | null
          id?: string
          is_winner?: boolean | null
          item_name?: string | null
          last_price_update?: string | null
          margin_at_buybox?: number | null
          margin_at_buybox_price?: number | null
          margin_difference?: number | null
          margin_percent_at_buybox?: number | null
          margin_percent_at_buybox_price?: number | null
          material_cost_breakdown?: string | null
          material_cost_only?: number | null
          merchant_shipping_group?: string | null
          merchant_token?: string | null
          min_profitable_price?: number | null
          operating_cost_breakdown?: string | null
          opportunity_flag?: boolean | null
          price?: number | null
          price_adjustment_needed?: number | null
          price_gap?: number | null
          price_gap_percentage?: number | null
          pricing_status?: string | null
          product_type?: string | null
          profit_opportunity?: number | null
          recommended_action?: string | null
          run_id: string
          sku: string
          source?: string | null
          total_investment_buybox?: number | null
          total_investment_current?: number | null
          total_offers?: number | null
          total_offers_count?: number | null
          total_operating_cost?: number | null
          update_attempts?: number | null
          update_source?: string | null
          your_box_cost?: number | null
          your_cost?: number | null
          your_current_price?: number | null
          your_current_shipping?: number | null
          your_current_total?: number | null
          your_fragile_charge?: number | null
          your_margin_at_current_price?: number | null
          your_margin_percent_at_current_price?: number | null
          your_material_total_cost?: number | null
          your_offer_found?: boolean | null
          your_offers_count?: number | null
          your_shipping_cost?: number | null
          your_vat_amount?: number | null
        }
        Update: {
          asin?: string
          break_even_price?: number | null
          breakeven_calculation?: string | null
          buybox_actual_profit?: number | null
          buybox_margin_calculation?: string | null
          buybox_merchant_token?: string | null
          buybox_price?: number | null
          buybox_profit_breakdown?: string | null
          buybox_shipping?: number | null
          buybox_total?: number | null
          captured_at?: string | null
          competitor_id?: string | null
          competitor_name?: string | null
          competitor_price?: number | null
          currency?: string | null
          current_actual_profit?: number | null
          current_margin_calculation?: string | null
          current_profit_breakdown?: string | null
          id?: string
          is_winner?: boolean | null
          item_name?: string | null
          last_price_update?: string | null
          margin_at_buybox?: number | null
          margin_at_buybox_price?: number | null
          margin_difference?: number | null
          margin_percent_at_buybox?: number | null
          margin_percent_at_buybox_price?: number | null
          material_cost_breakdown?: string | null
          material_cost_only?: number | null
          merchant_shipping_group?: string | null
          merchant_token?: string | null
          min_profitable_price?: number | null
          operating_cost_breakdown?: string | null
          opportunity_flag?: boolean | null
          price?: number | null
          price_adjustment_needed?: number | null
          price_gap?: number | null
          price_gap_percentage?: number | null
          pricing_status?: string | null
          product_type?: string | null
          profit_opportunity?: number | null
          recommended_action?: string | null
          run_id?: string
          sku?: string
          source?: string | null
          total_investment_buybox?: number | null
          total_investment_current?: number | null
          total_offers?: number | null
          total_offers_count?: number | null
          total_operating_cost?: number | null
          update_attempts?: number | null
          update_source?: string | null
          your_box_cost?: number | null
          your_cost?: number | null
          your_current_price?: number | null
          your_current_shipping?: number | null
          your_current_total?: number | null
          your_fragile_charge?: number | null
          your_margin_at_current_price?: number | null
          your_margin_percent_at_current_price?: number | null
          your_material_total_cost?: number | null
          your_offer_found?: boolean | null
          your_offers_count?: number | null
          your_shipping_cost?: number | null
          your_vat_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "buybox_data_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "buybox_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      buybox_failures: {
        Row: {
          asin: string
          attempt_number: number | null
          captured_at: string | null
          error_code: string | null
          id: string
          job_id: string
          raw_error: Json | null
          reason: string
          sku: string | null
        }
        Insert: {
          asin: string
          attempt_number?: number | null
          captured_at?: string | null
          error_code?: string | null
          id?: string
          job_id: string
          raw_error?: Json | null
          reason: string
          sku?: string | null
        }
        Update: {
          asin?: string
          attempt_number?: number | null
          captured_at?: string | null
          error_code?: string | null
          id?: string
          job_id?: string
          raw_error?: Json | null
          reason?: string
          sku?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buybox_failures_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "buybox_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      buybox_jobs: {
        Row: {
          completed_at: string | null
          duration_seconds: number | null
          failed_asins: number | null
          id: string
          jitter_ms: number | null
          max_retries: number | null
          notes: string | null
          rate_limit_per_second: number | null
          source: string | null
          started_at: string | null
          status: string
          successful_asins: number | null
          total_asins: number | null
          triggered_by: string | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          duration_seconds?: number | null
          failed_asins?: number | null
          id?: string
          jitter_ms?: number | null
          max_retries?: number | null
          notes?: string | null
          rate_limit_per_second?: number | null
          source?: string | null
          started_at?: string | null
          status: string
          successful_asins?: number | null
          total_asins?: number | null
          triggered_by?: string | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          duration_seconds?: number | null
          failed_asins?: number | null
          id?: string
          jitter_ms?: number | null
          max_retries?: number | null
          notes?: string | null
          rate_limit_per_second?: number | null
          source?: string | null
          started_at?: string | null
          status?: string
          successful_asins?: number | null
          total_asins?: number | null
          triggered_by?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      buybox_offers: {
        Row: {
          asin: string
          captured_at: string | null
          condition: string | null
          fulfillment_channel: string | null
          id: number
          is_buybox_winner: boolean | null
          is_fba: boolean | null
          is_prime: boolean | null
          listing_price: number | null
          raw_offer: Json | null
          run_id: string
          seller_id: string | null
          seller_name: string | null
          shipping: number | null
          sku: string | null
          total: number | null
        }
        Insert: {
          asin: string
          captured_at?: string | null
          condition?: string | null
          fulfillment_channel?: string | null
          id?: number
          is_buybox_winner?: boolean | null
          is_fba?: boolean | null
          is_prime?: boolean | null
          listing_price?: number | null
          raw_offer?: Json | null
          run_id: string
          seller_id?: string | null
          seller_name?: string | null
          shipping?: number | null
          sku?: string | null
          total?: number | null
        }
        Update: {
          asin?: string
          captured_at?: string | null
          condition?: string | null
          fulfillment_channel?: string | null
          id?: number
          is_buybox_winner?: boolean | null
          is_fba?: boolean | null
          is_prime?: boolean | null
          listing_price?: number | null
          raw_offer?: Json | null
          run_id?: string
          seller_id?: string | null
          seller_name?: string | null
          shipping?: number | null
          sku?: string | null
          total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_buybox_offers_run_id"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "buybox_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          comment: string
          created_at: string
          created_by: string
          id: number
          project_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          created_by: string
          id?: number
          project_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          created_by?: string
          id?: number
          project_id?: string
        }
        Relationships: []
      }
      competitive_asins: {
        Row: {
          added_by: string | null
          competitive_asin: string
          competitive_product_title: string | null
          created_at: string | null
          id: string
          notes: string | null
          primary_asin: string
          primary_product_title: string | null
          relationship_type: string | null
          updated_at: string | null
        }
        Insert: {
          added_by?: string | null
          competitive_asin: string
          competitive_product_title?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          primary_asin: string
          primary_product_title?: string | null
          relationship_type?: string | null
          updated_at?: string | null
        }
        Update: {
          added_by?: string | null
          competitive_asin?: string
          competitive_product_title?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          primary_asin?: string
          primary_product_title?: string | null
          relationship_type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      daily_employee_hours: {
        Row: {
          created_at: string | null
          created_by: string | null
          employee_id: string
          employee_name: string
          employee_role: string
          hours_worked: number
          id: string
          updated_at: string | null
          work_date: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          employee_id: string
          employee_name: string
          employee_role: string
          hours_worked?: number
          id?: string
          updated_at?: string | null
          work_date: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          employee_id?: string
          employee_name?: string
          employee_role?: string
          hours_worked?: number
          id?: string
          updated_at?: string | null
          work_date?: string
        }
        Relationships: []
      }
      daily_metric_review: {
        Row: {
          actual_hours_worked: number | null
          amazon_orders_percent: number | null
          amazon_sales: number | null
          created_at: string | null
          date: string
          ebay_orders_percent: number | null
          ebay_sales: number | null
          id: string
          labor_efficiency: number | null
          labor_utilization_percent: number | null
          linnworks_amazon_orders: number | null
          linnworks_ebay_orders: number | null
          linnworks_shopify_orders: number | null
          linnworks_total_orders: number | null
          management_hours_used: number | null
          packing_hours_used: number | null
          picking_hours_used: number | null
          scheduled_hours: number | null
          shipments_packed: number | null
          shopify_orders_percent: number | null
          shopify_sales: number | null
          total_sales: number | null
          updated_at: string | null
        }
        Insert: {
          actual_hours_worked?: number | null
          amazon_orders_percent?: number | null
          amazon_sales?: number | null
          created_at?: string | null
          date: string
          ebay_orders_percent?: number | null
          ebay_sales?: number | null
          id?: string
          labor_efficiency?: number | null
          labor_utilization_percent?: number | null
          linnworks_amazon_orders?: number | null
          linnworks_ebay_orders?: number | null
          linnworks_shopify_orders?: number | null
          linnworks_total_orders?: number | null
          management_hours_used?: number | null
          packing_hours_used?: number | null
          picking_hours_used?: number | null
          scheduled_hours?: number | null
          shipments_packed?: number | null
          shopify_orders_percent?: number | null
          shopify_sales?: number | null
          total_sales?: number | null
          updated_at?: string | null
        }
        Update: {
          actual_hours_worked?: number | null
          amazon_orders_percent?: number | null
          amazon_sales?: number | null
          created_at?: string | null
          date?: string
          ebay_orders_percent?: number | null
          ebay_sales?: number | null
          id?: string
          labor_efficiency?: number | null
          labor_utilization_percent?: number | null
          linnworks_amazon_orders?: number | null
          linnworks_ebay_orders?: number | null
          linnworks_shopify_orders?: number | null
          linnworks_total_orders?: number | null
          management_hours_used?: number | null
          packing_hours_used?: number | null
          picking_hours_used?: number | null
          scheduled_hours?: number | null
          shipments_packed?: number | null
          shopify_orders_percent?: number | null
          shopify_sales?: number | null
          total_sales?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      daily_metrics: {
        Row: {
          date: string
          defects: number | null
          dpmo: number | null
          hours_worked: number | null
          id: number
          order_accuracy: number | null
          scheduled_hours: number | null
          shipments: number | null
        }
        Insert: {
          date: string
          defects?: number | null
          dpmo?: number | null
          hours_worked?: number | null
          id?: number
          order_accuracy?: number | null
          scheduled_hours?: number | null
          shipments?: number | null
        }
        Update: {
          date?: string
          defects?: number | null
          dpmo?: number | null
          hours_worked?: number | null
          id?: number
          order_accuracy?: number | null
          scheduled_hours?: number | null
          shipments?: number | null
        }
        Relationships: []
      }
      employee_schedules: {
        Row: {
          created_at: string | null
          day_of_week: number
          employee_id: string | null
          id: string
          is_working: boolean
        }
        Insert: {
          created_at?: string | null
          day_of_week: number
          employee_id?: string | null
          id?: string
          is_working?: boolean
        }
        Update: {
          created_at?: string | null
          day_of_week?: number
          employee_id?: string | null
          id?: string
          is_working?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "employee_schedules_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string | null
          id: string
          name: string
          role: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          role: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          role?: string
        }
        Relationships: []
      }
      holidays: {
        Row: {
          created_at: string | null
          date_holiday_requested_to_be_withdrawn: string | null
          dates_to_exclude: string | null
          duration: string | null
          employee_name: string | null
          from_date: string | null
          id: number
          internal_employee_id: string | null
          notes: string | null
          raw_data: Json | null
          status: string | null
          to_date: string | null
          units: string | null
          updated_at: string | null
          user_id: number | null
        }
        Insert: {
          created_at?: string | null
          date_holiday_requested_to_be_withdrawn?: string | null
          dates_to_exclude?: string | null
          duration?: string | null
          employee_name?: string | null
          from_date?: string | null
          id: number
          internal_employee_id?: string | null
          notes?: string | null
          raw_data?: Json | null
          status?: string | null
          to_date?: string | null
          units?: string | null
          updated_at?: string | null
          user_id?: number | null
        }
        Update: {
          created_at?: string | null
          date_holiday_requested_to_be_withdrawn?: string | null
          dates_to_exclude?: string | null
          duration?: string | null
          employee_name?: string | null
          from_date?: string | null
          id?: number
          internal_employee_id?: string | null
          notes?: string | null
          raw_data?: Json | null
          status?: string | null
          to_date?: string | null
          units?: string | null
          updated_at?: string | null
          user_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "holidays_internal_employee_id_fkey"
            columns: ["internal_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      import_records: {
        Row: {
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          error_count: number | null
          error_message: string | null
          errors: string | null
          file_name: string | null
          file_size: number | null
          file_type: string
          filename: string
          id: string
          import_type: string | null
          imported_at: string | null
          imported_records: number | null
          processed_records: number | null
          records_failed: number | null
          records_processed: number | null
          records_total: number | null
          session_id: string | null
          started_at: string | null
          status: string
          total_records: number | null
          updated_at: string | null
          updated_records: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          error_count?: number | null
          error_message?: string | null
          errors?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type: string
          filename: string
          id?: string
          import_type?: string | null
          imported_at?: string | null
          imported_records?: number | null
          processed_records?: number | null
          records_failed?: number | null
          records_processed?: number | null
          records_total?: number | null
          session_id?: string | null
          started_at?: string | null
          status: string
          total_records?: number | null
          updated_at?: string | null
          updated_records?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          error_count?: number | null
          error_message?: string | null
          errors?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string
          filename?: string
          id?: string
          import_type?: string | null
          imported_at?: string | null
          imported_records?: number | null
          processed_records?: number | null
          records_failed?: number | null
          records_processed?: number | null
          records_total?: number | null
          session_id?: string | null
          started_at?: string | null
          status?: string
          total_records?: number | null
          updated_at?: string | null
          updated_records?: number | null
        }
        Relationships: []
      }
      inventory: {
        Row: {
          created_at: string | null
          depth: number | null
          height: number | null
          id: string
          is_fragile: boolean | null
          purchase_price: number | null
          retail_price: number | null
          sku: string
          stock_level: number | null
          title: string
          tracked: boolean | null
          updated_at: string | null
          weight: number | null
          width: number | null
        }
        Insert: {
          created_at?: string | null
          depth?: number | null
          height?: number | null
          id?: string
          is_fragile?: boolean | null
          purchase_price?: number | null
          retail_price?: number | null
          sku: string
          stock_level?: number | null
          title: string
          tracked?: boolean | null
          updated_at?: string | null
          weight?: number | null
          width?: number | null
        }
        Update: {
          created_at?: string | null
          depth?: number | null
          height?: number | null
          id?: string
          is_fragile?: boolean | null
          purchase_price?: number | null
          retail_price?: number | null
          sku?: string
          stock_level?: number | null
          title?: string
          tracked?: boolean | null
          updated_at?: string | null
          weight?: number | null
          width?: number | null
        }
        Relationships: []
      }
      invites: {
        Row: {
          accepted: boolean | null
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invite_token: string
        }
        Insert: {
          accepted?: boolean | null
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          invite_token: string
        }
        Update: {
          accepted?: boolean | null
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invite_token?: string
        }
        Relationships: []
      }
      kaizen_projects: {
        Row: {
          brief_description: string
          category: string
          created_at: string
          deadline: string | null
          detailed_description: string | null
          id: string
          owner: string | null
          status: string
          submitted_by: string
          thumbs_up_count: number | null
          title: string
          updated_at: string
        }
        Insert: {
          brief_description: string
          category: string
          created_at?: string
          deadline?: string | null
          detailed_description?: string | null
          id?: string
          owner?: string | null
          status: string
          submitted_by: string
          thumbs_up_count?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          brief_description?: string
          category?: string
          created_at?: string
          deadline?: string | null
          detailed_description?: string | null
          id?: string
          owner?: string | null
          status?: string
          submitted_by?: string
          thumbs_up_count?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          created_at: string | null
          employee_id: string | null
          end_date: string
          id: string
          leave_type_id: number | null
          notes: string | null
          start_date: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          employee_id?: string | null
          end_date: string
          id?: string
          leave_type_id?: number | null
          notes?: string | null
          start_date: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          employee_id?: string | null
          end_date?: string
          id?: string
          leave_type_id?: number | null
          notes?: string | null
          start_date?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_types: {
        Row: {
          color: string
          created_at: string | null
          id: number
          name: string
        }
        Insert: {
          color: string
          created_at?: string | null
          id?: number
          name: string
        }
        Update: {
          color?: string
          created_at?: string | null
          id?: number
          name?: string
        }
        Relationships: []
      }
      linnworks_composition: {
        Row: {
          child_sku: string
          child_title: string | null
          created_at: string | null
          id: string
          parent_sku: string
          parent_title: string | null
          quantity: number
          updated_at: string | null
        }
        Insert: {
          child_sku: string
          child_title?: string | null
          created_at?: string | null
          id?: string
          parent_sku: string
          parent_title?: string | null
          quantity: number
          updated_at?: string | null
        }
        Update: {
          child_sku?: string
          child_title?: string | null
          created_at?: string | null
          id?: string
          parent_sku?: string
          parent_title?: string | null
          quantity?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      linnworks_composition_summary: {
        Row: {
          child_prices: string | null
          child_quantities: string | null
          child_skus: string | null
          child_titles: string | null
          child_vats: string | null
          created_at: string | null
          id: string
          parent_sku: string
          parent_title: string | null
          total_qty: number | null
          total_value: number | null
          updated_at: string | null
        }
        Insert: {
          child_prices?: string | null
          child_quantities?: string | null
          child_skus?: string | null
          child_titles?: string | null
          child_vats?: string | null
          created_at?: string | null
          id?: string
          parent_sku: string
          parent_title?: string | null
          total_qty?: number | null
          total_value?: number | null
          updated_at?: string | null
        }
        Update: {
          child_prices?: string | null
          child_quantities?: string | null
          child_skus?: string | null
          child_titles?: string | null
          child_vats?: string | null
          created_at?: string | null
          id?: string
          parent_sku?: string
          parent_title?: string | null
          total_qty?: number | null
          total_value?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      metrics_notes: {
        Row: {
          action_plan: string | null
          comments: Json | null
          created_at: string | null
          day_id: string | null
          details: string | null
          id: string
          metric_id: string | null
          root_cause: string | null
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          action_plan?: string | null
          comments?: Json | null
          created_at?: string | null
          day_id?: string | null
          details?: string | null
          id?: string
          metric_id?: string | null
          root_cause?: string | null
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          action_plan?: string | null
          comments?: Json | null
          created_at?: string | null
          day_id?: string | null
          details?: string | null
          id?: string
          metric_id?: string | null
          root_cause?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      notification_config: {
        Row: {
          created_at: string | null
          destination_id: string
          id: string
          offers_subscription_id: string | null
          pricing_subscription_id: string | null
          queue_arn: string
          queue_url: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          destination_id: string
          id: string
          offers_subscription_id?: string | null
          pricing_subscription_id?: string | null
          queue_arn: string
          queue_url: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          destination_id?: string
          id?: string
          offers_subscription_id?: string | null
          pricing_subscription_id?: string | null
          queue_arn?: string
          queue_url?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      price_history: {
        Row: {
          amazon_update_id: string | null
          asin: string | null
          change_reason: string | null
          error_message: string | null
          id: string
          margin_after: number | null
          margin_before: number | null
          new_price: number | null
          old_price: number | null
          record_id: string | null
          sku: string
          success: boolean | null
          updated_at: string | null
          updated_by: string | null
          validation_results: Json | null
        }
        Insert: {
          amazon_update_id?: string | null
          asin?: string | null
          change_reason?: string | null
          error_message?: string | null
          id?: string
          margin_after?: number | null
          margin_before?: number | null
          new_price?: number | null
          old_price?: number | null
          record_id?: string | null
          sku: string
          success?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
          validation_results?: Json | null
        }
        Update: {
          amazon_update_id?: string | null
          asin?: string | null
          change_reason?: string | null
          error_message?: string | null
          id?: string
          margin_after?: number | null
          margin_before?: number | null
          new_price?: number | null
          old_price?: number | null
          record_id?: string | null
          sku?: string
          success?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
          validation_results?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "price_history_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "buybox_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "buybox_margin_comparison"
            referencedColumns: ["id"]
          },
        ]
      }
      price_modification_log: {
        Row: {
          approval_required: boolean | null
          approved_at: string | null
          approved_by: string | null
          asin: string | null
          business_justification: string | null
          created_at: string | null
          id: string
          margin_impact: number | null
          modification_type: string
          new_price: number | null
          old_price: number | null
          price_source: string
          sku: string
          user_id: string | null
          validation_status: string | null
        }
        Insert: {
          approval_required?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          asin?: string | null
          business_justification?: string | null
          created_at?: string | null
          id?: string
          margin_impact?: number | null
          modification_type: string
          new_price?: number | null
          old_price?: number | null
          price_source: string
          sku: string
          user_id?: string | null
          validation_status?: string | null
        }
        Update: {
          approval_required?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          asin?: string | null
          business_justification?: string | null
          created_at?: string | null
          id?: string
          margin_impact?: number | null
          modification_type?: string
          new_price?: number | null
          old_price?: number | null
          price_source?: string
          sku?: string
          user_id?: string | null
          validation_status?: string | null
        }
        Relationships: []
      }
      price_monitoring_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_data: Json | null
          asin: string
          created_at: string | null
          email_sent: boolean | null
          email_sent_at: string | null
          id: string
          message: string
          severity: string
          sku: string
          status: string | null
          type: string
          user_email: string
          webhook_sent: boolean | null
          webhook_sent_at: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_data?: Json | null
          asin: string
          created_at?: string | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          id?: string
          message: string
          severity: string
          sku: string
          status?: string | null
          type: string
          user_email: string
          webhook_sent?: boolean | null
          webhook_sent_at?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_data?: Json | null
          asin?: string
          created_at?: string | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          id?: string
          message?: string
          severity?: string
          sku?: string
          status?: string | null
          type?: string
          user_email?: string
          webhook_sent?: boolean | null
          webhook_sent_at?: string | null
        }
        Relationships: []
      }
      price_monitoring_config: {
        Row: {
          alert_frequency: string | null
          alert_types: Json | null
          asin: string
          check_count: number | null
          created_at: string | null
          id: string
          is_active: boolean | null
          last_checked: string | null
          last_price_update: string | null
          monitoring_enabled: boolean | null
          price_change_threshold: number | null
          priority: number | null
          sku: string
          updated_at: string | null
          user_email: string
        }
        Insert: {
          alert_frequency?: string | null
          alert_types?: Json | null
          asin: string
          check_count?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_checked?: string | null
          last_price_update?: string | null
          monitoring_enabled?: boolean | null
          price_change_threshold?: number | null
          priority?: number | null
          sku: string
          updated_at?: string | null
          user_email: string
        }
        Update: {
          alert_frequency?: string | null
          alert_types?: Json | null
          asin?: string
          check_count?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_checked?: string | null
          last_price_update?: string | null
          monitoring_enabled?: boolean | null
          price_change_threshold?: number | null
          priority?: number | null
          sku?: string
          updated_at?: string | null
          user_email?: string
        }
        Relationships: []
      }
      price_monitoring_history: {
        Row: {
          asin: string
          buy_box_owner: string | null
          buy_box_price: number | null
          competitor_count: number | null
          created_at: string | null
          id: string
          is_buy_box_yours: boolean | null
          lowest_competitor_price: number | null
          monitoring_config_id: string | null
          raw_data: Json | null
          sku: string
          your_price: number | null
        }
        Insert: {
          asin: string
          buy_box_owner?: string | null
          buy_box_price?: number | null
          competitor_count?: number | null
          created_at?: string | null
          id?: string
          is_buy_box_yours?: boolean | null
          lowest_competitor_price?: number | null
          monitoring_config_id?: string | null
          raw_data?: Json | null
          sku: string
          your_price?: number | null
        }
        Update: {
          asin?: string
          buy_box_owner?: string | null
          buy_box_price?: number | null
          competitor_count?: number | null
          created_at?: string | null
          id?: string
          is_buy_box_yours?: boolean | null
          lowest_competitor_price?: number | null
          monitoring_config_id?: string | null
          raw_data?: Json | null
          sku?: string
          your_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "price_monitoring_history_monitoring_config_id_fkey"
            columns: ["monitoring_config_id"]
            isOneToOne: false
            referencedRelation: "price_monitoring_config"
            referencedColumns: ["id"]
          },
        ]
      }
      price_monitoring_job_log: {
        Row: {
          created_at: string | null
          id: string
          metadata: Json | null
          status: string
          timestamp: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          status: string
          timestamp?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          timestamp?: string | null
        }
        Relationships: []
      }
      price_monitoring_stats: {
        Row: {
          alerts_generated: number | null
          api_rate_limit_hits: number | null
          api_requests_made: number | null
          avg_alerts_per_run: number | null
          created_at: string | null
          errors: Json | null
          high_severity_alerts: number | null
          id: string
          items_failed: number | null
          items_processed: number | null
          items_requested: number | null
          run_completed_at: string | null
          run_duration_seconds: number | null
          run_started_at: string
        }
        Insert: {
          alerts_generated?: number | null
          api_rate_limit_hits?: number | null
          api_requests_made?: number | null
          avg_alerts_per_run?: number | null
          created_at?: string | null
          errors?: Json | null
          high_severity_alerts?: number | null
          id?: string
          items_failed?: number | null
          items_processed?: number | null
          items_requested?: number | null
          run_completed_at?: string | null
          run_duration_seconds?: number | null
          run_started_at: string
        }
        Update: {
          alerts_generated?: number | null
          api_rate_limit_hits?: number | null
          api_requests_made?: number | null
          avg_alerts_per_run?: number | null
          created_at?: string | null
          errors?: Json | null
          high_severity_alerts?: number | null
          id?: string
          items_failed?: number | null
          items_processed?: number | null
          items_requested?: number | null
          run_completed_at?: string | null
          run_duration_seconds?: number | null
          run_started_at?: string
        }
        Relationships: []
      }
      price_rollback_points: {
        Row: {
          asin: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          reason: string
          sku: string
          snapshot_price: number
          snapshot_time: string | null
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          asin?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          reason: string
          sku: string
          snapshot_price: number
          snapshot_time?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          asin?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          reason?: string
          sku?: string
          snapshot_price?: number
          snapshot_time?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      pricing_basket: {
        Row: {
          action_type: string
          asin: string
          completed_at: string | null
          created_at: string | null
          current_price: number | null
          error_message: string | null
          estimated_margin_percent: number | null
          estimated_profit: number | null
          id: string
          processed_by: string | null
          product_name: string | null
          proposed_price: number
          reasoning: string | null
          shipping_group: string | null
          sku: string
          status: string | null
          user_email: string
          user_id: string | null
        }
        Insert: {
          action_type: string
          asin: string
          completed_at?: string | null
          created_at?: string | null
          current_price?: number | null
          error_message?: string | null
          estimated_margin_percent?: number | null
          estimated_profit?: number | null
          id?: string
          processed_by?: string | null
          product_name?: string | null
          proposed_price: number
          reasoning?: string | null
          shipping_group?: string | null
          sku: string
          status?: string | null
          user_email: string
          user_id?: string | null
        }
        Update: {
          action_type?: string
          asin?: string
          completed_at?: string | null
          created_at?: string | null
          current_price?: number | null
          error_message?: string | null
          estimated_margin_percent?: number | null
          estimated_profit?: number | null
          id?: string
          processed_by?: string | null
          product_name?: string | null
          proposed_price?: number
          reasoning?: string | null
          shipping_group?: string | null
          sku?: string
          status?: string | null
          user_email?: string
          user_id?: string | null
        }
        Relationships: []
      }
      process_steps: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          issues: Json | null
          name: string
          notes: string | null
          responsible: string
          step_number: number
          time_minutes: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          issues?: Json | null
          name: string
          notes?: string | null
          responsible: string
          step_number: number
          time_minutes?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          issues?: Json | null
          name?: string
          notes?: string | null
          responsible?: string
          step_number?: number
          time_minutes?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string
          role: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      project_likes: {
        Row: {
          created_at: string
          id: string
          project_id: string
          user_email: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          user_email: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          user_email?: string
        }
        Relationships: []
      }
      report_job_logs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          date_range_end: string | null
          date_range_start: string | null
          duration_seconds: number | null
          error_code: string | null
          error_message: string | null
          id: number
          job_type: string
          marketplace_id: string | null
          records_failed: number | null
          records_processed: number | null
          records_updated: number | null
          report_document_id: string | null
          report_id: string | null
          report_type: string | null
          retry_count: number | null
          started_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          date_range_end?: string | null
          date_range_start?: string | null
          duration_seconds?: number | null
          error_code?: string | null
          error_message?: string | null
          id?: number
          job_type: string
          marketplace_id?: string | null
          records_failed?: number | null
          records_processed?: number | null
          records_updated?: number | null
          report_document_id?: string | null
          report_id?: string | null
          report_type?: string | null
          retry_count?: number | null
          started_at?: string | null
          status: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          date_range_end?: string | null
          date_range_start?: string | null
          duration_seconds?: number | null
          error_code?: string | null
          error_message?: string | null
          id?: number
          job_type?: string
          marketplace_id?: string | null
          records_failed?: number | null
          records_processed?: number | null
          records_updated?: number | null
          report_document_id?: string | null
          report_id?: string | null
          report_type?: string | null
          retry_count?: number | null
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      sage_reports: {
        Row: {
          bin_name: string | null
          bom_item_type_id: string | null
          company_name: string | null
          created_at: string | null
          id: string
          price: number | null
          product_group_code: string | null
          standard_cost: number | null
          stock_code: string
          supplier_account_number: string | null
          tax_rate: number | null
          updated_at: string | null
        }
        Insert: {
          bin_name?: string | null
          bom_item_type_id?: string | null
          company_name?: string | null
          created_at?: string | null
          id?: string
          price?: number | null
          product_group_code?: string | null
          standard_cost?: number | null
          stock_code: string
          supplier_account_number?: string | null
          tax_rate?: number | null
          updated_at?: string | null
        }
        Update: {
          bin_name?: string | null
          bom_item_type_id?: string | null
          company_name?: string | null
          created_at?: string | null
          id?: string
          price?: number | null
          product_group_code?: string | null
          standard_cost?: number | null
          stock_code?: string
          supplier_account_number?: string | null
          tax_rate?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sales_june: {
        Row: {
          "(Child) ASIN": string | null
          "(Parent) ASIN": string | null
          "Featured Offer (Buy Box) percentage": string | null
          "Featured Offer (Buy Box) percentage – B2B": string | null
          "Ordered Product Sales": string | null
          "Ordered product sales – B2B": string | null
          "Page views – Browser": string | null
          "Page views – Browser – B2B": string | null
          "Page views – Mobile app": string | null
          "Page views – Mobile APP – B2B": string | null
          "Page views – Total": string | null
          "Page views – Total – B2B": string | null
          "Page views percentage – Browser": string | null
          "Page views percentage – Browser – B2B": string | null
          "Page views percentage – Mobile App": string | null
          "Page views percentage – Mobile app – B2B": string | null
          "Page views percentage – Total": string | null
          "Page views percentage – Total – B2B": string | null
          "Primary Key": number
          "Session percentage – Browser": string | null
          "Session percentage – Browser – B2B": string | null
          "Session percentage – Mobile App": string | null
          "Session percentage – Mobile APP – B2B": string | null
          "Session percentage – Total": string | null
          "Session percentage – Total – B2B": string | null
          "Sessions – Browser": string | null
          "Sessions – Browser – B2B": string | null
          "Sessions – Mobile app": string | null
          "Sessions – Mobile APP – B2B": string | null
          "Sessions – Total": string | null
          "Sessions – Total – B2B": string | null
          SKU: string | null
          Title: string | null
          "Total order items": number | null
          "Total order items – B2B": string | null
          "Unit Session Percentage": string | null
          "Unit session percentage – B2B": string | null
          "Units ordered": number | null
          "Units ordered – B2B": string | null
        }
        Insert: {
          "(Child) ASIN"?: string | null
          "(Parent) ASIN"?: string | null
          "Featured Offer (Buy Box) percentage"?: string | null
          "Featured Offer (Buy Box) percentage – B2B"?: string | null
          "Ordered Product Sales"?: string | null
          "Ordered product sales – B2B"?: string | null
          "Page views – Browser"?: string | null
          "Page views – Browser – B2B"?: string | null
          "Page views – Mobile app"?: string | null
          "Page views – Mobile APP – B2B"?: string | null
          "Page views – Total"?: string | null
          "Page views – Total – B2B"?: string | null
          "Page views percentage – Browser"?: string | null
          "Page views percentage – Browser – B2B"?: string | null
          "Page views percentage – Mobile App"?: string | null
          "Page views percentage – Mobile app – B2B"?: string | null
          "Page views percentage – Total"?: string | null
          "Page views percentage – Total – B2B"?: string | null
          "Primary Key": number
          "Session percentage – Browser"?: string | null
          "Session percentage – Browser – B2B"?: string | null
          "Session percentage – Mobile App"?: string | null
          "Session percentage – Mobile APP – B2B"?: string | null
          "Session percentage – Total"?: string | null
          "Session percentage – Total – B2B"?: string | null
          "Sessions – Browser"?: string | null
          "Sessions – Browser – B2B"?: string | null
          "Sessions – Mobile app"?: string | null
          "Sessions – Mobile APP – B2B"?: string | null
          "Sessions – Total"?: string | null
          "Sessions – Total – B2B"?: string | null
          SKU?: string | null
          Title?: string | null
          "Total order items"?: number | null
          "Total order items – B2B"?: string | null
          "Unit Session Percentage"?: string | null
          "Unit session percentage – B2B"?: string | null
          "Units ordered"?: number | null
          "Units ordered – B2B"?: string | null
        }
        Update: {
          "(Child) ASIN"?: string | null
          "(Parent) ASIN"?: string | null
          "Featured Offer (Buy Box) percentage"?: string | null
          "Featured Offer (Buy Box) percentage – B2B"?: string | null
          "Ordered Product Sales"?: string | null
          "Ordered product sales – B2B"?: string | null
          "Page views – Browser"?: string | null
          "Page views – Browser – B2B"?: string | null
          "Page views – Mobile app"?: string | null
          "Page views – Mobile APP – B2B"?: string | null
          "Page views – Total"?: string | null
          "Page views – Total – B2B"?: string | null
          "Page views percentage – Browser"?: string | null
          "Page views percentage – Browser – B2B"?: string | null
          "Page views percentage – Mobile App"?: string | null
          "Page views percentage – Mobile app – B2B"?: string | null
          "Page views percentage – Total"?: string | null
          "Page views percentage – Total – B2B"?: string | null
          "Primary Key"?: number
          "Session percentage – Browser"?: string | null
          "Session percentage – Browser – B2B"?: string | null
          "Session percentage – Mobile App"?: string | null
          "Session percentage – Mobile APP – B2B"?: string | null
          "Session percentage – Total"?: string | null
          "Session percentage – Total – B2B"?: string | null
          "Sessions – Browser"?: string | null
          "Sessions – Browser – B2B"?: string | null
          "Sessions – Mobile app"?: string | null
          "Sessions – Mobile APP – B2B"?: string | null
          "Sessions – Total"?: string | null
          "Sessions – Total – B2B"?: string | null
          SKU?: string | null
          Title?: string | null
          "Total order items"?: number | null
          "Total order items – B2B"?: string | null
          "Unit Session Percentage"?: string | null
          "Unit session percentage – B2B"?: string | null
          "Units ordered"?: number | null
          "Units ordered – B2B"?: string | null
        }
        Relationships: []
      }
      scheduled_hours: {
        Row: {
          created_at: string | null
          date: string
          hours: number
          id: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          hours?: number
          id?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          hours?: number
          id?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      schedules: {
        Row: {
          created_at: string | null
          date: string
          employee_id: string | null
          id: string
          shift: string
        }
        Insert: {
          created_at?: string | null
          date: string
          employee_id?: string | null
          id?: string
          shift: string
        }
        Update: {
          created_at?: string | null
          date?: string
          employee_id?: string | null
          id?: string
          shift?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      security_audit_log: {
        Row: {
          action: string | null
          details: Json | null
          event_details: Json
          event_type: string
          id: string
          ip_address: unknown
          resource_id: string | null
          resource_type: string | null
          severity: string | null
          timestamp: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          details?: Json | null
          event_details?: Json
          event_type: string
          id?: string
          ip_address?: unknown
          resource_id?: string | null
          resource_type?: string | null
          severity?: string | null
          timestamp?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string | null
          details?: Json | null
          event_details?: Json
          event_type?: string
          id?: string
          ip_address?: unknown
          resource_id?: string | null
          resource_type?: string | null
          severity?: string | null
          timestamp?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      sku_asin_mapping: {
        Row: {
          add_delete: string | null
          asin1: string | null
          asin2: string | null
          asin3: string | null
          bid_for_featured_placement: boolean | null
          created_at: string | null
          expedited_shipping: boolean | null
          fulfillment_channel: string | null
          id: string
          image_url: string | null
          item_condition: string | null
          item_description: string | null
          item_is_marketplace: boolean | null
          item_name: string | null
          item_note: string | null
          listing_id: string | null
          merchant_shipping_group: string | null
          min_price: number | null
          minimum_order_quantity: number | null
          monitoring_enabled: boolean | null
          open_date: string | null
          pending_quantity: number | null
          price: number | null
          product_id: string | null
          product_id_type: string | null
          quantity: number | null
          sell_remainder: boolean | null
          seller_sku: string
          status: string | null
          updated_at: string | null
          will_ship_internationally: boolean | null
          zshop_boldface: boolean | null
          zshop_browse_path: string | null
          zshop_category1: string | null
          zshop_shipping_fee: number | null
          zshop_storefront_feature: string | null
        }
        Insert: {
          add_delete?: string | null
          asin1?: string | null
          asin2?: string | null
          asin3?: string | null
          bid_for_featured_placement?: boolean | null
          created_at?: string | null
          expedited_shipping?: boolean | null
          fulfillment_channel?: string | null
          id?: string
          image_url?: string | null
          item_condition?: string | null
          item_description?: string | null
          item_is_marketplace?: boolean | null
          item_name?: string | null
          item_note?: string | null
          listing_id?: string | null
          merchant_shipping_group?: string | null
          min_price?: number | null
          minimum_order_quantity?: number | null
          monitoring_enabled?: boolean | null
          open_date?: string | null
          pending_quantity?: number | null
          price?: number | null
          product_id?: string | null
          product_id_type?: string | null
          quantity?: number | null
          sell_remainder?: boolean | null
          seller_sku: string
          status?: string | null
          updated_at?: string | null
          will_ship_internationally?: boolean | null
          zshop_boldface?: boolean | null
          zshop_browse_path?: string | null
          zshop_category1?: string | null
          zshop_shipping_fee?: number | null
          zshop_storefront_feature?: string | null
        }
        Update: {
          add_delete?: string | null
          asin1?: string | null
          asin2?: string | null
          asin3?: string | null
          bid_for_featured_placement?: boolean | null
          created_at?: string | null
          expedited_shipping?: boolean | null
          fulfillment_channel?: string | null
          id?: string
          image_url?: string | null
          item_condition?: string | null
          item_description?: string | null
          item_is_marketplace?: boolean | null
          item_name?: string | null
          item_note?: string | null
          listing_id?: string | null
          merchant_shipping_group?: string | null
          min_price?: number | null
          minimum_order_quantity?: number | null
          monitoring_enabled?: boolean | null
          open_date?: string | null
          pending_quantity?: number | null
          price?: number | null
          product_id?: string | null
          product_id_type?: string | null
          quantity?: number | null
          sell_remainder?: boolean | null
          seller_sku?: string
          status?: string | null
          updated_at?: string | null
          will_ship_internationally?: boolean | null
          zshop_boldface?: boolean | null
          zshop_browse_path?: string | null
          zshop_category1?: string | null
          zshop_shipping_fee?: number | null
          zshop_storefront_feature?: string | null
        }
        Relationships: []
      }
      sku_asin_mapping_files: {
        Row: {
          file_path: string
          file_size: number | null
          filename: string
          id: string
          notes: string | null
          status: string | null
          upload_date: string | null
        }
        Insert: {
          file_path: string
          file_size?: number | null
          filename: string
          id?: string
          notes?: string | null
          status?: string | null
          upload_date?: string | null
        }
        Update: {
          file_path?: string
          file_size?: number | null
          filename?: string
          id?: string
          notes?: string | null
          status?: string | null
          upload_date?: string | null
        }
        Relationships: []
      }
      sku_asin_mapping_imports: {
        Row: {
          filename: string
          id: string
          import_date: string | null
          notes: string | null
          records_count: number | null
          status: string | null
        }
        Insert: {
          filename: string
          id?: string
          import_date?: string | null
          notes?: string | null
          records_count?: number | null
          status?: string | null
        }
        Update: {
          filename?: string
          id?: string
          import_date?: string | null
          notes?: string | null
          records_count?: number | null
          status?: string | null
        }
        Relationships: []
      }
      sku_product_types: {
        Row: {
          asin: string | null
          id: string
          marketplace_id: string | null
          product_type: string
          sku: string
          source: string | null
          verified_at: string | null
        }
        Insert: {
          asin?: string | null
          id?: string
          marketplace_id?: string | null
          product_type: string
          sku: string
          source?: string | null
          verified_at?: string | null
        }
        Update: {
          asin?: string | null
          id?: string
          marketplace_id?: string | null
          product_type?: string
          sku?: string
          source?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      skus: {
        Row: {
          auto_pricing_enabled: boolean | null
          brand: string | null
          category: string | null
          cost: number | null
          created_at: string | null
          handling_cost: number | null
          min_price: number | null
          monitoring_enabled: boolean | null
          priority_score: number | null
          shipping_cost: number | null
          sku: string
          updated_at: string | null
        }
        Insert: {
          auto_pricing_enabled?: boolean | null
          brand?: string | null
          category?: string | null
          cost?: number | null
          created_at?: string | null
          handling_cost?: number | null
          min_price?: number | null
          monitoring_enabled?: boolean | null
          priority_score?: number | null
          shipping_cost?: number | null
          sku: string
          updated_at?: string | null
        }
        Update: {
          auto_pricing_enabled?: boolean | null
          brand?: string | null
          category?: string | null
          cost?: number | null
          created_at?: string | null
          handling_cost?: number | null
          min_price?: number | null
          monitoring_enabled?: boolean | null
          priority_score?: number | null
          shipping_cost?: number | null
          sku?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string | null
          department: string | null
          id: string
          permissions: Json | null
          role: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          department?: string | null
          id?: string
          permissions?: Json | null
          role?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          department?: string | null
          id?: string
          permissions?: Json | null
          role?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          ip_address: unknown
          is_active: boolean | null
          last_activity: string | null
          session_id: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: unknown
          is_active?: boolean | null
          last_activity?: string | null
          session_id: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: unknown
          is_active?: boolean | null
          last_activity?: string | null
          session_id?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      active_rollback_points: {
        Row: {
          asin: string | null
          created_by: string | null
          created_by_email: string | null
          reason: string | null
          sku: string | null
          snapshot_price: number | null
          snapshot_time: string | null
        }
        Relationships: []
      }
      api_usage_summary: {
        Row: {
          api_endpoint: string | null
          last_used: string | null
          success_rate_percent: number | null
          total_errors: number | null
          total_requests: number | null
          total_success: number | null
          user_id: string | null
        }
        Relationships: []
      }
      basket_summary: {
        Row: {
          action_type: string | null
          asin: string | null
          created_at: string | null
          current_price: number | null
          estimated_margin_percent: number | null
          estimated_profit: number | null
          id: string | null
          price_difference: number | null
          price_direction: string | null
          product_name: string | null
          proposed_price: number | null
          reasoning: string | null
          shipping_group: string | null
          sku: string | null
          status: string | null
          user_email: string | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          action_type?: string | null
          asin?: string | null
          created_at?: string | null
          current_price?: number | null
          estimated_margin_percent?: number | null
          estimated_profit?: number | null
          id?: string | null
          price_difference?: never
          price_direction?: never
          product_name?: string | null
          proposed_price?: number | null
          reasoning?: string | null
          shipping_group?: string | null
          sku?: string | null
          status?: string | null
          user_email?: string | null
          user_id?: string | null
          username?: never
        }
        Update: {
          action_type?: string | null
          asin?: string | null
          created_at?: string | null
          current_price?: number | null
          estimated_margin_percent?: number | null
          estimated_profit?: number | null
          id?: string | null
          price_difference?: never
          price_direction?: never
          product_name?: string | null
          proposed_price?: number | null
          reasoning?: string | null
          shipping_group?: string | null
          sku?: string | null
          status?: string | null
          user_email?: string | null
          user_id?: string | null
          username?: never
        }
        Relationships: []
      }
      buybox_margin_comparison: {
        Row: {
          asin: string | null
          buybox_margin_calculation: string | null
          captured_at: string | null
          current_margin_calculation: string | null
          id: string | null
          roi_margin_percent: number | null
          sku: string | null
          total_investment_buybox: number | null
          total_investment_current: number | null
          traditional_margin_percent: number | null
        }
        Insert: {
          asin?: string | null
          buybox_margin_calculation?: string | null
          captured_at?: string | null
          current_margin_calculation?: string | null
          id?: string | null
          roi_margin_percent?: number | null
          sku?: string | null
          total_investment_buybox?: number | null
          total_investment_current?: number | null
          traditional_margin_percent?: never
        }
        Update: {
          asin?: string | null
          buybox_margin_calculation?: string | null
          captured_at?: string | null
          current_margin_calculation?: string | null
          id?: string | null
          roi_margin_percent?: number | null
          sku?: string | null
          total_investment_buybox?: number | null
          total_investment_current?: number | null
          traditional_margin_percent?: never
        }
        Relationships: []
      }
      job_statistics_summary: {
        Row: {
          avg_duration_ms: number | null
          date: string | null
          failed_runs: number | null
          successful_runs: number | null
          total_alerts_generated: number | null
          total_logs: number | null
          total_processed: number | null
        }
        Relationships: []
      }
      monitoring_health_summary: {
        Row: {
          active_configs: number | null
          avg_checks_per_config: number | null
          last_check_time: string | null
          recently_checked: number | null
          stale_configs: number | null
          total_configs: number | null
        }
        Relationships: []
      }
      recent_price_changes: {
        Row: {
          asin: string | null
          change_reason: string | null
          new_price: number | null
          old_price: number | null
          sku: string | null
          success: boolean | null
          updated_at: string | null
          user_email: string | null
          user_role: string | null
        }
        Relationships: []
      }
      sales_dashboard_30d: {
        Row: {
          asin: string | null
          avg_buy_box: number | null
          avg_conversion: number | null
          avg_price: number | null
          days_with_data: number | null
          first_sale_date: string | null
          last_sale_date: string | null
          parent_asin: string | null
          total_page_views: number | null
          total_revenue: number | null
          total_sessions: number | null
          total_units: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      cleanup_buy_box_history: { Args: never; Returns: undefined }
      create_rollback_point: {
        Args: {
          p_asin: string
          p_current_price: number
          p_reason: string
          p_sku: string
        }
        Returns: string
      }
      get_columns: {
        Args: { table_name: string }
        Returns: {
          column_name: string
          data_type: string
        }[]
      }
      get_policies: {
        Args: { table_name: string }
        Returns: {
          cmd: string
          permissive: string
          policyname: string
          roles: string
        }[]
      }
      get_short_email: { Args: { email_address: string }; Returns: string }
      get_tables: {
        Args: never
        Returns: {
          table_name: string
        }[]
      }
      increment_check_count: { Args: { config_id: number }; Returns: undefined }
      log_price_change: {
        Args: {
          p_amazon_update_id?: string
          p_asin: string
          p_error_message?: string
          p_new_price: number
          p_old_price: number
          p_reason: string
          p_record_id: string
          p_sku: string
          p_success?: boolean
          p_validation_results?: Json
        }
        Returns: string
      }
      log_security_event: {
        Args: {
          p_event_details?: Json
          p_event_type: string
          p_severity?: string
        }
        Returns: string
      }
      refresh_sales_dashboard: { Args: never; Returns: undefined }
      track_api_usage: {
        Args: { p_endpoint: string; p_success?: boolean }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
