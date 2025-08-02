/*
  Warnings:

  - You are about to drop the column `tokenCount` on the `usage_stats` table. All the data in the column will be lost.
  - You are about to drop the `ai_services` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `totalTokens` to the `usage_stats` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `api_keys` DROP FOREIGN KEY `api_keys_aiServiceId_fkey`;

-- DropForeignKey
ALTER TABLE `group_ai_services` DROP FOREIGN KEY `group_ai_services_aiServiceId_fkey`;

-- DropForeignKey
ALTER TABLE `usage_stats` DROP FOREIGN KEY `usage_stats_aiServiceId_fkey`;

-- DropIndex
DROP INDEX `api_keys_aiServiceId_fkey` ON `api_keys`;

-- DropIndex
DROP INDEX `group_ai_services_aiServiceId_fkey` ON `group_ai_services`;

-- AlterTable
ALTER TABLE `group_ai_services` ADD COLUMN `accountId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `groups` ADD COLUMN `departmentId` VARCHAR(191) NULL,
    ADD COLUMN `enterpriseId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `usage_stats` DROP COLUMN `tokenCount`,
    ADD COLUMN `accountId` VARCHAR(191) NULL,
    ADD COLUMN `departmentId` VARCHAR(191) NULL,
    ADD COLUMN `enterpriseId` VARCHAR(191) NULL,
    ADD COLUMN `requestTokens` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `responseTokens` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `totalTokens` BIGINT NOT NULL;

-- DropTable
DROP TABLE `ai_services`;

-- CreateTable
CREATE TABLE `email_logs` (
    `id` VARCHAR(191) NOT NULL,
    `to` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `sentAt` DATETIME(3) NULL,
    `error` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quota_configs` (
    `id` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `aiServiceId` VARCHAR(191) NOT NULL,
    `dailyTokenLimit` BIGINT NOT NULL DEFAULT 100000,
    `monthlyTokenLimit` BIGINT NOT NULL DEFAULT 3000000,
    `dailyCostLimit` DECIMAL(10, 2) NOT NULL DEFAULT 10.0,
    `monthlyCostLimit` DECIMAL(10, 2) NOT NULL DEFAULT 300.0,
    `warningThreshold` INTEGER NOT NULL DEFAULT 80,
    `userDailyTokenLimit` BIGINT NULL,
    `userMonthlyTokenLimit` BIGINT NULL,
    `resetTime` VARCHAR(191) NOT NULL DEFAULT '00:00',
    `timezone` VARCHAR(191) NOT NULL DEFAULT 'Asia/Shanghai',
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `quota_configs_groupId_aiServiceId_key`(`groupId`, `aiServiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quota_usage` (
    `id` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `aiServiceId` VARCHAR(191) NOT NULL,
    `dateKey` VARCHAR(191) NOT NULL,
    `monthKey` VARCHAR(191) NOT NULL,
    `dailyTokens` BIGINT NOT NULL DEFAULT 0,
    `monthlyTokens` BIGINT NOT NULL DEFAULT 0,
    `dailyCost` DECIMAL(10, 4) NOT NULL DEFAULT 0,
    `monthlyCost` DECIMAL(10, 4) NOT NULL DEFAULT 0,
    `lastResetDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `warningsSent` JSON NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `quota_usage_dateKey_idx`(`dateKey`),
    INDEX `quota_usage_monthKey_idx`(`monthKey`),
    UNIQUE INDEX `quota_usage_groupId_aiServiceId_key`(`groupId`, `aiServiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_quota_usage` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `aiServiceId` VARCHAR(191) NOT NULL,
    `dateKey` VARCHAR(191) NOT NULL,
    `monthKey` VARCHAR(191) NOT NULL,
    `dailyTokens` BIGINT NOT NULL DEFAULT 0,
    `monthlyTokens` BIGINT NOT NULL DEFAULT 0,
    `dailyCost` DECIMAL(10, 4) NOT NULL DEFAULT 0,
    `monthlyCost` DECIMAL(10, 4) NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `user_quota_usage_dateKey_idx`(`dateKey`),
    INDEX `user_quota_usage_monthKey_idx`(`monthKey`),
    UNIQUE INDEX `user_quota_usage_userId_groupId_aiServiceId_key`(`userId`, `groupId`, `aiServiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_service_accounts` (
    `id` VARCHAR(191) NOT NULL,
    `enterpriseId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `serviceType` VARCHAR(191) NOT NULL,
    `accountType` VARCHAR(191) NOT NULL DEFAULT 'shared',
    `authType` ENUM('api_key', 'oauth') NOT NULL,
    `encryptedCredentials` TEXT NOT NULL,
    `oauthAccessToken` TEXT NULL,
    `oauthRefreshToken` TEXT NULL,
    `oauthExpiresAt` DATETIME(3) NULL,
    `oauthScopes` VARCHAR(191) NULL,
    `apiEndpoint` VARCHAR(191) NULL,
    `proxyType` VARCHAR(191) NULL,
    `proxyHost` VARCHAR(191) NULL,
    `proxyPort` INTEGER NULL,
    `proxyUsername` VARCHAR(191) NULL,
    `proxyPassword` VARCHAR(191) NULL,
    `supportedModels` JSON NOT NULL,
    `currentModel` VARCHAR(191) NULL,
    `dailyLimit` INTEGER NOT NULL DEFAULT 10000,
    `costPerToken` DECIMAL(10, 8) NOT NULL DEFAULT 0.00001,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `currentLoad` INTEGER NOT NULL DEFAULT 0,
    `totalRequests` BIGINT NOT NULL DEFAULT 0,
    `totalTokens` BIGINT NOT NULL DEFAULT 0,
    `totalCost` DECIMAL(12, 4) NOT NULL DEFAULT 0,
    `lastUsedAt` DATETIME(3) NULL,
    `errorMessage` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ai_service_accounts_enterpriseId_idx`(`enterpriseId`),
    INDEX `ai_service_accounts_serviceType_idx`(`serviceType`),
    INDEX `ai_service_accounts_status_idx`(`status`),
    INDEX `ai_service_accounts_accountType_idx`(`accountType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `edge_nodes` (
    `id` VARCHAR(191) NOT NULL,
    `nodeId` VARCHAR(191) NOT NULL,
    `nodeName` VARCHAR(191) NOT NULL,
    `location` VARCHAR(191) NOT NULL,
    `endpoint` VARCHAR(191) NOT NULL,
    `publicKey` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `capabilities` JSON NOT NULL,
    `currentLoad` JSON NOT NULL,
    `healthScore` INTEGER NOT NULL DEFAULT 100,
    `lastHeartbeat` DATETIME(3) NULL,
    `version` VARCHAR(191) NOT NULL DEFAULT '1.0.0',
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `edge_nodes_nodeId_key`(`nodeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `edge_node_groups` (
    `id` VARCHAR(191) NOT NULL,
    `nodeId` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `priority` INTEGER NOT NULL DEFAULT 1,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `config` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `edge_node_groups_nodeId_groupId_key`(`nodeId`, `groupId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `edge_service_routes` (
    `id` VARCHAR(191) NOT NULL,
    `nodeId` VARCHAR(191) NOT NULL,
    `aiServiceId` VARCHAR(191) NOT NULL,
    `routeConfig` JSON NOT NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `edge_service_routes_nodeId_aiServiceId_key`(`nodeId`, `aiServiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `edge_node_metrics` (
    `id` VARCHAR(191) NOT NULL,
    `nodeId` VARCHAR(191) NOT NULL,
    `metricType` VARCHAR(191) NOT NULL,
    `value` DECIMAL(15, 4) NOT NULL,
    `unit` VARCHAR(191) NOT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `metadata` JSON NULL,

    INDEX `edge_node_metrics_nodeId_metricType_timestamp_idx`(`nodeId`, `metricType`, `timestamp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `deployment_modes` (
    `id` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `mode` VARCHAR(191) NOT NULL,
    `config` JSON NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT false,
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `deployment_modes_groupId_mode_key`(`groupId`, `mode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_metrics` (
    `id` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NULL,
    `component` VARCHAR(191) NOT NULL,
    `metricName` VARCHAR(191) NOT NULL,
    `value` DECIMAL(15, 4) NOT NULL,
    `unit` VARCHAR(191) NOT NULL,
    `tags` JSON NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `system_metrics_component_metricName_timestamp_idx`(`component`, `metricName`, `timestamp`),
    INDEX `system_metrics_groupId_timestamp_idx`(`groupId`, `timestamp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `alert_rules` (
    `id` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NULL,
    `ruleName` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `condition` JSON NOT NULL,
    `severity` VARCHAR(191) NOT NULL DEFAULT 'warning',
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `cooldown` INTEGER NOT NULL DEFAULT 300,
    `actions` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `alert_incidents` (
    `id` VARCHAR(191) NOT NULL,
    `ruleId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `severity` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `metadata` JSON NULL,
    `startTime` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endTime` DATETIME(3) NULL,
    `resolvedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `alert_incidents_status_startTime_idx`(`status`, `startTime`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invite_links` (
    `id` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `creatorId` VARCHAR(191) NOT NULL,
    `maxUses` INTEGER NOT NULL DEFAULT 10,
    `usedCount` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `invite_links_token_key`(`token`),
    INDEX `invite_links_groupId_fkey`(`groupId`),
    INDEX `invite_links_creatorId_fkey`(`creatorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `model_configurations` (
    `id` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `serviceType` VARCHAR(191) NOT NULL DEFAULT 'claude_code',
    `primaryModel` VARCHAR(191) NOT NULL DEFAULT 'claude-4-sonnet',
    `fallbackModels` JSON NOT NULL,
    `failoverTrigger` VARCHAR(191) NOT NULL DEFAULT 'automatic',
    `healthCheckThreshold` INTEGER NOT NULL DEFAULT 80,
    `failbackEnabled` BOOLEAN NOT NULL DEFAULT true,
    `strategy` VARCHAR(191) NOT NULL DEFAULT 'priority',
    `maxRetries` INTEGER NOT NULL DEFAULT 3,
    `timeout` INTEGER NOT NULL DEFAULT 30000,
    `healthCheckInterval` INTEGER NOT NULL DEFAULT 60000,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `model_configurations_groupId_serviceType_key`(`groupId`, `serviceType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `model_failover_logs` (
    `id` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `fromModel` VARCHAR(191) NOT NULL,
    `toModel` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `success` BOOLEAN NOT NULL,
    `responseTime` INTEGER NULL,
    `errorMsg` VARCHAR(191) NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `metadata` JSON NULL,

    INDEX `model_failover_logs_groupId_timestamp_idx`(`groupId`, `timestamp`),
    INDEX `model_failover_logs_fromModel_toModel_idx`(`fromModel`, `toModel`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `model_performance_metrics` (
    `id` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `modelId` VARCHAR(191) NOT NULL,
    `metricType` VARCHAR(191) NOT NULL,
    `value` DECIMAL(15, 4) NOT NULL,
    `unit` VARCHAR(191) NOT NULL,
    `windowStart` DATETIME(3) NOT NULL,
    `windowEnd` DATETIME(3) NOT NULL,
    `sampleCount` INTEGER NOT NULL DEFAULT 1,
    `tags` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `model_performance_metrics_groupId_modelId_metricType_windowS_idx`(`groupId`, `modelId`, `metricType`, `windowStart`),
    INDEX `model_performance_metrics_windowStart_windowEnd_idx`(`windowStart`, `windowEnd`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `enterprises` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `planType` VARCHAR(191) NOT NULL DEFAULT 'basic',
    `organizationType` VARCHAR(191) NOT NULL DEFAULT 'enterprise',
    `creationTemplate` VARCHAR(191) NULL,
    `uiTheme` VARCHAR(191) NOT NULL DEFAULT 'professional',
    `featureSet` JSON NULL,
    `settings` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_enterprises` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `enterpriseId` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'member',
    `permissions` JSON NULL,
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastAccessed` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `isActive` BOOLEAN NOT NULL DEFAULT true,

    INDEX `user_enterprises_userId_idx`(`userId`),
    INDEX `user_enterprises_enterpriseId_idx`(`enterpriseId`),
    INDEX `user_enterprises_lastAccessed_idx`(`lastAccessed`),
    UNIQUE INDEX `user_enterprises_userId_enterpriseId_key`(`userId`, `enterpriseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `enterprise_settings` (
    `id` VARCHAR(191) NOT NULL,
    `enterpriseId` VARCHAR(191) NOT NULL,
    `theme` JSON NULL,
    `features` JSON NOT NULL,
    `security` JSON NOT NULL,
    `integrations` JSON NOT NULL,
    `notifications` JSON NOT NULL,
    `budgetSettings` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `enterprise_settings_enterpriseId_key`(`enterpriseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `departments` (
    `id` VARCHAR(191) NOT NULL,
    `enterpriseId` VARCHAR(191) NOT NULL,
    `parentId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `budgetLimit` DECIMAL(10, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `departments_enterpriseId_idx`(`enterpriseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `account_pools` (
    `id` VARCHAR(191) NOT NULL,
    `enterpriseId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `poolType` VARCHAR(191) NOT NULL DEFAULT 'shared',
    `loadBalanceStrategy` VARCHAR(191) NOT NULL DEFAULT 'round_robin',
    `maxLoadPerAccount` INTEGER NOT NULL DEFAULT 80,
    `priority` INTEGER NOT NULL DEFAULT 1,
    `maxConcurrent` INTEGER NOT NULL DEFAULT 10,
    `dailyLimit` INTEGER NOT NULL DEFAULT 1000,
    `costLimit` DECIMAL(10, 2) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `account_pools_enterpriseId_idx`(`enterpriseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `account_pool_bindings` (
    `id` VARCHAR(191) NOT NULL,
    `poolId` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `weight` INTEGER NOT NULL DEFAULT 1,
    `maxLoadPercentage` INTEGER NOT NULL DEFAULT 80,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `account_pool_bindings_accountId_idx`(`accountId`),
    UNIQUE INDEX `account_pool_bindings_poolId_accountId_key`(`poolId`, `accountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `group_pool_bindings` (
    `id` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `poolId` VARCHAR(191) NOT NULL,
    `bindingType` VARCHAR(191) NOT NULL DEFAULT 'shared',
    `priority` INTEGER NOT NULL DEFAULT 1,
    `usageWeight` INTEGER NOT NULL DEFAULT 1,
    `usageLimitHourly` INTEGER NOT NULL DEFAULT 0,
    `usageLimitDaily` INTEGER NOT NULL DEFAULT 0,
    `usageLimitMonthly` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `group_pool_bindings_poolId_idx`(`poolId`),
    UNIQUE INDEX `group_pool_bindings_groupId_poolId_key`(`groupId`, `poolId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `group_resource_bindings` (
    `id` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `bindingMode` VARCHAR(191) NOT NULL,
    `bindingConfig` JSON NOT NULL,
    `dailyTokenLimit` INTEGER NOT NULL DEFAULT 10000,
    `monthlyBudget` DECIMAL(10, 2) NULL,
    `priorityLevel` VARCHAR(191) NOT NULL DEFAULT 'medium',
    `warningThreshold` INTEGER NOT NULL DEFAULT 80,
    `alertThreshold` INTEGER NOT NULL DEFAULT 95,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `group_resource_bindings_groupId_key`(`groupId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `group_account_bindings` (
    `id` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `priority` INTEGER NOT NULL DEFAULT 1,
    `weight` INTEGER NOT NULL DEFAULT 1,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `group_account_bindings_accountId_idx`(`accountId`),
    UNIQUE INDEX `group_account_bindings_groupId_accountId_key`(`groupId`, `accountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `account_health_checks` (
    `id` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `isHealthy` BOOLEAN NOT NULL,
    `responseTime` INTEGER NULL,
    `errorMessage` VARCHAR(191) NULL,
    `checkedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `account_health_checks_accountId_checkedAt_idx`(`accountId`, `checkedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `budget_allocations` (
    `id` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `budgetPeriod` VARCHAR(191) NOT NULL DEFAULT 'monthly',
    `budgetAmount` DECIMAL(10, 2) NOT NULL,
    `usedAmount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `periodStart` DATETIME(3) NOT NULL,
    `periodEnd` DATETIME(3) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `budget_allocations_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `budget_allocations_budgetPeriod_periodStart_idx`(`budgetPeriod`, `periodStart`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_enterprise_roles` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `enterpriseId` VARCHAR(191) NULL,
    `roleId` VARCHAR(191) NOT NULL,
    `scope` VARCHAR(191) NOT NULL DEFAULT 'enterprise',
    `resourceId` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `user_enterprise_roles_userId_idx`(`userId`),
    INDEX `user_enterprise_roles_enterpriseId_idx`(`enterpriseId`),
    INDEX `user_enterprise_roles_roleId_idx`(`roleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `enterprise_roles` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `isBuiltIn` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `enterprise_roles_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_permissions` (
    `id` VARCHAR(191) NOT NULL,
    `roleId` VARCHAR(191) NOT NULL,
    `permission` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `role_permissions_roleId_permission_key`(`roleId`, `permission`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `group_ai_services_accountId_idx` ON `group_ai_services`(`accountId`);

-- CreateIndex
CREATE INDEX `groups_enterpriseId_idx` ON `groups`(`enterpriseId`);

-- CreateIndex
CREATE INDEX `groups_departmentId_idx` ON `groups`(`departmentId`);

-- CreateIndex
CREATE INDEX `usage_stats_accountId_requestTime_idx` ON `usage_stats`(`accountId`, `requestTime`);

-- CreateIndex
CREATE INDEX `usage_stats_enterpriseId_requestTime_idx` ON `usage_stats`(`enterpriseId`, `requestTime`);

-- CreateIndex
CREATE INDEX `usage_stats_departmentId_requestTime_idx` ON `usage_stats`(`departmentId`, `requestTime`);

-- AddForeignKey
ALTER TABLE `groups` ADD CONSTRAINT `groups_enterpriseId_fkey` FOREIGN KEY (`enterpriseId`) REFERENCES `enterprises`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `groups` ADD CONSTRAINT `groups_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `group_ai_services` ADD CONSTRAINT `group_ai_services_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `ai_service_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usage_stats` ADD CONSTRAINT `usage_stats_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `ai_service_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quota_configs` ADD CONSTRAINT `quota_configs_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quota_usage` ADD CONSTRAINT `quota_usage_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_quota_usage` ADD CONSTRAINT `user_quota_usage_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_quota_usage` ADD CONSTRAINT `user_quota_usage_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_service_accounts` ADD CONSTRAINT `ai_service_accounts_enterpriseId_fkey` FOREIGN KEY (`enterpriseId`) REFERENCES `enterprises`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `edge_node_groups` ADD CONSTRAINT `edge_node_groups_nodeId_fkey` FOREIGN KEY (`nodeId`) REFERENCES `edge_nodes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `edge_node_groups` ADD CONSTRAINT `edge_node_groups_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `edge_service_routes` ADD CONSTRAINT `edge_service_routes_nodeId_fkey` FOREIGN KEY (`nodeId`) REFERENCES `edge_nodes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `edge_node_metrics` ADD CONSTRAINT `edge_node_metrics_nodeId_fkey` FOREIGN KEY (`nodeId`) REFERENCES `edge_nodes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `deployment_modes` ADD CONSTRAINT `deployment_modes_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_metrics` ADD CONSTRAINT `system_metrics_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alert_rules` ADD CONSTRAINT `alert_rules_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alert_incidents` ADD CONSTRAINT `alert_incidents_ruleId_fkey` FOREIGN KEY (`ruleId`) REFERENCES `alert_rules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invite_links` ADD CONSTRAINT `invite_links_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invite_links` ADD CONSTRAINT `invite_links_creatorId_fkey` FOREIGN KEY (`creatorId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `model_configurations` ADD CONSTRAINT `model_configurations_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `model_failover_logs` ADD CONSTRAINT `model_failover_logs_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `model_performance_metrics` ADD CONSTRAINT `model_performance_metrics_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_enterprises` ADD CONSTRAINT `user_enterprises_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_enterprises` ADD CONSTRAINT `user_enterprises_enterpriseId_fkey` FOREIGN KEY (`enterpriseId`) REFERENCES `enterprises`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enterprise_settings` ADD CONSTRAINT `enterprise_settings_enterpriseId_fkey` FOREIGN KEY (`enterpriseId`) REFERENCES `enterprises`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `departments` ADD CONSTRAINT `departments_enterpriseId_fkey` FOREIGN KEY (`enterpriseId`) REFERENCES `enterprises`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `departments` ADD CONSTRAINT `departments_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `account_pools` ADD CONSTRAINT `account_pools_enterpriseId_fkey` FOREIGN KEY (`enterpriseId`) REFERENCES `enterprises`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `account_pool_bindings` ADD CONSTRAINT `account_pool_bindings_poolId_fkey` FOREIGN KEY (`poolId`) REFERENCES `account_pools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `account_pool_bindings` ADD CONSTRAINT `account_pool_bindings_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `ai_service_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `group_pool_bindings` ADD CONSTRAINT `group_pool_bindings_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `group_pool_bindings` ADD CONSTRAINT `group_pool_bindings_poolId_fkey` FOREIGN KEY (`poolId`) REFERENCES `account_pools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `group_resource_bindings` ADD CONSTRAINT `group_resource_bindings_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `group_account_bindings` ADD CONSTRAINT `group_account_bindings_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `group_account_bindings` ADD CONSTRAINT `group_account_bindings_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `ai_service_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `account_health_checks` ADD CONSTRAINT `account_health_checks_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `ai_service_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_enterprise_roles` ADD CONSTRAINT `user_enterprise_roles_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `enterprise_roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `enterprise_roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
