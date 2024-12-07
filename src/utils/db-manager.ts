import sqlite3 from 'sqlite3';
import { open, Database as SQLiteDatabase } from 'sqlite';
import { mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';

export interface FileInfo {
  path: string;
  size: number;
  mtime?: string;
  lastAccessed: number;
}

export interface BackupInfo {
  originalPath: string;
  backupPath: string;
  size: number;
  createdAt: number;
}

export interface DeletedFileInfo {
  path: string;
  deletedAt: number;
  backupPath: string;
  size: number;
}

interface FileRow {
  path: string;
  size: number;
  mtime: string | null;
  last_accessed: number;
}

interface BackupRow {
  id: number;
  backup_path: string;
  original_path: string;
  size: number;
  backup_time: number;
}

interface DeletedFileRow {
  path: string;
  deleted_at: number;
  backup_path: string;
  size: number;
}

export class DatabaseManager {
  private db: SQLiteDatabase | null = null;
  private dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || join(process.cwd(), 'db', 'screen_cut.db');
  }

  public async init(): Promise<void> {
    try {
      await this.initDatabase();
      await this.createTables();
      
      // 创建系统设置表
      await this.db?.run(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);
      
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }

  private async initDatabase(): Promise<void> {
    try {
      console.log('Initializing database at:', this.dbPath);
      
      // 确保数据库目录存在
      const dbDir = dirname(this.dbPath);
      await mkdir(dbDir, { recursive: true });
      
      // 打开数据库连接
      this.db = await open({
        filename: this.dbPath,
        driver: sqlite3.Database,
        mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE
      });
      
      console.log('Database opened successfully');
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    try {
      // 创建表
      await this.db?.exec(`
        CREATE TABLE IF NOT EXISTS files (
          path TEXT PRIMARY KEY,
          size INTEGER,
          mtime TEXT,
          last_accessed INTEGER
        );
        
        CREATE TABLE IF NOT EXISTS backups (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          original_path TEXT,
          backup_path TEXT,
          backup_time INTEGER,
          size INTEGER,
          FOREIGN KEY (original_path) REFERENCES files(path)
        );
        
        CREATE TABLE IF NOT EXISTS deleted_files (
          path TEXT PRIMARY KEY,
          deleted_at INTEGER,
          backup_path TEXT,
          size INTEGER
        );

        CREATE INDEX IF NOT EXISTS idx_deleted_at ON deleted_files(deleted_at);
        CREATE INDEX IF NOT EXISTS idx_backup_path ON deleted_files(backup_path);
        CREATE INDEX IF NOT EXISTS idx_original_path ON backups(original_path);
      `);
      
      console.log('Tables created successfully');
      
      // 验证表是否创建成功
      const tables = await this.db?.all("SELECT name FROM sqlite_master WHERE type='table'");
      console.log('Available tables:', tables);
    } catch (error) {
      console.error('Error creating tables:', error);
      throw error;
    }
  }

  async addFile(file: FileInfo): Promise<void> {
    try {
      if (!this.db) throw new Error('Database not initialized');

      console.log('Adding file to database:', file.path);
      await this.db?.run(
        'INSERT OR REPLACE INTO files (path, size, mtime, last_accessed) VALUES (?, ?, ?, ?)',
        [file.path, file.size, file.mtime, file.lastAccessed]
      );
      console.log('File added successfully');
      
      // 验证文件是否被添加
      const row = await this.db?.get('SELECT * FROM files WHERE path = ?', file.path);
      console.log('Verification - File in database:', row);
    } catch (error) {
      console.error('Error adding file:', error);
      throw error;
    }
  }

  async getFile(path: string): Promise<FileInfo | undefined> {
    try {
      if (!this.db) throw new Error('Database not initialized');

      const row = await this.db?.get<FileRow>('SELECT * FROM files WHERE path = ?', path);
      if (!row) return undefined;

      return {
        path: row.path,
        size: row.size,
        mtime: row.mtime || undefined,
        lastAccessed: row.last_accessed
      };
    } catch (error) {
      console.error('Error getting file:', error);
      throw error;
    }
  }

  async deleteFile(path: string): Promise<void> {
    try {
      if (!this.db) throw new Error('Database not initialized');

      const result = await this.db?.run('DELETE FROM files WHERE path = ?', path);
      if (result.changes === 0) {
        console.warn('No file found in database to delete:', path);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  async updateFileAccess(path: string, timestamp?: number): Promise<void> {
    try {
      if (!this.db) throw new Error('Database not initialized');

      await this.db?.run(
        'UPDATE files SET last_accessed = ? WHERE path = ?',
        [timestamp || Date.now(), path]
      );
    } catch (error) {
      console.error('Error updating file access:', error);
      throw error;
    }
  }

  async getFilesByDate(cutoffTime: number): Promise<FileInfo[]> {
    try {
      if (!this.db) throw new Error('Database not initialized');

      const rows = await this.db?.all<FileRow[]>(
        'SELECT * FROM files WHERE last_accessed < ?',
        cutoffTime
      );

      return rows.map(row => ({
        path: row.path,
        size: row.size,
        mtime: row.mtime || undefined,
        lastAccessed: row.last_accessed
      }));
    } catch (error) {
      console.error('Error getting files by date:', error);
      throw error;
    }
  }

  async getAllFiles(): Promise<FileInfo[]> {
    try {
      if (!this.db) throw new Error('Database not initialized');

      console.log('Getting all files from database...');
      console.log('Database path:', this.dbPath);
      
      // 检查表是否存在
      const tableExists = await this.db?.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='files'"
      );
      console.log('Files table exists:', !!tableExists);

      const rows = await this.db?.all<FileRow[]>('SELECT * FROM files');
      console.log(`Found ${rows.length} files in database`);
      if (rows.length > 0) {
        console.log('Sample file:', rows[0]);
      }
      
      return rows.map(row => ({
        path: row.path,
        size: row.size,
        mtime: row.mtime || undefined,
        lastAccessed: row.last_accessed
      }));
    } catch (error) {
      console.error('Error getting all files:', error);
      throw error;
    }
  }

  async addBackup(backup: BackupInfo): Promise<void> {
    try {
      if (!this.db) throw new Error('Database not initialized');

      await this.db?.run(
        'INSERT OR REPLACE INTO backups (backup_path, original_path, size, backup_time) VALUES (?, ?, ?, ?)',
        [backup.backupPath, backup.originalPath, backup.size, backup.createdAt]
      );
    } catch (error) {
      console.error('Error adding backup:', error);
      throw error;
    }
  }

  async getBackups(originalPath?: string): Promise<BackupInfo[]> {
    try {
      if (!this.db) throw new Error('Database not initialized');

      const query = originalPath
        ? 'SELECT * FROM backups WHERE original_path = ? ORDER BY backup_time DESC'
        : 'SELECT * FROM backups ORDER BY backup_time DESC';

      const params = originalPath ? [originalPath] : [];
      const rows = await this.db?.all(query, params);

      return rows.map(row => ({
        backupPath: row.backup_path,
        originalPath: row.original_path,
        size: row.size,
        createdAt: row.backup_time
      }));
    } catch (error) {
      console.error('Error getting backups:', error);
      throw error;
    }
  }

  async removeBackup(backupPath: string): Promise<void> {
    try {
      if (!this.db) throw new Error('Database not initialized');

      await this.db?.run('DELETE FROM backups WHERE backup_path = ?', [backupPath]);
    } catch (error) {
      console.error('Error removing backup:', error);
      throw error;
    }
  }

  async addDeletedFile(path: string, backupPath: string, size: number): Promise<void> {
    try {
      if (!this.db) throw new Error('Database not initialized');

      await this.db?.run(
        'INSERT OR REPLACE INTO deleted_files (path, deleted_at, backup_path, size) VALUES (?, ?, ?, ?)',
        [path, Date.now(), backupPath, size]
      );
    } catch (error) {
      console.error('Error adding deleted file:', error);
      throw error;
    }
  }

  async getRecentlyDeleted(limit: number = 50): Promise<Array<{path: string, deletedAt: number, backupPath: string, size: number}>> {
    try {
      if (!this.db) throw new Error('Database not initialized');

      const rows = await this.db?.all(
        'SELECT * FROM deleted_files ORDER BY deleted_at DESC LIMIT ?',
        limit
      );

      return rows.map(row => ({
        path: row.path,
        deletedAt: row.deleted_at,
        backupPath: row.backup_path,
        size: row.size
      }));
    } catch (error) {
      console.error('Error getting recently deleted files:', error);
      throw error;
    }
  }

  async removeFromDeletedFiles(path: string): Promise<void> {
    try {
      if (!this.db) throw new Error('Database not initialized');

      await this.db?.run('DELETE FROM deleted_files WHERE path = ?', path);
    } catch (error) {
      console.error('Error removing from deleted files:', error);
      throw error;
    }
  }

  /**
   * 获取最近删除的文件列表
   */
  async getRecentlyDeletedFiles(): Promise<{ path: string; deletedAt: number }[]> {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      const result = await this.db?.all(`
        SELECT path, deleted_at as deletedAt
        FROM deleted_files
        ORDER BY deleted_at DESC
        LIMIT 100
      `);

      return result || [];
    } catch (error) {
      console.error('Error getting recently deleted files:', error);
      return [];
    }
  }

  /**
   * 压缩数据库
   */
  async vacuum(): Promise<void> {
    await this.db?.run('VACUUM');
  }

  /**
   * 获取系统设置
   */
  async getSetting(key: string): Promise<string | null> {
    try {
      if (!this.db) throw new Error('Database not initialized');
      
      const row = await this.db?.get('SELECT value FROM settings WHERE key = ?', [key]);
      return row ? row.value : null;
    } catch (error) {
      console.error('Error getting setting:', error);
      throw error;
    }
  }

  /**
   * 更新系统设置
   */
  async setSetting(key: string, value: string): Promise<void> {
    try {
      if (!this.db) throw new Error('Database not initialized');
      
      await this.db?.run(`
        INSERT OR REPLACE INTO settings (key, value, updated_at)
        VALUES (?, ?, ?)
      `, [key, value, Date.now()]);
    } catch (error) {
      console.error('Error setting setting:', error);
      throw error;
    }
  }

  /**
   * 获取上次清理时间
   */
  async getLastCleanupTime(): Promise<number> {
    const lastCleanupTime = await this.getSetting('lastCleanupTime');
    return lastCleanupTime ? parseInt(lastCleanupTime, 10) : 0;
  }

  /**
   * 更新上次清理时间
   */
  async updateLastCleanupTime(): Promise<void> {
    await this.setSetting('lastCleanupTime', Date.now().toString());
  }
}
