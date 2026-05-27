-- 一次性数据迁移：把历史 dingtalk / wecom 通知记录归并到 lark / email
-- 配套代码改动：渠道枚举从 (lark, dingtalk, wecom, email) 简化为 (lark, email)
--
-- 跑前先备份：
--   cp prisma/dev.db prisma/dev.db.bak
--
-- 跑：
--   sqlite3 prisma/dev.db < prisma/migrate-channels-to-lark-email.sql
--
-- 跑完会输出迁移前后的通道分布对比。

SELECT '== BEFORE ==' AS step;
SELECT channel, COUNT(*) AS cnt FROM Notification GROUP BY channel ORDER BY channel;

-- 两条 UPDATE 包成事务，避免中途崩溃留下半迁状态
BEGIN TRANSACTION;

-- dingtalk → lark （IM 类合并到飞书）
UPDATE Notification SET channel = 'lark' WHERE channel = 'dingtalk';

-- wecom → email （或按需改成 lark，看产品决策）
UPDATE Notification SET channel = 'email' WHERE channel = 'wecom';

COMMIT;

SELECT '== AFTER ==' AS step;
SELECT channel, COUNT(*) AS cnt FROM Notification GROUP BY channel ORDER BY channel;
