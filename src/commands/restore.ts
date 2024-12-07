import { readdir, copyFile, stat, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';
import { CONFIG } from '../config/index.js';
import { DatabaseManager } from '../utils/db-manager.js';
import { CacheManager } from '../utils/cache.js';
import chalk from 'chalk';

interface RestoreResult {
  restored: string[];
  failed: string[];
}

async function findInTrash(filename: string): Promise<string | null> {
  const trashPath = join(homedir(), '.Trash');
  if (!existsSync(trashPath)) {
    return null;
  }

  try {
    const files = await readdir(trashPath);
    const match = files.find(f => f === filename);
    return match ? join(trashPath, match) : null;
  } catch (error) {
    console.warn(chalk.yellow('Warning: Could not access Trash directory'));
    return null;
  }
}

export async function restore(source?: string, list?: boolean): Promise<RestoreResult> {
  const results: RestoreResult = {
    restored: [],
    failed: []
  };

  // 确保目标目录存在
  const targetDir = CONFIG.defaultScreenshotDirs[0];
  if (!existsSync(targetDir)) {
    await mkdir(targetDir, { recursive: true });
  }

  try {
    // 初始化管理器
    const dbManager = new DatabaseManager();
    await dbManager.init();
    const cacheManager = new CacheManager(dbManager);
    await cacheManager.init();

    if (list) {
      // 列出所有可用的备份
      const backups = await dbManager.getBackups();
      if (backups.length === 0) {
        console.log('No backups available.');
        return results;
      }

      console.log('Available backups:');
      console.log('Total:', backups.length, 'files\n');

      for (const backup of backups) {
        const filename = backup.originalPath.split('/').pop();
        console.log(`${filename}`);
        console.log(`  Original path: ${backup.originalPath}`);
        console.log(`  Backup path: ${backup.backupPath}`);
        console.log(`  Size: ${backup.size} bytes`);
        console.log(`  Backup time: ${new Date(backup.createdAt).toLocaleString()}`);
        console.log();
      }
      return results;
    }

    // 如果指定了源目录，从源目录恢复
    if (source && existsSync(source)) {
      const files = await readdir(source);
      console.log(chalk.blue(`\nRestoring from directory: ${source}`));
      
      for (const file of files) {
        // 检查文件名是否是截图
        const isScreenshot = (filename: string): boolean => {
          return CONFIG.screenshotPatterns.some(pattern => pattern.test(filename));
        };

        if (isScreenshot(file)) {
          const sourcePath = join(source, file);
          const targetPath = join(targetDir, file);

          try {
            await copyFile(sourcePath, targetPath);
            const stats = await stat(targetPath);
            
            // 更新缓存和数据库
            await cacheManager.addToCache(targetPath, stats.size);
            await dbManager.addFile({
              path: targetPath,
              size: stats.size,
              mtime: stats.mtime.toISOString(),
              lastAccessed: Date.now()
            });

            results.restored.push(targetPath);
            console.log(chalk.green(`✓ Restored: ${file}`));
          } catch (error) {
            results.failed.push(file);
            console.error(chalk.red(`✗ Failed to restore: ${file}`));
          }
        }
      }
    } else {
      // 从备份或回收站恢复
      console.log(chalk.blue('\nSearching for recently deleted screenshots...'));
      
      // 获取最近删除的文件列表
      const recentlyDeleted = await dbManager.getRecentlyDeleted();
      
      if (recentlyDeleted.length === 0) {
        console.log(chalk.yellow('\nNo recently deleted screenshots found.'));
        return results;
      }

      console.log(chalk.blue(`\nFound ${recentlyDeleted.length} deleted screenshots:`));
      
      for (const [index, file] of recentlyDeleted.entries()) {
        console.log(chalk.white(`${index + 1}. ${basename(file.path)}`));
        console.log(chalk.gray(`   Deleted at: ${new Date(file.deletedAt).toLocaleString()}`));
        console.log(chalk.gray(`   Size: ${(file.size / 1024).toFixed(2)} KB`));
      }

      for (const file of recentlyDeleted) {
        const filename = basename(file.path);
        const targetPath = join(targetDir, filename);
        
        // 首先尝试从备份恢复
        if (file.backupPath && existsSync(file.backupPath)) {
          try {
            await copyFile(file.backupPath, targetPath);
            const stats = await stat(targetPath);
            
            // 更新缓存和数据库
            await cacheManager.addToCache(targetPath, stats.size);
            await dbManager.addFile({
              path: targetPath,
              size: stats.size,
              mtime: new Date().toISOString(),
              lastAccessed: Date.now()
            });
            
            // 从已删除列表中移除
            await dbManager.removeFromDeletedFiles(file.path);

            results.restored.push(targetPath);
            console.log(chalk.green(`✓ Restored from backup: ${filename}`));
            continue;
          } catch (error) {
            console.warn(chalk.yellow(`Warning: Could not restore from backup: ${filename}`));
          }
        }
        
        // 如果备份恢复失败，尝试从回收站恢复
        const trashPath = await findInTrash(filename);
        if (trashPath) {
          try {
            await copyFile(trashPath, targetPath);
            const stats = await stat(targetPath);
            
            // 更新缓存和数据库
            await cacheManager.addToCache(targetPath, stats.size);
            await dbManager.addFile({
              path: targetPath,
              size: stats.size,
              mtime: new Date().toISOString(),
              lastAccessed: Date.now()
            });
            
            // 从已删除列表中移除
            await dbManager.removeFromDeletedFiles(file.path);

            results.restored.push(targetPath);
            console.log(chalk.green(`✓ Restored from Trash: ${filename}`));
          } catch (error) {
            results.failed.push(filename);
            console.error(chalk.red(`✗ Failed to restore: ${filename}`));
          }
        } else {
          results.failed.push(filename);
          console.error(chalk.red(`✗ Could not find ${filename} in backup or Trash`));
        }
      }
    }

    // 显示恢复结果统计
    console.log(chalk.blue('\nRestore Summary:'));
    console.log(chalk.green(`✓ Successfully restored: ${results.restored.length} files`));
    if (results.failed.length > 0) {
      console.log(chalk.red(`✗ Failed to restore: ${results.failed.length} files`));
    }

    return results;
  } catch (error) {
    console.error(chalk.red('Error during restore:', error));
    throw error;
  }
}
