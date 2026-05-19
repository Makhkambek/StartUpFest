-- ============================================================================
-- TEST SEED · 60 команд (15 × 4 категории) с префиксом [TEST]
-- ============================================================================
-- Запуск:
--   1) Открыть Supabase Studio → SQL Editor → New query → вставить и Run
--   2) Или через CLI: psql "$DATABASE_URL" -f supabase/seed_test_teams.sql
--   3) Или через npm-скрипт: npm run seed:teams
--
-- Удаление всех тестовых команд:
--   DELETE FROM teams WHERE name LIKE '[TEST]%';
--
-- Идемпотентно: ON CONFLICT (id) DO NOTHING — можно запускать многократно.
-- UUID-шаблоны: aa…NN (Cat A), bb…NN (Cat B), cc…NN (Cat C), dd…NN (Cat D)
-- ============================================================================

-- ── Category A · Line Follower ──────────────────────────────────────────────
INSERT INTO teams (id, category, name, school, group_letter) VALUES
('aa000000-0000-0000-0000-000000000001','a','[TEST] LineRacer X',    'Maktab №1, Toshkent',         NULL),
('aa000000-0000-0000-0000-000000000002','a','[TEST] BlackTrack Pro', 'Litsey №2, Samarqand',        NULL),
('aa000000-0000-0000-0000-000000000003','a','[TEST] SwiftBot',       'IT Kolej, Namangan',          NULL),
('aa000000-0000-0000-0000-000000000004','a','[TEST] Phantom Line',   'Prezident Maktabi, Toshkent', NULL),
('aa000000-0000-0000-0000-000000000005','a','[TEST] TrackMaster',    'Texnika Litsey, Buxoro',      NULL),
('aa000000-0000-0000-0000-000000000006','a','[TEST] PrecisionPro',   'Raqamli Litsey, Andijon',     NULL),
('aa000000-0000-0000-0000-000000000007','a','[TEST] LineKnight',     'Maktab №45, Farg''ona',       NULL),
('aa000000-0000-0000-0000-000000000008','a','[TEST] ZeroError',      'STEAM Litsey, Nukus',         NULL),
('aa000000-0000-0000-0000-000000000009','a','[TEST] PathFinder V2',  'Litsey №3, Termiz',           NULL),
('aa000000-0000-0000-0000-000000000010','a','[TEST] NightRider',     'IT Kolej, Qarshi',            NULL),
('aa000000-0000-0000-0000-000000000011','a','[TEST] AutoLine Alpha', 'Fizmat Litsey, Jizzax',       NULL),
('aa000000-0000-0000-0000-000000000012','a','[TEST] QuickTrace',     'Texnopark, Navoiy',           NULL),
('aa000000-0000-0000-0000-000000000013','a','[TEST] SensorX',        'Innovatsiya Maktabi, Urgench',NULL),
('aa000000-0000-0000-0000-000000000014','a','[TEST] GridRunner',     'Maktab №88, Toshkent',        NULL),
('aa000000-0000-0000-0000-000000000015','a','[TEST] TurboPath',      'San''at Litsey, Samarqand',   NULL)
ON CONFLICT (id) DO NOTHING;

-- ── Category B · Mini Sumo (с group_letter A–F циклично) ────────────────────
INSERT INTO teams (id, category, name, school, group_letter) VALUES
('bb000000-0000-0000-0000-000000000001','b','[TEST] Iron Pusher',    'Maktab №1, Toshkent',         'A'),
('bb000000-0000-0000-0000-000000000002','b','[TEST] SumoKing',       'Litsey №2, Samarqand',        'B'),
('bb000000-0000-0000-0000-000000000003','b','[TEST] RingMaster',     'IT Kolej, Namangan',          'C'),
('bb000000-0000-0000-0000-000000000004','b','[TEST] BullBot',        'Prezident Maktabi, Toshkent', 'D'),
('bb000000-0000-0000-0000-000000000005','b','[TEST] TitanForce',     'Texnika Litsey, Buxoro',      'E'),
('bb000000-0000-0000-0000-000000000006','b','[TEST] BlackBull',      'Raqamli Litsey, Andijon',     'F'),
('bb000000-0000-0000-0000-000000000007','b','[TEST] EdgePusher',     'Maktab №45, Farg''ona',       'A'),
('bb000000-0000-0000-0000-000000000008','b','[TEST] DomBot',         'STEAM Litsey, Nukus',         'B'),
('bb000000-0000-0000-0000-000000000009','b','[TEST] SteelWall',      'Litsey №3, Termiz',           'C'),
('bb000000-0000-0000-0000-000000000010','b','[TEST] ViperSumo',      'IT Kolej, Qarshi',            'D'),
('bb000000-0000-0000-0000-000000000011','b','[TEST] RamBot',         'Fizmat Litsey, Jizzax',       'E'),
('bb000000-0000-0000-0000-000000000012','b','[TEST] SumoX Pro',      'Texnopark, Navoiy',           'F'),
('bb000000-0000-0000-0000-000000000013','b','[TEST] FortressBot',    'Innovatsiya Maktabi, Urgench','A'),
('bb000000-0000-0000-0000-000000000014','b','[TEST] ThunderPush',    'Maktab №88, Toshkent',        'B'),
('bb000000-0000-0000-0000-000000000015','b','[TEST] IronShield',     'San''at Litsey, Samarqand',   'C')
ON CONFLICT (id) DO NOTHING;

