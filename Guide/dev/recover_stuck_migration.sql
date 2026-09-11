-- Recovery script for a Dev database left in a partially-migrated state after the
-- 20260911100000_rename_program_to_event.js migration crashed mid-run (MySQL commits each
-- DDL statement immediately — a mid-migration crash does NOT roll back statements that
-- already ran, unlike Postgres). Safe to run as-is: every step only fires if the target
-- table/column is missing, so re-running this after a partial success just skips what's
-- already done. Run this BEFORE restarting the Node app.
--
-- Usage: paste this whole file into phpMyAdmin's SQL tab (or `mysql < recover_stuck_migration.sql`)
-- against Dev's database, run it once, then restart the cPanel Node app.

-- 1. Release the stuck migration lock — this is what's producing every
--    "MigrationLocked: Migration table is already locked" error in the app log.
UPDATE knex_migrations_lock SET is_locked = 0;

-- 2. Finish 20260911100000_rename_program_to_event.js if it only partially applied.
--    Each block below checks the CURRENT state and only acts if that specific step
--    never completed.

-- 2a. Table rename: programs -> events (skip if already renamed, or already done)
SET @programs_exists := (SELECT COUNT(*) FROM information_schema.tables
                          WHERE table_schema = DATABASE() AND table_name = 'programs');
SET @events_exists := (SELECT COUNT(*) FROM information_schema.tables
                        WHERE table_schema = DATABASE() AND table_name = 'events');
SET @sql := IF(@programs_exists = 1 AND @events_exists = 0,
  'RENAME TABLE programs TO events',
  'SELECT "2a. table rename: already applied or programs table not found — skipping" AS note');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2b. Column rename: curricula.isProgram -> isEvent (skip if already renamed)
SET @isProgram_exists := (SELECT COUNT(*) FROM information_schema.columns
                           WHERE table_schema = DATABASE() AND table_name = 'curricula' AND column_name = 'isProgram');
SET @isEvent_exists := (SELECT COUNT(*) FROM information_schema.columns
                         WHERE table_schema = DATABASE() AND table_name = 'curricula' AND column_name = 'isEvent');
SET @sql := IF(@isProgram_exists = 1 AND @isEvent_exists = 0,
  'ALTER TABLE curricula CHANGE isProgram isEvent TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT "2b. curricula.isProgram->isEvent: already applied or column not found — skipping" AS note');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2c. Column rename: competitions.programId -> eventId (skip if already renamed, or if
--     the competitions table doesn't exist yet on this Dev DB for some other reason)
SET @programId_exists := (SELECT COUNT(*) FROM information_schema.columns
                           WHERE table_schema = DATABASE() AND table_name = 'competitions' AND column_name = 'programId');
SET @eventId_exists := (SELECT COUNT(*) FROM information_schema.columns
                         WHERE table_schema = DATABASE() AND table_name = 'competitions' AND column_name = 'eventId');
SET @sql := IF(@programId_exists = 1 AND @eventId_exists = 0,
  'ALTER TABLE competitions CHANGE programId eventId CHAR(36)',
  'SELECT "2c. competitions.programId->eventId: already applied or column not found — skipping" AS note');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Mark 20260911100000_rename_program_to_event.js as applied in knex_migrations, ONLY if
--    it isn't already recorded there — otherwise Knex would try to run it again from
--    scratch on next boot and fail because the tables/columns are already renamed.
SET @already_recorded := (SELECT COUNT(*) FROM knex_migrations
                           WHERE name = '20260911100000_rename_program_to_event.js');
SET @next_batch := (SELECT IFNULL(MAX(batch), 0) + 1 FROM knex_migrations);
SET @sql := IF(@already_recorded = 0,
  CONCAT('INSERT INTO knex_migrations (name, batch, migration_time) VALUES (''20260911100000_rename_program_to_event.js'', ', @next_batch, ', NOW())'),
  'SELECT "3. rename migration already recorded — skipping" AS note');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. Verify final state before restarting the app.
SELECT
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'events') AS events_table_exists,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'programs') AS programs_table_still_exists_should_be_0,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'curricula' AND column_name = 'isEvent') AS curricula_isEvent_exists,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'competitions' AND column_name = 'eventId') AS competitions_eventId_exists,
  (SELECT is_locked FROM knex_migrations_lock LIMIT 1) AS lock_should_be_0;

-- After this returns events_table_exists=1, programs_table_still_exists_should_be_0=0,
-- curricula_isEvent_exists=1, competitions_eventId_exists=1, lock_should_be_0=0 — restart
-- the Node app. It will then run 20260911150000_create_bootcamps.js itself on boot (that
-- one is untouched by this recovery script, since it never got a chance to run yet — it's
-- the next migration in the batch after the one that crashed).
