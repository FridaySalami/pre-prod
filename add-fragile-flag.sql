
-- Add is_fragile column if it doesn't exist
ALTER TABLE inventory 
ADD COLUMN IF NOT EXISTS is_fragile BOOLEAN DEFAULT FALSE;

-- Reset all to false first (optional, but safe)
UPDATE inventory SET is_fragile = FALSE;

-- Set is_fragile to TRUE for ALL known fragile SKUs (merged from all codebase locations)
UPDATE inventory 
SET is_fragile = TRUE 
WHERE sku IN (
  -- From CostCalculator Class
  'Bundle - 008', 'Bundle - 008 Prime', 'CRI23', 'CRI30', 'CRI30 - 002 Prime', 'CRI31', 'CRI31 - 005',
  'CRI32', 'CRI32 - 020', 'CRI33', 'CRI33 - 014', 'CRI34', 'CRI34 - 017', 'CRI35', 'CRI35 - 027',
  'CRI36', 'CRI36 - 032', 'CRI37', 'CRI37 - 039', 'CRI38', 'CRI38 - 031', 'CRI39', 'CRI39 - 041',
  'CRI40', 'CRI40 - 051', 'CRI50', 'CRI50 - 002', 'EQ01 - 012', 'GLA01', 'GLA01 - 012', 'GLA02', 'GLA02 - 016', 'GLA03',
  'GLA03 - 020', 'GLA04', 'GLA04 - 024', 'GLA05', 'GLA05 - 034', 'GLA06', 'GLA06 - 029', 'GLA07',
  'GLA07 - 033', 'GLA08', 'GLA08 - 037', 'GLA09', 'GLA09 - 045', 'GLA10', 'GLA10 - 049', 'GLA11',
  'GLA11 - 053', 'GLA12', 'GLA12 - 057', 'GLA13', 'GLA13 - 061', 'LIG05', 'LIG05 - 007', 'MUG01',
  'MUG01 - 004', 'MUG02', 'MUG02 - 008', 'MUG03', 'MUG03 - 013', 'MUG04', 'MUG04 - 018', 'MUG05',
  'MUG05 - 023', 'MUG06', 'MUG06 - 028', 'MUG07', 'MUG07 - 036', 'MUG08', 'MUG08 - 040', 'MUG09',
  'MUG09 - 044', 'MUG10', 'MUG10 - 048', 'MUG11', 'MUG11 - 052', 'MUG12', 'MUG12 - 056', 'MUG13',
  'MUG13 - 060', 'PLA01', 'PLA01 - 001', 'PLA02', 'PLA02 - 005', 'PLA03', 'PLA03 - 009', 'PLA04',
  'PLA04 - 015', 'PLA05', 'PLA05 - 019', 'PLA06', 'PLA06 - 025', 'PLA07', 'PLA07 - 030', 'PLA08',
  'PLA08 - 035', 'PLA09', 'PLA09 - 043', 'PLA10', 'PLA10 - 047', 'PLA11', 'PLA11 - 055', 'PLA12',
  'PLA12 - 059', 'TAB01', 'TAB01 - 003', 'TAB02', 'TAB02 - 006', 'TAB03', 'TAB03 - 011', 'TAB04',
  'TAB04 - 017', 'TAB05', 'TAB05 - 022', 'TAB06', 'TAB06 - 026', 'TAB07', 'TAB07 - 038', 'TAB08',
  'TAB08 - 042', 'TAB09', 'TAB09 - 046', 'TAB10', 'TAB10 - 050', 'TAB11', 'TAB11 - 054', 'TAB12',
  'TAB12 - 058', 'TAB13', 'TAB13 - 062',

  -- From Calculation Endpoints
  'CRI38 - 001', 'Crisps Bundle - 001 Prime', 'Crisps Bundle - 002 Prime', 'Crisps Bundle - 003 Prime',
  'Crisps Bundle - 004 Prime', 'Crisps Bundle - 005 Prime', 'Crisps Bundle - 006 Prime',
  'Crisps Bundle - 007 Prime', 'Crisps Bundle - 008 Prime', 'Crisps Bundle - 009 Prime',
  'Crisps Bundle - 010 Prime', 'KY-B3GZ-JQ9Y', 'CRI10', 'CRI10 - 001', 'CRI10 - 002',
  'CRI10 - 002 Prime', 'CRI10 uk shipping', 'Bundle - 159 Prime', 'TAR00', 'TAR02', 'TAR02 - 001 Prime',
  'TAR05C', 'TAR05C - 001', 'TAR10B', 'TAR10B - 010 Prime', 'TAR10B - 011 Prime', 'TAR11', 'TAR11 - 001',
  'TAR14', 'TAR16', 'TAR17', 'TAR31', 'TAR31 - 002', 'TAR31 - 002 uk shipping', 'TAR31 - 003 Prime',
  'TAR31-001', 'TAR31-001 Prime', 'TAR31A', 'TAR31A - 001 Prime', 'TAR32', 'TAR32 - 001', 'TAR32 - 001 Prime',
  'TAR34', 'TAR34A', 'TAR34A - 001 Prime', 'TAR35', 'TAR36', 'TAR36 - 001', 'TAR36A', 'TAR37', 'TAR37 - 001',
  'BAR80', 'BAR80 - 001 Prime', 'BAR80A', 'SWE01', 'SWE01 - 005', 'SWE01 - 005 Prime', 'SWE01 - 006',
  'SWE01 - 006 Prime', 'SWE01 - 007', 'SWE01 - 007 Prime', 'SWE01 - 008', 'SWE01 - 008 Prime',
  'SWE01 - 009', 'SWE01 - 009 Prime', 'SWE01 - 010', 'SWE01 - 010 Prime', 'SWE01 - 011', 'SWE01 - 011 Prime',
  'SWE01 - 012', 'SWE01 - 012 Prime', 'SWE71F', 'SWE71F - 101', 'SWE71F - 102', 'SWE71F - 103',
  'SWE71G', 'SWE71H', 'BODER002 - 005', 'BODER002 - 005 - prime', 'BORDER002', 'BORDER002 - 003',
  'BORDER002 - 003 - Prime', 'BORDER002 - 004', 'BORDER002 - 004 Prime', 'BORDER002 - 006',
  'BORDER002 - 006 Prime', 'BORDER002 - 007', 'BORDER002 - 008', 'BORDER002 - 008 Prime',
  'BORDER002 - 010', 'BORDER002 - 011', 'BORDER002 - 011 Prime', 'BORDER002 - 012', 'BORDER002 - 012 Prime',
  'BORDER02 - 001', 'Bundle - 149 Prime', 'SOUTHD001 - 001', 'SOUTHD002 - 001', 'SOUTHD003 - 001',
  'SOUTHD004 - 001', 'COR50 - 001 Prime', 'COR50 - 004 Prime', 'COR50 - 102', 'COR51 - 005 Prime',
  'COR51 - 102', 'COR52 - 002 Prime', 'COR52 - 102', 'WATER009 - 001', 'WATER005 - 002 Prime',
  'PES07C - 001 Prime', 'SOUTHD009 - 001', 'SOUTHD005 - 001 Prime', 'SOUTHD008 - 001 Prime'
);
