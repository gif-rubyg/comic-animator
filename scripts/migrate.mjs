import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const conn = await mysql.createConnection(url);

const statements = [
  `CREATE TABLE IF NOT EXISTS \`projects\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`userId\` int NOT NULL,
    \`name\` varchar(255) NOT NULL DEFAULT 'Untitled Project',
    \`aspectRatio\` enum('9:16','4:3') NOT NULL DEFAULT '9:16',
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`projects_id\` PRIMARY KEY(\`id\`)
  )`,
  `CREATE TABLE IF NOT EXISTS \`panels\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`projectId\` int NOT NULL,
    \`order\` int NOT NULL DEFAULT 0,
    \`backgroundUrl\` text,
    \`duration\` float NOT NULL DEFAULT 3,
    \`transition\` enum('none','fade','slide-left','slide-right','zoom-in','zoom-out') NOT NULL DEFAULT 'fade',
    \`transitionDuration\` float NOT NULL DEFAULT 0.5,
    \`panZoom\` json,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`panels_id\` PRIMARY KEY(\`id\`)
  )`,
  `CREATE TABLE IF NOT EXISTS \`layers\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`panelId\` int NOT NULL,
    \`name\` varchar(255) NOT NULL DEFAULT 'Layer',
    \`imageUrl\` text,
    \`x\` float NOT NULL DEFAULT 0,
    \`y\` float NOT NULL DEFAULT 0,
    \`width\` float NOT NULL DEFAULT 30,
    \`height\` float NOT NULL DEFAULT 50,
    \`zIndex\` int NOT NULL DEFAULT 0,
    \`flipX\` int NOT NULL DEFAULT 0,
    \`animations\` json,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`layers_id\` PRIMARY KEY(\`id\`)
  )`,
];

for (const sql of statements) {
  try {
    await conn.execute(sql);
    console.log('✓ Executed:', sql.trim().split('\n')[0]);
  } catch (err) {
    console.error('✗ Error:', err.message);
  }
}

await conn.end();
console.log('Migration complete!');
