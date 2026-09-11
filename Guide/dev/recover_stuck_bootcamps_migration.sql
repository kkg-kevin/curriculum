-- Recovery script for a Dev database left in a partially-migrated state after
-- 20260911150000_create_bootcamps.js crashed mid-run. Symptom: app log shows
-- "Table 'bootcamps' already exists" (ER_TABLE_EXISTS_ERROR) on every restart — the table
-- itself was created successfully (MySQL commits DDL immediately, no rollback on a later
-- crash), but the migration never finished, so Knex retries the whole thing from scratch
-- and fails at the first step every time.
--
-- Safe to run as-is and safe to re-run: every step checks the CURRENT state first and only
-- acts if that step didn't complete. Step 2 (copying rows) only runs while curricula.saleTagline
-- etc. still exist — if step 3 (dropping those columns) already ran before the crash, the copy
-- must have already finished too (it always runs before the column drop in the original
-- migration), so step 2 safely no-ops in that case instead of erroring on a missing column.
--
-- Usage: paste this whole file into phpMyAdmin's SQL tab (or `mysql < ...`) against Dev's
-- database, run it once, then restart the cPanel Node app.

-- 1. Release the stuck migration lock (harmless if already clear).
UPDATE knex_migrations_lock SET is_locked = 0;

-- 2. Copy every existing for-sale Event-curriculum into `bootcamps`, ONLY if the source sale
--    columns still exist on curricula (i.e. step 3 below hasn't run yet) AND only for curricula
--    that don't already have a bootcamps row linked to them — safe to re-run even if the
--    original migration got partway through this loop before crashing.
SET @saleTagline_exists = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'curricula' AND column_name = 'saleTagline');
SET @sql = IF(@saleTagline_exists = 1,
  'INSERT INTO bootcamps
     (id, ownerAdminId, eventId, name, description, tagline, coverImage, format, durationLabel,
      ageMin, ageMax, priceAmount, priceCurrency, priceNote, highlights, saleStatus, createdAt, updatedAt)
   SELECT
     UUID(), c.ownerAdminId, c.id, c.name, c.description, c.saleTagline, c.coverImage, c.saleFormat,
     c.durationLabel, c.ageMin, c.ageMax, c.priceAmount, c.priceCurrency, c.priceNote, c.highlights,
     c.saleStatus, c.createdAt, c.updatedAt
   FROM curricula c
   WHERE c.isEvent = 1
     AND c.saleStatus = ''for_sale''
     AND NOT EXISTS (SELECT 1 FROM bootcamps b WHERE b.eventId = c.id)',
  'SELECT "2. sale columns already dropped — row copy already completed before the crash, skipping" AS note');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Drop the 11 sale/marketing columns from `curricula`, ONLY if they're still present
--    (skips cleanly if this step already completed before the crash).
SET @saleStatus_exists = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'curricula' AND column_name = 'saleStatus');
SET @sql = IF(@saleStatus_exists = 1,
  'ALTER TABLE curricula
     DROP COLUMN saleStatus,
     DROP COLUMN coverImage,
     DROP COLUMN priceAmount,
     DROP COLUMN priceCurrency,
     DROP COLUMN priceNote,
     DROP COLUMN saleTagline,
     DROP COLUMN saleFormat,
     DROP COLUMN durationLabel,
     DROP COLUMN ageMin,
     DROP COLUMN ageMax,
     DROP COLUMN highlights',
  'SELECT "3. sale columns already dropped from curricula — skipping" AS note');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. Mark the migration as applied, ONLY if it isn't already recorded — otherwise Knex
--    retries it from scratch on next boot and immediately hits "Table already exists" again.
SET @already_recorded = (SELECT COUNT(*) FROM knex_migrations
                          WHERE name = '20260911150000_create_bootcamps.js');
SET @next_batch = (SELECT IFNULL(MAX(batch), 0) + 1 FROM knex_migrations);
SET @sql = IF(@already_recorded = 0,
  CONCAT('INSERT INTO knex_migrations (name, batch, migration_time) VALUES (''20260911150000_create_bootcamps.js'', ', @next_batch, ', NOW())'),
  'SELECT "4. bootcamps migration already recorded — skipping" AS note');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 5. Verify final state before restarting the app.
SELECT
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'bootcamps') AS bootcamps_table_exists,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'curricula' AND column_name = 'saleStatus') AS curricula_saleStatus_should_be_0,
  (SELECT COUNT(*) FROM bootcamps) AS bootcamps_row_count,
  (SELECT COUNT(*) FROM knex_migrations WHERE name = '20260911150000_create_bootcamps.js') AS migration_recorded_should_be_1,
  (SELECT is_locked FROM knex_migrations_lock LIMIT 1) AS lock_should_be_0;

-- After this returns bootcamps_table_exists=1, curricula_saleStatus_should_be_0=0,
-- migration_recorded_should_be_1=1, lock_should_be_0=0 — restart the Node app.
-- bootcamps_row_count should roughly match how many for-sale Event-curricula existed on Dev
-- before this release (check it looks reasonable — not 0 if you expected existing bootcamps
-- to carry over, and not obviously duplicated).
