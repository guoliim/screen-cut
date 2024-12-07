import { readdir, unlink, stat } from 'fs/promises';
import { join } from 'path';
import { CONFIG } from '../config/index.js';
import { DatabaseManager } from './db-manager.js';
import chalk from 'chalk';

export class CleanupManager {
  private dbManager: DatabaseManager;

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager;
  }

  /**
   * 检查是否需要执行清理
   */
  async checkAndCleanup(force: boolean = false): Promise<void> {
    const now = Date.now();
    const lastCleanupTime = await this.dbManager.getLastCleanupTime();
    
    // 如果强制清理或者距离上次清理超过24小时
    if (force || (now - lastCleanupTime >= CONFIG.cacheCleanupInterval)) {
      await this.cleanup();
      await this.dbManager.updateLastCleanupTime();
    }
  }

  /**
   * 执行清理任务
   */
  private async cleanup(): Promise<void> {
    console.log(chalk.blue('\nStarting cleanup process...'));
    
    await this.cleanupCache();
    await this.cleanupBackups();
    await this.vacuumDatabase();
    
    console.log(chalk.green('✓ Cleanup completed'));
  }

  /**
   * 清理过期的缓存文件
   */
  private async cleanupCache(): Promise<void> {
    try {
      console.log(chalk.blue('\nCleaning up cache...'));
      const cacheDir = CONFIG.cacheDir;
      const files = await readdir(cacheDir);
      const now = Date.now();
      let cleanedCount = 0;
      let cleanedSize = 0;

      for (const file of files) {
        const filePath = join(cacheDir, file);
        const fileStat = await stat(filePath);

        // 检查文件是否过期
        if (now - fileStat.mtimeMs > CONFIG.maxCacheAge) {
          await unlink(filePath);
          cleanedCount++;
          cleanedSize += fileStat.size;
        }
      }

      if (cleanedCount > 0) {
        console.log(chalk.green(`✓ Cleaned up ${cleanedCount} cache files (${(cleanedSize / 1024 / 1024).toFixed(2)} MB)`));
      } else {
        console.log(chalk.gray('No cache files needed cleaning'));
      }
    } catch (error) {
      console.error(chalk.red('Error cleaning up cache:'), error);
    }
  }

  /**
   * 清理过期的备份文件
   */
  private async cleanupBackups(): Promise<void> {
    try {
      console.log(chalk.blue('\nCleaning up backups...'));
      const backups = await this.dbManager.getBackups();
      const now = Date.now();
      let cleanedCount = 0;
      let cleanedSize = 0;

      // 按创建时间排序，最新的在前
      backups.sort((a, b) => b.createdAt - a.createdAt);

      // 保留最新的 maxBackupSets 个备份集
      const backupsToKeep = backups.slice(0, CONFIG.maxBackupSets);
      const backupsToDelete = backups.slice(CONFIG.maxBackupSets);

      for (const backup of backupsToDelete) {
        try {
          // 检查备份是否过期
          if (now - backup.createdAt > CONFIG.maxBackupAge) {
            await unlink(backup.backupPath);
            await this.dbManager.removeBackup(backup.backupPath);
            cleanedCount++;
            cleanedSize += backup.size;
          }
        } catch (error) {
          console.error(chalk.red(`Error deleting backup ${backup.backupPath}:`), error);
        }
      }

      if (cleanedCount > 0) {
        console.log(chalk.green(`✓ Cleaned up ${cleanedCount} backup files (${(cleanedSize / 1024 / 1024).toFixed(2)} MB)`));
      } else {
        console.log(chalk.gray('No backup files needed cleaning'));
      }
    } catch (error) {
      console.error(chalk.red('Error cleaning up backups:'), error);
    }
  }

  /**
   * 压缩数据库
   */
  private async vacuumDatabase(): Promise<void> {
    try {
      console.log(chalk.blue('\nVacuuming database...'));
      await this.dbManager.vacuum();
      console.log(chalk.green('✓ Database vacuumed successfully'));
    } catch (error) {
      console.error(chalk.red('Error vacuuming database:'), error);
    }
  }
}
