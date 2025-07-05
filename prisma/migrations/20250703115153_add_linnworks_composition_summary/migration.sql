-- CreateTable
CREATE TABLE "LinnworksCompositionSummary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "parentSKU" TEXT NOT NULL,
    "parentTitle" TEXT,
    "childSKUs" TEXT NOT NULL,
    "childTitles" TEXT,
    "childQuantities" TEXT,
    "childPrices" TEXT,
    "childVATs" TEXT,
    "totalQty" INTEGER,
    "totalValue" REAL
);

-- CreateIndex
CREATE INDEX "LinnworksCompositionSummary_parentSKU_idx" ON "LinnworksCompositionSummary"("parentSKU");
