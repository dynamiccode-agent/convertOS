-- CreateTable
CREATE TABLE "MetaAdAccount" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT,
    "timezone" TEXT,
    "accountStatus" INTEGER,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaAdAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaCampaign" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objective" TEXT,
    "status" TEXT,
    "effectiveStatus" TEXT,
    "dailyBudget" TEXT,
    "lifetimeBudget" TEXT,
    "budgetRemaining" TEXT,
    "createdTime" TIMESTAMP(3),
    "startTime" TIMESTAMP(3),
    "stopTime" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaAdSet" (
    "id" TEXT NOT NULL,
    "adsetId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT,
    "effectiveStatus" TEXT,
    "optimizationGoal" TEXT,
    "bidStrategy" TEXT,
    "dailyBudget" TEXT,
    "lifetimeBudget" TEXT,
    "createdTime" TIMESTAMP(3),
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaAdSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaAd" (
    "id" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "adsetId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT,
    "effectiveStatus" TEXT,
    "creativeId" TEXT,
    "creativeTitle" TEXT,
    "creativeBody" TEXT,
    "creativeImageUrl" TEXT,
    "createdTime" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaAd_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaInsight" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "dateStart" TIMESTAMP(3) NOT NULL,
    "dateStop" TIMESTAMP(3) NOT NULL,
    "spend" DECIMAL(10,2),
    "impressions" INTEGER,
    "clicks" INTEGER,
    "reach" INTEGER,
    "frequency" DECIMAL(10,2),
    "ctr" DECIMAL(10,4),
    "cpc" DECIMAL(10,2),
    "cpm" DECIMAL(10,2),
    "leads" INTEGER,
    "purchases" INTEGER,
    "costPerLead" DECIMAL(10,2),
    "costPerPurchase" DECIMAL(10,2),
    "linkClicks" INTEGER,
    "landingPageViews" INTEGER,
    "postEngagements" INTEGER,
    "videoViews" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaAuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "performedBy" TEXT NOT NULL,
    "changes" JSONB,
    "reason" TEXT,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetaAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MetaAdAccount_accountId_key" ON "MetaAdAccount"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaCampaign_campaignId_key" ON "MetaCampaign"("campaignId");

-- CreateIndex
CREATE INDEX "MetaCampaign_accountId_idx" ON "MetaCampaign"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaAdSet_adsetId_key" ON "MetaAdSet"("adsetId");

-- CreateIndex
CREATE INDEX "MetaAdSet_campaignId_idx" ON "MetaAdSet"("campaignId");

-- CreateIndex
CREATE INDEX "MetaAdSet_accountId_idx" ON "MetaAdSet"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaAd_adId_key" ON "MetaAd"("adId");

-- CreateIndex
CREATE INDEX "MetaAd_adsetId_idx" ON "MetaAd"("adsetId");

-- CreateIndex
CREATE INDEX "MetaAd_campaignId_idx" ON "MetaAd"("campaignId");

-- CreateIndex
CREATE INDEX "MetaAd_accountId_idx" ON "MetaAd"("accountId");

-- CreateIndex
CREATE INDEX "MetaInsight_entityId_entityType_idx" ON "MetaInsight"("entityId", "entityType");

-- CreateIndex
CREATE INDEX "MetaInsight_dateStart_dateStop_idx" ON "MetaInsight"("dateStart", "dateStop");

-- CreateIndex
CREATE UNIQUE INDEX "MetaInsight_entityId_entityType_dateStart_dateStop_key" ON "MetaInsight"("entityId", "entityType", "dateStart", "dateStop");

-- CreateIndex
CREATE INDEX "MetaAuditLog_entityType_entityId_idx" ON "MetaAuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "MetaAuditLog_performedBy_idx" ON "MetaAuditLog"("performedBy");

-- CreateIndex
CREATE INDEX "MetaAuditLog_createdAt_idx" ON "MetaAuditLog"("createdAt");
