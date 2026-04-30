/**
 * Seed script — creates the 3 initial user accounts.
 * Run: node scripts/seed.mjs
 * Requires DATABASE_URL in .env
 */
import "dotenv/config";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

const users = [
  { email: "rubyg.lgd@gmail.com",   password: "Passw0rd000", name: "Ruby G",   role: "admin" },
  { email: "miniwleder@gmail.com",   password: "Passw0rd001", name: "Mini W",   role: "user" },
  { email: "rubylen20@gmail.com",    password: "Passw0rd002", name: "Ruby Len", role: "user" },
];

async function seed() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("ERROR: DATABASE_URL not set in .env");
    process.exit(1);
  }

  const conn = await mysql.createConnection(url);
  console.log("Connected to database.");

  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 12);
    try {
      await conn.execute(
        `INSERT INTO users (email, name, passwordHash, role)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name=VALUES(name), passwordHash=VALUES(passwordHash), role=VALUES(role)`,
        [u.email, u.name, hash, u.role]
      );
      console.log(`✓ Seeded: ${u.email} (${u.role})`);
    } catch (err) {
      console.error(`✗ Failed to seed ${u.email}:`, err.message);
    }
  }

  await conn.end();
  console.log("\nDone! All users seeded.");
}

seed().catch(console.error);
