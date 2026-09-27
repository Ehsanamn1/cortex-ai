CREATE TABLE "Plan" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "priceMinor" BIGINT NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'IRR',
  "includedCredits" BIGINT NOT NULL DEFAULT 0,
  "monthlyMessages" INTEGER NOT NULL DEFAULT 0,
  "maxAgents" INTEGER NOT NULL DEFAULT 1,
  "maxTelegramUsers" INTEGER NOT NULL DEFAULT 0,
  "maxStorageMb" INTEGER NOT NULL DEFAULT 20,
  "overageEnabled" BOOLEAN NOT NULL DEFAULT false,
  "customPricing" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "metadataJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Plan_key_key" ON "Plan"("key");
CREATE INDEX "Plan_active_idx" ON "Plan"("active");

CREATE TABLE "WalletAccount" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'CREDITS',
  "balanceCredits" BIGINT NOT NULL DEFAULT 0,
  "reservedCredits" BIGINT NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WalletAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WalletAccount_workspaceId_key" ON "WalletAccount"("workspaceId");
CREATE INDEX "WalletAccount_workspaceId_updatedAt_idx" ON "WalletAccount"("workspaceId", "updatedAt");

ALTER TABLE "WalletAccount"
  ADD CONSTRAINT "WalletAccount_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CreditLedgerEntry" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "entryType" TEXT NOT NULL,
  "deltaCredits" BIGINT NOT NULL,
  "balanceAfter" BIGINT NOT NULL,
  "referenceType" TEXT,
  "referenceId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "description" TEXT,
  "metadataJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreditLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CreditLedgerEntry_idempotencyKey_key" ON "CreditLedgerEntry"("idempotencyKey");
CREATE INDEX "CreditLedgerEntry_workspaceId_createdAt_idx" ON "CreditLedgerEntry"("workspaceId", "createdAt");
CREATE INDEX "CreditLedgerEntry_walletId_createdAt_idx" ON "CreditLedgerEntry"("walletId", "createdAt");
CREATE INDEX "CreditLedgerEntry_referenceType_referenceId_idx" ON "CreditLedgerEntry"("referenceType", "referenceId");

ALTER TABLE "CreditLedgerEntry"
  ADD CONSTRAINT "CreditLedgerEntry_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CreditLedgerEntry"
  ADD CONSTRAINT "CreditLedgerEntry_walletId_fkey"
  FOREIGN KEY ("walletId") REFERENCES "WalletAccount"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CreditReservation" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "amountCredits" BIGINT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "referenceType" TEXT,
  "referenceId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "committedAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  CONSTRAINT "CreditReservation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CreditReservation_idempotencyKey_key" ON "CreditReservation"("idempotencyKey");
CREATE INDEX "CreditReservation_workspaceId_status_createdAt_idx" ON "CreditReservation"("workspaceId", "status", "createdAt");
CREATE INDEX "CreditReservation_walletId_status_createdAt_idx" ON "CreditReservation"("walletId", "status", "createdAt");
CREATE INDEX "CreditReservation_status_expiresAt_idx" ON "CreditReservation"("status", "expiresAt");

ALTER TABLE "CreditReservation"
  ADD CONSTRAINT "CreditReservation_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CreditReservation"
  ADD CONSTRAINT "CreditReservation_walletId_fkey"
  FOREIGN KEY ("walletId") REFERENCES "WalletAccount"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Subscription" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "currentPeriodStart" TIMESTAMP(3) NOT NULL,
  "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "externalCustomerId" TEXT,
  "externalSubscriptionId" TEXT,
  "metadataJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Subscription_workspaceId_status_idx" ON "Subscription"("workspaceId", "status");
CREATE INDEX "Subscription_planId_status_idx" ON "Subscription"("planId", "status");
CREATE INDEX "Subscription_currentPeriodEnd_idx" ON "Subscription"("currentPeriodEnd");

ALTER TABLE "Subscription"
  ADD CONSTRAINT "Subscription_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Subscription"
  ADD CONSTRAINT "Subscription_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "Plan"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ModelCatalog" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "modelId" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "inputUsdMicrosPer1M" INTEGER NOT NULL DEFAULT 0,
  "outputUsdMicrosPer1M" INTEGER NOT NULL DEFAULT 0,
  "creditMultiplierMilli" INTEGER NOT NULL DEFAULT 1000,
  "capabilityTagsJson" TEXT,
  "contextWindow" INTEGER,
  "vision" BOOLEAN NOT NULL DEFAULT false,
  "tools" BOOLEAN NOT NULL DEFAULT false,
  "structuredOutput" BOOLEAN NOT NULL DEFAULT false,
  "reasoning" BOOLEAN NOT NULL DEFAULT false,
  "qualityTier" TEXT,
  "speedTier" TEXT,
  "commercialEnabled" BOOLEAN NOT NULL DEFAULT true,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModelCatalog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModelCatalog_key_key" ON "ModelCatalog"("key");
CREATE INDEX "ModelCatalog_provider_modelId_idx" ON "ModelCatalog"("provider", "modelId");
CREATE INDEX "ModelCatalog_active_commercialEnabled_idx" ON "ModelCatalog"("active", "commercialEnabled");

CREATE TABLE "Invoice" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "subscriptionId" TEXT,
  "number" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "subtotalMinor" BIGINT NOT NULL DEFAULT 0,
  "taxMinor" BIGINT NOT NULL DEFAULT 0,
  "totalMinor" BIGINT NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'IRR',
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "dueAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "metadataJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");
CREATE INDEX "Invoice_workspaceId_createdAt_idx" ON "Invoice"("workspaceId", "createdAt");
CREATE INDEX "Invoice_workspaceId_status_idx" ON "Invoice"("workspaceId", "status");
CREATE INDEX "Invoice_subscriptionId_createdAt_idx" ON "Invoice"("subscriptionId", "createdAt");

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
