-- Create storage bucket for SKU-ASIN mapping files
INSERT INTO storage.buckets (id, name, public)
VALUES ('sku-asin-mapping', 'sku-asin-mapping', false)
ON CONFLICT (id) DO NOTHING;

-- Create policy for authenticated users to upload files
CREATE POLICY "Authenticated users can upload sku-asin-mapping files" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'sku-asin-mapping');

-- Create policy for authenticated users to view files
CREATE POLICY "Authenticated users can view sku-asin-mapping files" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'sku-asin-mapping');

-- Create policy for authenticated users to delete files
CREATE POLICY "Authenticated users can delete sku-asin-mapping files" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'sku-asin-mapping');
