import BetterSqlite3 from 'better-sqlite3';
import { nanoid } from 'nanoid';

export class Database {
  private db: BetterSqlite3.Database | null = null;
  
  async initialize(): Promise<void> {
    this.db = new BetterSqlite3('game.db');
    
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
      
      CREATE TABLE IF NOT EXISTS balances (
        user_id TEXT PRIMARY KEY,
        amount INTEGER DEFAULT 0,
        updated_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_users_name ON users(name);
    `);
    
    console.log('Database initialized');
  }
  
  createUser(name: string): string {
    if (!this.db) throw new Error('Database not initialized');
    
    const id = nanoid();
    
    const stmt = this.db.prepare('INSERT INTO users (id, name) VALUES (?, ?)');
    stmt.run(id, name);
    
    const balanceStmt = this.db.prepare('INSERT INTO balances (user_id, amount) VALUES (?, ?)');
    balanceStmt.run(id, 0);
    
    return id;
  }
  
  getUser(id: string): { id: string; name: string } | null {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare('SELECT id, name FROM users WHERE id = ?');
    return stmt.get(id) as { id: string; name: string } | null;
  }
  
  addCurrency(userId: string, amount: number): void {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare(`
      UPDATE balances 
      SET amount = amount + ?, 
          updated_at = strftime('%s', 'now')
      WHERE user_id = ?
    `);
    
    stmt.run(amount, userId);
  }
  
  getCurrency(userId: string): number {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare('SELECT amount FROM balances WHERE user_id = ?');
    const result = stmt.get(userId) as { amount: number } | undefined;
    
    return result?.amount ?? 0;
  }
  
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}