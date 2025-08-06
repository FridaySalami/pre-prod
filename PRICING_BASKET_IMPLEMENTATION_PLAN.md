# Pricing Basket Implementation Plan

## Overview
Implementation of a Tesco-style persistent shopping basket for pricing decisions, allowing users to queue pricing changes before batch processing them.

## Database Schema (✅ COMPLETED)

### Core Table: `pricing_basket`
```sql
CREATE TABLE pricing_basket (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT,
    sku TEXT NOT NULL,
    asin TEXT NOT NULL,
    current_price DECIMAL(10,2),
    target_price DECIMAL(10,2) NOT NULL,
    profit_at_target DECIMAL(10,2),
    margin_at_target DECIMAL(5,2),
    reason TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    
    -- Prevent duplicate pending items for same user/SKU
    CONSTRAINT unique_pending_sku_per_user 
        UNIQUE (user_id, sku) 
        DEFERRABLE INITIALLY DEFERRED
);
```

### Supporting Features
- **User Email Display Function**: `get_short_email(email)` - Shows `jack@...` format
- **Basket Summary View**: Aggregated basket statistics per user
- **Row Level Security (RLS)**: Users only see their own basket items
- **Indexes**: Optimized for user queries, status filtering, and SKU lookups
- **Triggers**: Auto-update timestamps

## Implementation Phases

### Phase 1: Backend API Integration (🎯 AFTER UI)
**Location**: `/src/lib/supabase.js` or new `/src/lib/pricing-basket.js`

#### 1.1 Supabase Client Setup
```javascript
// Add to existing supabase client or create new module
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'YOUR_SUPABASE_URL'
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY'
export const supabase = createClient(supabaseUrl, supabaseKey)
```

#### 1.2 Basket API Functions
```javascript
// Functions to implement:
export async function addToBasket(sku, asin, currentPrice, targetPrice, reason)
export async function removeFromBasket(id)
export async function getUserBasket(userId)
export async function updateBasketItem(id, updates)
export async function processBasket(userId, selectedIds = null)
export async function clearBasket(userId)
export async function getBasketSummary(userId)
```

### Phase 2: UI Components (✅ COMPLETED - FRAMEWORK READY)
**Location**: `/src/routes/buy-box-manager/+page.svelte`

#### 2.1 Basket Button Integration ✅
- ✅ Modified existing "🛒 Add to Basket" buttons  
- ✅ Added basket status indicators
- ✅ Show success/error feedback with toast notifications

#### 2.2 Basket Sidebar/Modal ✅
- ✅ Floating basket indicator (item count + profit summary)
- ✅ Full-featured basket modal with:
  - Item management (edit, remove)
  - Batch processing controls  
  - Status tracking (pending/processing/completed/failed)
  - User identification display

#### 2.3 User Identification ✅
- ✅ Display current user (short email format: `jack@...`)
- ✅ Handle authentication state
- ✅ Persist basket across sessions (ready for backend)

### Phase 3: Batch Processing (🎯 FINAL)
**Location**: New `/src/routes/pricing-basket/` or integrate into existing

#### 3.1 Amazon SP-API Integration
- Queue pricing updates
- Handle rate limiting
- Process in batches
- Error handling and retry logic

#### 3.2 Progress Tracking
- Real-time status updates
- Progress indicators
- Detailed error reporting
- Success confirmations

## Current Integration Points

### Existing Code Locations
1. **Add to Basket Buttons**: Lines 4946-4974 in `+page.svelte`
2. **Buy Box Logic**: Throughout the buy-box-manager component
3. **User Authentication**: Needs Supabase auth integration
4. **Price Update Functions**: Existing `updateLivePrice()` and `matchBuyBox()` functions

### Data Flow
```
User Action (Add to Basket) 
    → Supabase Insert 
    → UI Update 
    → Basket Counter Update
    
Batch Process 
    → Query Pending Items 
    → Amazon SP-API Calls 
    → Status Updates 
    → UI Refresh
```

## Technical Requirements

### Dependencies
- `@supabase/supabase-js` (likely already installed)
- Existing Amazon SP-API integration
- SvelteKit stores for state management

### Environment Variables
```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key (for server-side operations)
```

## Implementation Steps

### Step 1: API Functions (Priority 1)
1. Create `/src/lib/pricing-basket.js`
2. Implement core CRUD operations
3. Add error handling and validation
4. Test with mock data

### Step 2: Basic UI Integration (Priority 2)
1. Add basket store in `/src/lib/stores.js`
2. Modify existing "Add to Basket" buttons
3. Create simple basket counter
4. Add success/error notifications

