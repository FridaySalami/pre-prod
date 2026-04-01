-- Create table for tracking batch price updates
CREATE TABLE IF NOT EXISTS batch_price_updates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT NOT NULL,
  item_count INTEGER NOT NULL,
  feed_id TEXT,
  status TEXT NOT NULL DEFAULT 'submitted',
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  source TEXT DEFAULT 'buy_box_manager',
  total_price_change DECIMAL(10,2),
  items JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policy
ALTER TABLE batch_price_updates ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own batch updates
CREATE POLICY "Users can view own batch updates" ON batch_price_updates
  FOR ALL USING (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_batch_price_updates_user_id ON batch_price_updates(user_id);
CREATE INDEX IF NOT EXISTS idx_batch_price_updates_feed_id ON batch_price_updates(feed_id);
CREATE INDEX IF NOT EXISTS idx_batch_price_updates_status ON batch_price_updates(status);
CREATE INDEX IF NOT EXISTS idx_batch_price_updates_submitted_at ON batch_price_updates(submitted_at);

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_batch_price_updates_updated_at 
  BEFORE UPDATE ON batch_price_updates 
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();