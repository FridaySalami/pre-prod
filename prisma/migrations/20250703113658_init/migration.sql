-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "supplier" TEXT,
    "cost" REAL,
    "listPrice" REAL,
    "weight" REAL,
    "dimensions" TEXT,
    "description" TEXT,
    "stockLevel" INTEGER,
    "reorderLevel" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PricingRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ruleType" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PriceCalculation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "ruleId" TEXT,
    "baseCost" REAL NOT NULL,
    "markup" REAL NOT NULL,
    "discount" REAL,
    "finalPrice" REAL NOT NULL,
    "margin" REAL NOT NULL,
    "notes" TEXT,
    "calculatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PriceCalculation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PriceCalculation_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "PricingRule" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "recordsTotal" INTEGER,
    "recordsProcessed" INTEGER,
    "recordsFailed" INTEGER,
    "errors" TEXT,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "amazon_listings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sellerSku" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "price" REAL,
    "merchantShippingGroup" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "inventory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sku" TEXT NOT NULL,
    "stockLevel" INTEGER,
    "depth" REAL,
    "height" REAL,
    "width" REAL,
    "purchasePrice" REAL,
    "retailPrice" REAL,
    "title" TEXT NOT NULL,
    "tracked" BOOLEAN NOT NULL DEFAULT true,
    "weight" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "changes" TEXT,
    "userId" TEXT,
    "userEmail" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SageReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "stockCode" TEXT NOT NULL,
    "binName" TEXT,
    "standardCost" REAL,
    "taxRate" REAL,
    "price" REAL,
    "productGroupCode" TEXT,
    "bomItemTypeId" TEXT,
    "companyName" TEXT,
    "supplierAccountNumber" TEXT
);

-- CreateTable
CREATE TABLE "LinnworksComposition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "parentSKU" TEXT NOT NULL,
    "parentTitle" TEXT,
    "childSKU" TEXT NOT NULL,
    "childTitle" TEXT,
    "quantity" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "_PricingRuleToProduct" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_PricingRuleToProduct_A_fkey" FOREIGN KEY ("A") REFERENCES "PricingRule" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_PricingRuleToProduct_B_fkey" FOREIGN KEY ("B") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_ImportRecordToProduct" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_ImportRecordToProduct_A_fkey" FOREIGN KEY ("A") REFERENCES "ImportRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ImportRecordToProduct_B_fkey" FOREIGN KEY ("B") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_key_key" ON "Setting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "amazon_listings_sellerSku_key" ON "amazon_listings"("sellerSku");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_sku_key" ON "inventory"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "SageReport_stockCode_key" ON "SageReport"("stockCode");

-- CreateIndex
CREATE INDEX "LinnworksComposition_parentSKU_idx" ON "LinnworksComposition"("parentSKU");

-- CreateIndex
CREATE INDEX "LinnworksComposition_childSKU_idx" ON "LinnworksComposition"("childSKU");

-- CreateIndex
CREATE UNIQUE INDEX "LinnworksComposition_parentSKU_childSKU_key" ON "LinnworksComposition"("parentSKU", "childSKU");

-- CreateIndex
CREATE UNIQUE INDEX "_PricingRuleToProduct_AB_unique" ON "_PricingRuleToProduct"("A", "B");

-- CreateIndex
CREATE INDEX "_PricingRuleToProduct_B_index" ON "_PricingRuleToProduct"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_ImportRecordToProduct_AB_unique" ON "_ImportRecordToProduct"("A", "B");

-- CreateIndex
CREATE INDEX "_ImportRecordToProduct_B_index" ON "_ImportRecordToProduct"("B");