### Step 3: Basket Management UI (Priority 3)
1. Create basket modal/sidebar component
2. Implement item editing and removal
3. Add batch selection controls
4. Style and responsive design

### Step 4: Batch Processing (Priority 4)
1. Integrate with existing Amazon SP-API functions
2. Add queue management
3. Implement progress tracking
4. Add comprehensive error handling

### Step 5: Enhanced Features (Priority 5)
1. Basket persistence across browser sessions
2. Undo functionality
3. Basket templates/presets
4. Analytics and reporting

## Testing Strategy

### Unit Tests
- Database constraints and triggers
- API function validation
- Error handling scenarios

### Integration Tests
- End-to-end basket workflow
- Amazon SP-API integration
- User authentication flow

### User Acceptance Tests
- Multi-user basket isolation
- Performance with large baskets
- Error recovery scenarios

## Security Considerations

### Row Level Security (RLS)
- ✅ Users can only access their own basket items
- ✅ Service role bypass for admin operations
- ✅ Proper constraint handling for concurrent operations

### Data Validation
- Input sanitization
- Price range validation
- SKU/ASIN format validation
- Rate limiting on basket operations

## Monitoring and Maintenance

### Database Monitoring
- Basket table size and growth
- Failed processing items
- User adoption metrics

### Performance Optimization
- Index usage analysis
- Query performance monitoring
- Batch processing efficiency

## Migration Notes

### From Current Implementation
1. Current "Match Buy Box" buttons → Enhanced "Add to Basket"
2. Immediate price updates → Queued batch processing
3. Individual error handling → Centralized basket error management

### Data Migration
- No existing basket data to migrate
- Preserve existing price update functionality
- Gradual rollout with feature flags

## Success Metrics

### User Experience
- Reduced time from decision to price update
- Improved batch processing efficiency
- Lower error rates in price updates

### Technical Performance
- Basket load times < 200ms
- Batch processing success rate > 95%
- Zero data loss incidents

---

## UI Demo Status (✅ READY TO VIEW)

### What's Working Now:
1. **Fixed Sidebar Basket** (right side)
   - ✅ 384px wide amber/orange themed sidebar
   - ✅ Shows pending item count and profit summary
   - ✅ User email display (`jack@...` format)  
   - ✅ Slide in/out animation with toggle button
   - ✅ **Main content shifts left** when basket is open

2. **Add to Basket Buttons** 
   - Connected to one "Add to Basket" button in individual view
   - Shows success toast notification when clicked
   - Populates basket with real product data from the page
   - Calculates target price from buy box data

3. **Full Basket Interface**
   - ✅ Compact pending items with edit/remove capabilities
   - ✅ Processing status with loading indicators  
   - ✅ Completed items with success indicators
   - ✅ Failed items with retry options
   - ✅ Batch selection and processing controls
   - ✅ **Tesco-style beige/amber color scheme**
   - ✅ **Optimized for sidebar layout** - compact cards, smaller text

4. **Layout Integration**
   - ✅ **Page content automatically adjusts** when basket opens
   - ✅ **No overlay** - sidebar coexists with main content
   - ✅ **Toggle functionality** - click X to close, basket counter to open
   - ✅ **Responsive animations** - smooth slide transitions

### How to Test the UI:
1. Navigate to `/buy-box-manager` 
2. **Sidebar basket appears on the right** - beige/amber theme matching your mockup
3. **Main content shifts left automatically** to accommodate the sidebar
4. Look for floating basket counter (bottom-right) - should show "4" items
5. Try **clicking the X button** in the sidebar header to close it
6. Try **clicking the basket counter** to reopen it  
7. **Interact with basket items** (select, edit, process)
8. **Find a "🛒 Add to Basket" button** in the results table
9. Click it to see toast notification and basket update
10. **Check that content layout adjusts** smoothly when opening/closing

### Visual Features:
- **Responsive Design**: Works on desktop and mobile
- **Status Colors**: Yellow (pending), Blue (processing), Green (completed), Red (failed)
- **Animations**: Loading spinners, hover effects, smooth transitions
- **Professional Styling**: Matches existing app design language
- **Toast Notifications**: Success/error feedback for user actions

---

## Next Immediate Actions

1. **Create pricing-basket.js API module** (30 mins)
2. **Set up basic Supabase connection** (15 mins)
3. **Modify first "Add to Basket" button** (45 mins)
4. **Test end-to-end flow** (30 mins)

**Total Estimated Time for MVP**: 2-3 hours
**Full Implementation**: 1-2 days

---

*This plan serves as the blueprint for implementing the persistent pricing basket functionality. Update this document as implementation progresses and requirements evolve.*
