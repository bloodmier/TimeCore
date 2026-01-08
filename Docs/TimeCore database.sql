-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Värd: 10.0.21.101:3307
-- Tid vid skapande: 08 jan 2026 kl 13:50
-- Serverversion: 12.1.2-MariaDB-ubu2404
-- PHP-version: 8.3.28

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Databas: `test`
--

-- --------------------------------------------------------

--
-- Tabellstruktur `articles`
--

CREATE TABLE `articles` (
  `id` int(11) NOT NULL,
  `art_nr` varchar(100) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `purchase_price` decimal(10,2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

--
-- Dumpning av Data i tabell `articles`
--

INSERT INTO `articles` (`id`, `art_nr`, `name`, `description`, `purchase_price`, `created_at`) VALUES
(1, '87', 'Other', NULL, NULL, '2025-10-01 06:47:24'),
(4, '234', 'test', 'bra produkt', 500.00, '2025-11-11 13:41:56');

-- --------------------------------------------------------

--
-- Tabellstruktur `customer`
--

CREATE TABLE `customer` (
  `id` int(10) UNSIGNED NOT NULL,
  `customer_id` varchar(50) DEFAULT NULL,
  `company` varchar(500) NOT NULL,
  `last_used` datetime DEFAULT NULL,
  `billing_owner` tinyint(1) NOT NULL DEFAULT 0,
  `customer_owner` int(10) UNSIGNED DEFAULT NULL,
  `bill_direct` tinyint(1) NOT NULL DEFAULT 0,
  `include_attachments_on_send` tinyint(4) NOT NULL DEFAULT 0,
  `hourly_rate` decimal(10,2) DEFAULT NULL,
  `currency` enum('SEK','EUR','USD','GBP','NOK','DKK','CHF','PLN','CZK','HUF','JPY','CNY','CAD','AUD','NZD') NOT NULL DEFAULT 'SEK',
  `language` enum('sv','en') NOT NULL DEFAULT 'sv'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

--
-- Dumpning av Data i tabell `customer`
--

INSERT INTO `customer` (`id`, `customer_id`, `company`, `last_used`, `billing_owner`, `customer_owner`, `bill_direct`, `include_attachments_on_send`, `hourly_rate`, `currency`, `language`) VALUES
(1, NULL, 'TimeCore AB', '2025-12-30 10:08:46', 1, NULL, 0, 0, 1100.00, 'SEK', 'sv'),
(4, '1', 'Grenborgs AB', '2025-12-30 13:38:11', 0, 1, 1, 0, NULL, 'SEK', 'sv'),
(5, 'BILL-002', 'Gris AB', '2025-12-11 13:38:47', 1, NULL, 0, 0, NULL, 'SEK', 'sv'),
(6, NULL, 'Gryuu', NULL, 0, 5, 0, 0, NULL, 'SEK', 'sv'),
(11, '2', 'Försäkringskassan', '2025-12-30 13:38:11', 0, NULL, 0, 0, NULL, 'SEK', 'sv'),
(46, '3', 'Test', '2025-12-30 13:38:11', 0, 1, 1, 0, NULL, 'SEK', 'sv'),
(323, '4', 'Test 2', '2025-12-30 13:38:11', 0, 1, 1, 0, NULL, 'SEK', 'sv'),
(324, '5', 'Test 3', '2025-12-30 13:38:11', 0, 5, 0, 0, NULL, 'SEK', 'sv');

-- --------------------------------------------------------

--
-- Tabellstruktur `customer_email`
--

CREATE TABLE `customer_email` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `customer_id` int(10) UNSIGNED NOT NULL,
  `email` varchar(320) NOT NULL,
  `send_pdf` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- --------------------------------------------------------

--
-- Tabellstruktur `password_reset_tokens`
--

CREATE TABLE `password_reset_tokens` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `token_hash` char(64) NOT NULL,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- --------------------------------------------------------

--
-- Tabellstruktur `project`
--

CREATE TABLE `project` (
  `id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `projectname` varchar(500) NOT NULL,
  `last_active` date NOT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `archived_at` datetime DEFAULT NULL,
  `status` enum('active','archived','deleted') NOT NULL DEFAULT 'active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

--
-- Dumpning av Data i tabell `project`
--

INSERT INTO `project` (`id`, `customer_id`, `projectname`, `last_active`, `deleted_at`, `archived_at`, `status`) VALUES
(6, 5, 'Website Redesign', '2025-09-20', NULL, NULL, 'active'),
(7, 39, 'Mobile App', '2025-09-22', NULL, NULL, 'active'),
(8, 40, 'Internal CRM', '2025-09-18', NULL, NULL, 'active'),
(9, 41, 'Marketing Campaign', '2025-09-25', NULL, NULL, 'active');

-- --------------------------------------------------------

--
-- Tabellstruktur `tenants`
--

CREATE TABLE `tenants` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(150) NOT NULL,
  `org_number` varchar(50) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `customer_id` int(10) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

--
-- Dumpning av Data i tabell `tenants`
--

INSERT INTO `tenants` (`id`, `name`, `org_number`, `created_at`, `updated_at`, `customer_id`) VALUES
(1, 'TimeCore AB', '559123-4567', '2025-12-02 09:38:22', '2025-12-10 15:36:30', 1),
(2, 'DevSolutions Sverige AB', '556987-6543', '2025-12-02 09:38:22', '2025-12-02 09:38:22', NULL),
(3, 'Nordic Projekt & Data AB', '556321-7788', '2025-12-02 09:38:22', '2025-12-02 09:38:22', NULL);

-- --------------------------------------------------------

--
-- Tabellstruktur `time_report`
--

CREATE TABLE `time_report` (
  `id` int(11) NOT NULL,
  `user` int(10) UNSIGNED DEFAULT NULL,
  `customer_id` int(10) UNSIGNED NOT NULL,
  `note` varchar(1500) NOT NULL,
  `work_labor` varchar(500) NOT NULL,
  `category` int(11) NOT NULL,
  `modified` date NOT NULL DEFAULT current_timestamp(),
  `date` date NOT NULL,
  `hours` decimal(5,2) NOT NULL,
  `billable` tinyint(4) NOT NULL DEFAULT 1,
  `project_id` int(11) DEFAULT NULL,
  `created_date` date NOT NULL DEFAULT current_timestamp(),
  `billed` int(11) DEFAULT NULL,
  `invoice_number` varchar(25) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `modified_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- --------------------------------------------------------

--
-- Tabellstruktur `time_report_categories`
--

CREATE TABLE `time_report_categories` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

--
-- Dumpning av Data i tabell `time_report_categories`
--

INSERT INTO `time_report_categories` (`id`, `name`) VALUES
(1, 'Support'),
(2, 'Infra/Drift'),
(3, 'Projekt'),
(4, 'Administration'),
(6, 'sick'),
(7, 'vacation');

-- --------------------------------------------------------

--
-- Tabellstruktur `time_report_draft`
--

CREATE TABLE `time_report_draft` (
  `id` int(11) NOT NULL,
  `user` int(10) UNSIGNED DEFAULT NULL,
  `customer_id` varchar(50) NOT NULL,
  `note` varchar(150) NOT NULL,
  `work_labor` varchar(500) NOT NULL,
  `category` int(11) NOT NULL,
  `modified` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `date` date NOT NULL,
  `hours` decimal(5,2) NOT NULL,
  `billable` tinyint(4) NOT NULL DEFAULT 1,
  `project_id` int(11) DEFAULT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- --------------------------------------------------------

--
-- Tabellstruktur `time_report_item`
--

CREATE TABLE `time_report_item` (
  `id` int(11) NOT NULL,
  `time_report_id` int(100) NOT NULL,
  `article_id` int(11) DEFAULT NULL,
  `amount` int(255) DEFAULT NULL,
  `purchase_price` decimal(10,2) DEFAULT NULL,
  `description` varchar(100) NOT NULL,
  `invoice_number` varchar(40) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- --------------------------------------------------------

--
-- Tabellstruktur `time_report_item_draft`
--

CREATE TABLE `time_report_item_draft` (
  `id` int(11) NOT NULL,
  `time_report_draft_id` int(11) NOT NULL,
  `article_id` int(11) DEFAULT NULL,
  `amount` int(255) DEFAULT NULL,
  `purchase_price` decimal(10,2) DEFAULT NULL,
  `description` varchar(100) NOT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- --------------------------------------------------------

--
-- Tabellstruktur `time_report_labor_templates`
--

CREATE TABLE `time_report_labor_templates` (
  `id` int(11) NOT NULL,
  `user` int(10) UNSIGNED DEFAULT NULL,
  `name` varchar(100) NOT NULL,
  `extended_description` varchar(200) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- --------------------------------------------------------

--
-- Tabellstruktur `time_report_templates`
--

CREATE TABLE `time_report_templates` (
  `id` int(11) NOT NULL,
  `user` int(10) UNSIGNED DEFAULT NULL,
  `name` varchar(150) NOT NULL,
  `customer_id` varchar(50) NOT NULL,
  `note` varchar(150) NOT NULL,
  `work_labor` varchar(500) NOT NULL,
  `category` int(11) NOT NULL,
  `modified` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `date` date NOT NULL,
  `hours` decimal(5,2) NOT NULL,
  `billable` tinyint(4) NOT NULL DEFAULT 1,
  `project_id` int(11) DEFAULT NULL,
  `created_date` datetime NOT NULL DEFAULT current_timestamp(),
  `items` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- --------------------------------------------------------

--
-- Tabellstruktur `time_report_user_company_usage`
--

CREATE TABLE `time_report_user_company_usage` (
  `user_id` int(10) UNSIGNED NOT NULL,
  `customer_id` int(10) UNSIGNED NOT NULL,
  `last_used` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- --------------------------------------------------------

--
-- Tabellstruktur `users`
--

CREATE TABLE `users` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(150) NOT NULL,
  `email` varchar(255) NOT NULL,
  `avatar_url` varchar(512) DEFAULT NULL,
  `tenant_id` int(10) UNSIGNED NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `deleted_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `level_id` int(10) UNSIGNED DEFAULT NULL,
  `role` enum('user','admin') NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- --------------------------------------------------------

--
-- Tabellstruktur `user_pricing_levels`
--

CREATE TABLE `user_pricing_levels` (
  `id` int(10) UNSIGNED NOT NULL,
  `level_name` varchar(50) NOT NULL,
  `hourly_rate` decimal(10,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

--
-- Dumpning av Data i tabell `user_pricing_levels`
--

INSERT INTO `user_pricing_levels` (`id`, `level_name`, `hourly_rate`, `created_at`) VALUES
(1, 'Level 1', 800.00, '2025-11-05 10:15:32'),
(2, 'Level 2', 1000.00, '2025-11-05 10:15:32'),
(3, 'Level 3', 1200.00, '2025-11-05 10:15:32');

-- --------------------------------------------------------

--
-- Tabellstruktur `user_tokens`
--

CREATE TABLE `user_tokens` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `refresh_token_hash` varchar(255) NOT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `revoked_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- --------------------------------------------------------

--
-- Tabellstruktur `worklog_pdf`
--

CREATE TABLE `worklog_pdf` (
  `id` bigint(20) NOT NULL,
  `invoice_id` bigint(20) DEFAULT NULL,
  `customer_id` bigint(20) DEFAULT NULL,
  `invoice_number` varchar(32) DEFAULT NULL,
  `period_from` date DEFAULT NULL,
  `period_to` date DEFAULT NULL,
  `file_name` varchar(255) NOT NULL,
  `mime` varchar(100) NOT NULL DEFAULT 'application/pdf',
  `size_bytes` bigint(20) NOT NULL,
  `sha256_hex` char(64) DEFAULT NULL,
  `data` longblob NOT NULL,
  `fortnox_archive_file_id` varchar(64) DEFAULT NULL,
  `fortnox_connected_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- --------------------------------------------------------

--
-- Tabellstruktur `worklog_pdf_job`
--

CREATE TABLE `worklog_pdf_job` (
  `id` bigint(20) NOT NULL,
  `invoice_id` bigint(20) NOT NULL,
  `invoice_number` varchar(32) DEFAULT NULL,
  `status` enum('queued','processing','done','failed') NOT NULL DEFAULT 'queued',
  `attempts` int(11) NOT NULL DEFAULT 0,
  `run_after` datetime NOT NULL DEFAULT current_timestamp(),
  `last_error` text DEFAULT NULL,
  `payload_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`payload_json`)),
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

--
-- Index för dumpade tabeller
--

--
-- Index för tabell `articles`
--
ALTER TABLE `articles`
  ADD PRIMARY KEY (`id`);

--
-- Index för tabell `customer`
--
ALTER TABLE `customer`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_customer_id` (`customer_id`),
  ADD UNIQUE KEY `customer_id` (`customer_id`),
  ADD KEY `idx_billing_owner` (`billing_owner`),
  ADD KEY `idx_customer_owner` (`customer_owner`);

--
-- Index för tabell `customer_email`
--
ALTER TABLE `customer_email`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_customer_email` (`customer_id`,`email`);

--
-- Index för tabell `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_password_reset_user` (`user_id`),
  ADD KEY `idx_token_hash` (`token_hash`),
  ADD KEY `idx_expires_at` (`expires_at`);

--
-- Index för tabell `project`
--
ALTER TABLE `project`
  ADD PRIMARY KEY (`id`);

--
-- Index för tabell `tenants`
--
ALTER TABLE `tenants`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_org_number` (`org_number`),
  ADD KEY `fk_tenant_customer` (`customer_id`);

--
-- Index för tabell `time_report`
--
ALTER TABLE `time_report`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user` (`user`),
  ADD KEY `project_id` (`project_id`) USING BTREE,
  ADD KEY `fk_time_report_customer` (`customer_id`),
  ADD KEY `fk_time_report_category` (`category`);

--
-- Index för tabell `time_report_categories`
--
ALTER TABLE `time_report_categories`
  ADD PRIMARY KEY (`id`);

--
-- Index för tabell `time_report_draft`
--
ALTER TABLE `time_report_draft`
  ADD PRIMARY KEY (`id`);

--
-- Index för tabell `time_report_item`
--
ALTER TABLE `time_report_item`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_time_report_hardware_time_report` (`time_report_id`),
  ADD KEY `fk_time_report_item_article` (`article_id`);

--
-- Index för tabell `time_report_item_draft`
--
ALTER TABLE `time_report_item_draft`
  ADD PRIMARY KEY (`id`),
  ADD KEY `time_report_draft_id` (`time_report_draft_id`);

--
-- Index för tabell `time_report_labor_templates`
--
ALTER TABLE `time_report_labor_templates`
  ADD PRIMARY KEY (`id`);

--
-- Index för tabell `time_report_templates`
--
ALTER TABLE `time_report_templates`
  ADD PRIMARY KEY (`id`);

--
-- Index för tabell `time_report_user_company_usage`
--
ALTER TABLE `time_report_user_company_usage`
  ADD PRIMARY KEY (`user_id`,`customer_id`),
  ADD KEY `customer_id` (`customer_id`);

--
-- Index för tabell `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_users_email` (`email`),
  ADD KEY `fk_users_level` (`level_id`),
  ADD KEY `fk_users_tenant` (`tenant_id`);

--
-- Index för tabell `user_pricing_levels`
--
ALTER TABLE `user_pricing_levels`
  ADD PRIMARY KEY (`id`);

--
-- Index för tabell `user_tokens`
--
ALTER TABLE `user_tokens`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_expires_at` (`expires_at`);

--
-- Index för tabell `worklog_pdf`
--
ALTER TABLE `worklog_pdf`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_worklog_pdf_invoice` (`invoice_id`);

--
-- Index för tabell `worklog_pdf_job`
--
ALTER TABLE `worklog_pdf_job`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_job_per_invoice` (`invoice_id`,`status`),
  ADD KEY `idx_worklog_pdf_job_status_time` (`status`,`run_after`);

--
-- AUTO_INCREMENT för dumpade tabeller
--

--
-- AUTO_INCREMENT för tabell `articles`
--
ALTER TABLE `articles`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT för tabell `customer`
--
ALTER TABLE `customer`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=370;

--
-- AUTO_INCREMENT för tabell `customer_email`
--
ALTER TABLE `customer_email`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT för tabell `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT för tabell `project`
--
ALTER TABLE `project`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT för tabell `tenants`
--
ALTER TABLE `tenants`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT för tabell `time_report`
--
ALTER TABLE `time_report`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT för tabell `time_report_categories`
--
ALTER TABLE `time_report_categories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT för tabell `time_report_draft`
--
ALTER TABLE `time_report_draft`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=30;

--
-- AUTO_INCREMENT för tabell `time_report_item`
--
ALTER TABLE `time_report_item`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT för tabell `time_report_item_draft`
--
ALTER TABLE `time_report_item_draft`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT för tabell `time_report_labor_templates`
--
ALTER TABLE `time_report_labor_templates`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT för tabell `time_report_templates`
--
ALTER TABLE `time_report_templates`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT för tabell `users`
--
ALTER TABLE `users`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT för tabell `user_pricing_levels`
--
ALTER TABLE `user_pricing_levels`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT för tabell `user_tokens`
--
ALTER TABLE `user_tokens`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT för tabell `worklog_pdf`
--
ALTER TABLE `worklog_pdf`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- AUTO_INCREMENT för tabell `worklog_pdf_job`
--
ALTER TABLE `worklog_pdf_job`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=104;

--
-- Restriktioner för dumpade tabeller
--

--
-- Restriktioner för tabell `customer`
--
ALTER TABLE `customer`
  ADD CONSTRAINT `fk_customer_owner` FOREIGN KEY (`customer_owner`) REFERENCES `customer` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Restriktioner för tabell `customer_email`
--
ALTER TABLE `customer_email`
  ADD CONSTRAINT `fk_customer_email_customer` FOREIGN KEY (`customer_id`) REFERENCES `customer` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Restriktioner för tabell `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  ADD CONSTRAINT `fk_password_reset_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Restriktioner för tabell `tenants`
--
ALTER TABLE `tenants`
  ADD CONSTRAINT `fk_tenant_customer` FOREIGN KEY (`customer_id`) REFERENCES `customer` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Restriktioner för tabell `time_report`
--
ALTER TABLE `time_report`
  ADD CONSTRAINT `fk_time_report_category` FOREIGN KEY (`category`) REFERENCES `time_report_categories` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_time_report_customer` FOREIGN KEY (`customer_id`) REFERENCES `customer` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_time_report_project` FOREIGN KEY (`project_id`) REFERENCES `project` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_time_report_user` FOREIGN KEY (`user`) REFERENCES `users` (`id`) ON UPDATE CASCADE;

--
-- Restriktioner för tabell `time_report_item`
--
ALTER TABLE `time_report_item`
  ADD CONSTRAINT `fk_time_report_hardware_time_report` FOREIGN KEY (`time_report_id`) REFERENCES `time_report` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_time_report_item_article` FOREIGN KEY (`article_id`) REFERENCES `articles` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Restriktioner för tabell `time_report_item_draft`
--
ALTER TABLE `time_report_item_draft`
  ADD CONSTRAINT `time_report_item_draft_ibfk_1` FOREIGN KEY (`time_report_draft_id`) REFERENCES `time_report_draft` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Restriktioner för tabell `time_report_user_company_usage`
--
ALTER TABLE `time_report_user_company_usage`
  ADD CONSTRAINT `time_report_user_company_usage_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `time_report_user_company_usage_ibfk_2` FOREIGN KEY (`customer_id`) REFERENCES `customer` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Restriktioner för tabell `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `fk_users_level` FOREIGN KEY (`level_id`) REFERENCES `user_pricing_levels` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_users_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON UPDATE CASCADE;

--
-- Restriktioner för tabell `user_tokens`
--
ALTER TABLE `user_tokens`
  ADD CONSTRAINT `fk_user_tokens_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