-- ── Category C · MiniRoboWar ────────────────────────────────────────────────
INSERT INTO teams (id, category, name, school, group_letter) VALUES
('cc000000-0000-0000-0000-000000000001','c','[TEST] Destroyer X',    'Maktab №1, Toshkent',         NULL),
('cc000000-0000-0000-0000-000000000002','c','[TEST] IronFist',       'Litsey №2, Samarqand',        NULL),
('cc000000-0000-0000-0000-000000000003','c','[TEST] WarMachine',     'IT Kolej, Namangan',          NULL),
('cc000000-0000-0000-0000-000000000004','c','[TEST] ChaosBot',       'Prezident Maktabi, Toshkent', NULL),
('cc000000-0000-0000-0000-000000000005','c','[TEST] ThunderStrike',  'Texnika Litsey, Buxoro',      NULL),
('cc000000-0000-0000-0000-000000000006','c','[TEST] VenomBot',       'Raqamli Litsey, Andijon',     NULL),
('cc000000-0000-0000-0000-000000000007','c','[TEST] RamPage',        'Maktab №45, Farg''ona',       NULL),
('cc000000-0000-0000-0000-000000000008','c','[TEST] TitanWar',       'STEAM Litsey, Nukus',         NULL),
('cc000000-0000-0000-0000-000000000009','c','[TEST] KillerBot V3',   'Litsey №3, Termiz',           NULL),
('cc000000-0000-0000-0000-000000000010','c','[TEST] CrushMaster',    'IT Kolej, Qarshi',            NULL),
('cc000000-0000-0000-0000-000000000011','c','[TEST] StormBot',       'Fizmat Litsey, Jizzax',       NULL),
('cc000000-0000-0000-0000-000000000012','c','[TEST] BattleAxe',      'Texnopark, Navoiy',           NULL),
('cc000000-0000-0000-0000-000000000013','c','[TEST] CyberPunch',     'Innovatsiya Maktabi, Urgench',NULL),
('cc000000-0000-0000-0000-000000000014','c','[TEST] DeathRoller',    'Maktab №88, Toshkent',        NULL),
('cc000000-0000-0000-0000-000000000015','c','[TEST] Havoc',          'San''at Litsey, Samarqand',   NULL)
ON CONFLICT (id) DO NOTHING;

-- ── Category D · Robo Football ──────────────────────────────────────────────
INSERT INTO teams (id, category, name, school, group_letter) VALUES
('dd000000-0000-0000-0000-000000000001','d','[TEST] RoboFC',         'Maktab №1, Toshkent',         NULL),
('dd000000-0000-0000-0000-000000000002','d','[TEST] TechStrikers',   'Litsey №2, Samarqand',        NULL),
('dd000000-0000-0000-0000-000000000003','d','[TEST] Dynamo Bot',     'IT Kolej, Namangan',          NULL),
('dd000000-0000-0000-0000-000000000004','d','[TEST] IronKickers',    'Prezident Maktabi, Toshkent', NULL),
('dd000000-0000-0000-0000-000000000005','d','[TEST] GearGoals',      'Texnika Litsey, Buxoro',      NULL),
('dd000000-0000-0000-0000-000000000006','d','[TEST] CircuitFC',      'Raqamli Litsey, Andijon',     NULL),
('dd000000-0000-0000-0000-000000000007','d','[TEST] RoboUnited',     'Maktab №45, Farg''ona',       NULL),
('dd000000-0000-0000-0000-000000000008','d','[TEST] ByteFC',         'STEAM Litsey, Nukus',         NULL),
('dd000000-0000-0000-0000-000000000009','d','[TEST] PixelKick',      'Litsey №3, Termiz',           NULL),
('dd000000-0000-0000-0000-000000000010','d','[TEST] BinaryFC',       'IT Kolej, Qarshi',            NULL),
('dd000000-0000-0000-0000-000000000011','d','[TEST] RoboAthletic',   'Fizmat Litsey, Jizzax',       NULL),
('dd000000-0000-0000-0000-000000000012','d','[TEST] TechMadrid',     'Texnopark, Navoiy',           NULL),
('dd000000-0000-0000-0000-000000000013','d','[TEST] MotorCity FC',   'Innovatsiya Maktabi, Urgench',NULL),
('dd000000-0000-0000-0000-000000000014','d','[TEST] SensorSport',    'Maktab №88, Toshkent',        NULL),
('dd000000-0000-0000-0000-000000000015','d','[TEST] AutoGoal',       'San''at Litsey, Samarqand',   NULL)
ON CONFLICT (id) DO NOTHING;

-- ── Verify ──────────────────────────────────────────────────────────────────
-- SELECT category, COUNT(*) FROM teams WHERE name LIKE '[TEST]%' GROUP BY category ORDER BY category;
-- Expected: a=15, b=15, c=15, d=15
