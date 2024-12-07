import { copyFile, mkdir, unlink, readdir, stat } from 'fs/promises';
import { join, dirname, basename } from 'path';
import { DatabaseManager } from './db-manager.js';
import { existsSync } from 'fs';
import { CONFIG } from '../config/index.js';

interface CacheStats {
  totalSize: number;
  totalFiles: number;
  totalEntries: number;
  dateIndexSize: number;
  sizeIndexSize: number;
  tagIndexSize: number;
  memoryUsage: {
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  oldestCache: string | null;
  newestCache: string | null;
}

interface CacheInfo {
  path: string;
  size: number;
  lastAccessed: number;
}

export class CacheManager {
  private dbManager: DatabaseManager;
  private cacheDir: string;
  private maxCacheSize: number;
  private cacheExpirationTime: number;
  public isInitialized: boolean = false;

  constructor(dbManager: DatabaseManager, cacheDir?: string) {
    this.dbManager = dbManager;
    this.cacheDir = cacheDir || CONFIG.cacheDir;
    this.maxCacheSize = CONFIG.maxCacheSize;
    this.cacheExpirationTime = CONFIG.cacheExpirationTime;
  }

  async init(): Promise<void> {
    try {
      await mkdir(this.cacheDir, { recursive: true });
      await this.dbManager.init();
      this.isInitialized = true;
    } catch (error) {
      console.error('Error initializing cache:', error);
      throw error;
    }
  }

  /**
   * 获取缓存文件路径
   * @param originalPath 原始文件路径
   * @returns 缓存文件路径
   */
  private getCachePath(originalPath: string): string {
    const safePath = originalPath.replace(/[\/\\]/g, '_');
    return join(this.cacheDir, `${safePath}_${Date.now()}`);
  }

  /**
   * 查找已存在的缓存文件
   * @param originalPath 原始文件路径
   * @returns 缓存文件路径，如果不存在则返回undefined
   */
  private async findCacheFile(originalPath: string): Promise<string | undefined> {
    const safePath = originalPath.replace(/[\/\\]/g, '_');
    const files = existsSync(this.cacheDir) ? await readdir(this.cacheDir) : [];
    return files
      .filter(f => f.startsWith(safePath + '_'))
      .map(f => join(this.cacheDir, f))
      .find(f => existsSync(f));
  }

  /**
   * 将文件添加到缓存
   * @param originalPath 原始文件路径
   * @param size 文件大小
   * @returns 缓存文件路径
   */
  async addToCache(originalPath: string, size: number): Promise<string> {
    try {
      const cachePath = this.getCachePath(originalPath);
      await mkdir(dirname(cachePath), { recursive: true });
      await copyFile(originalPath, cachePath);

      await this.dbManager.addFile({
        path: originalPath,
        size,
        lastAccessed: Date.now()
      });

      return cachePath;
    } catch (error) {
      console.error('Error adding file to cache:', error);
      throw error;
    }
  }

  /**
   * 从缓存中获取文件
   * @param originalPath 原始文件路径
   * @returns 缓存文件路径，如果文件不在缓存中则返回undefined
   */
  async getFromCache(originalPath: string): Promise<string | undefined> {
    try {
      const file = await this.dbManager.getFile(originalPath);
      if (!file) return undefined;

      // 检查是否已经有缓存文件
      let cachePath = await this.findCacheFile(originalPath);
      if (!cachePath) {
        // 如果没有缓存文件，创建一个新的
        cachePath = this.getCachePath(originalPath);
        await mkdir(dirname(cachePath), { recursive: true });
        try {
          await copyFile(originalPath, cachePath);
        } catch (error: any) {
          if (error.code === 'ENOENT') {
            // 如果原始文件不存在，从数据库中删除记录
            await this.dbManager.deleteFile(originalPath);
            return undefined;
          }
          throw error;
        }
      }

      // 更新访问时间
      await this.dbManager.updateFileAccess(originalPath);
      return cachePath;
    } catch (error) {
      console.error('Error getting file from cache:', error);
      throw error;
    }
  }

  /**
   * 从缓存中删除文件
   * @param originalPath 原始文件路径
   */
  async removeFromCache(originalPath: string): Promise<void> {
    try {
      const file = await this.dbManager.getFile(originalPath);
      if (!file) return;

      // 删除数据库记录
      await this.dbManager.deleteFile(originalPath);
    } catch (error) {
      console.error('Error removing file from cache:', error);
      throw error;
    }
  }

  /**
   * 删除缓存文件
   * @param originalPath 原始文件路径
   */
  async deleteFromCache(originalPath: string): Promise<void> {
    const cachePath = await this.findCacheFile(originalPath);
    if (cachePath && existsSync(cachePath)) {
      await unlink(cachePath);
    }
  }

  /**
   * 清理旧的缓存文件
   * @param maxAge 最大缓存时间（毫秒）
   */
  async cleanup(maxAge?: number): Promise<void> {
    try {
      const cutoffTime = Date.now() - (maxAge ?? this.cacheExpirationTime);
      const oldFiles = await this.dbManager.getFilesByDate(cutoffTime);

      for (const file of oldFiles) {
        const cachePath = this.getCachePath(file.path);
        if (existsSync(cachePath)) {
          await unlink(cachePath);
        }
        await this.dbManager.deleteFile(file.path);
      }
    } catch (error) {
      console.error('Error cleaning up cache:', error);
      throw error;
    }
  }

  async getCacheStats(): Promise<CacheStats> {
    try {
      const files = await this.dbManager.getAllFiles();
      if (files.length === 0) {
        return {
          totalSize: 0,
          totalFiles: 0,
          totalEntries: 0,
          dateIndexSize: 0,
          sizeIndexSize: 0,
          tagIndexSize: 0,
          memoryUsage: {
            heapTotal: 0,
            heapUsed: 0,
            external: 0,
          },
          oldestCache: null,
          newestCache: null
        };
      }

      files.sort((a, b) => a.lastAccessed - b.lastAccessed);
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);

      return {
        totalSize,
        totalFiles: files.length,
        totalEntries: files.length,
        dateIndexSize: 0,
        sizeIndexSize: 0,
        tagIndexSize: 0,
        memoryUsage: {
          heapTotal: 0,
          heapUsed: 0,
          external: 0,
        },
        oldestCache: files[0].path,
        newestCache: files[files.length - 1].path
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      throw error;
    }
  }

  async getStats(): Promise<CacheStats> {
    const files = await readdir(this.cacheDir);
    let totalSize = 0;
    let oldestTime = Date.now();
    let newestTime = 0;
    let oldestFile = null;
    let newestFile = null;

    for (const file of files) {
      const filePath = join(this.cacheDir, file);
      const stats = await stat(filePath);
      totalSize += stats.size;
      
      if (stats.mtime.getTime() < oldestTime) {
        oldestTime = stats.mtime.getTime();
        oldestFile = file;
      }
      if (stats.mtime.getTime() > newestTime) {
        newestTime = stats.mtime.getTime();
        newestFile = file;
      }
    }

    return {
      totalSize,
      totalFiles: files.length,
      totalEntries: files.length,
      dateIndexSize: 0,
      sizeIndexSize: 0,
      tagIndexSize: 0,
      memoryUsage: {
        heapTotal: 0,
        heapUsed: 0,
        external: 0,
      },
      oldestCache: oldestFile,
      newestCache: newestFile
    };
  }

  async getByDate(date: string | Date): Promise<string[]> {
    const files = await readdir(this.cacheDir);
    const result: string[] = [];
    const targetDate = typeof date === 'string' ? new Date(date) : date;

    for (const file of files) {
      const filePath = join(this.cacheDir, file);
      const stats = await stat(filePath);
      if (stats.mtime.toDateString() === targetDate.toDateString()) {
        result.push(filePath);
      }
    }

    return result;
  }

  async set(path: string, info: { path: string; stats: { size: number; mtime: string } }): Promise<void> {
    await this.dbManager.addFile({
      path: info.path,
      size: info.stats.size,
      mtime: info.stats.mtime,
      lastAccessed: Date.now()
    });
  }

  async getRecentFiles(limit: number = 5): Promise<Array<{ path: string; size: number; lastAccessed: number }>> {
    try {
      if (!this.dbManager) {
        throw new Error('Database not initialized');
      }

      console.log('Fetching files from database...');
      const files = await this.dbManager.getAllFiles();
      console.log(`Found ${files.length} files in database`);

      if (files.length > 0) {
        console.log('Sample file:', files[0]);
      }

      files.sort((a, b) => b.lastAccessed - a.lastAccessed);
      return files.slice(0, limit);
    } catch (error) {
      console.error('Error getting recent files:', error);
      throw error;
    }
  }

  private async findScreenshots(): Promise<string[]> {
    try {
      const files = await readdir(CONFIG.screenshotDir);
      return files
        .filter(file => {
          // 检查文件是否匹配任何支持的格式
          return CONFIG.screenshotPatterns.some(pattern => pattern.test(file));
        })
        .map(file => join(CONFIG.screenshotDir, file));
    } catch (error) {
      console.error('Error reading screenshot directory:', error);
      return [];
    }
  }
}

export const cacheManager = new CacheManager(new DatabaseManager());
export const screenshotCache = new CacheManager(new DatabaseManager());
