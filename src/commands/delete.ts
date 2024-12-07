import { unlink, copyFile, mkdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, basename, dirname } from 'path';
import chalk from 'chalk';
import { CONFIG } from '../config/index.js';
import { DatabaseManager } from '../utils/db-manager.js';
import { CacheManager } from '../utils/cache.js';
import { listFiles } from './list.js';

interface DeleteResult {
  deleted: string[];
  failed: { path: string; error: Error }[];
  backupDir: string;
}

async function createBackup(filePath: string, backupDir: string): Promise<string> {
  const backupPath = join(backupDir, basename(filePath));
  await copyFile(filePath, backupPath);
  return backupPath;
}

export async function deleteFiles(files: string[]): Promise<DeleteResult> {
  const results: DeleteResult = {
    deleted: [],
    failed: [],
    backupDir: ''
  };

  try {
    // 初始化管理器
    const dbManager = new DatabaseManager();
    await dbManager.init();
    const cacheManager = new CacheManager(dbManager);
    await cacheManager.init();

    // 创建备份目录
    const backupDir = join(process.cwd(), 'backups', new Date().toISOString().split('T')[0]);
    await mkdir(backupDir, { recursive: true });
    results.backupDir = backupDir;

    console.log(chalk.blue('\nPreparing to delete files...'));
    console.log(chalk.blue(`Creating backups in: ${backupDir}`));
    
    for (const file of files) {
      try {
        if (!existsSync(file)) {
          console.log(chalk.yellow(`Skipping non-existent file: ${basename(file)}`));
          continue;
        }

        // 创建备份
        console.log(chalk.blue(`\nProcessing: ${basename(file)}`));
        console.log(chalk.gray('Creating backup...'));
        
        const stats = await stat(file);
        const backupPath = await createBackup(file, backupDir);
        
        // 更新数据库中的备份信息
        await dbManager.addBackup({
          originalPath: file,
          backupPath: backupPath,
          size: stats.size,
          createdAt: Date.now()
        });
        
        console.log(chalk.green('✓ Backup created'));

        // 删除原文件
        console.log(chalk.gray('Deleting original file...'));
        await unlink(file);
        
        // 更新数据库
        await dbManager.addDeletedFile(file, backupPath, stats.size);
        await cacheManager.removeFromCache(file);
        
        results.deleted.push(file);
        console.log(chalk.green('✓ File deleted'));
      } catch (error) {
        if (error instanceof Error) {
          results.failed.push({ path: file, error });
        } else {
          results.failed.push({ path: file, error: new Error(String(error)) });
        }
        console.error(chalk.red(`✗ Failed to process: ${basename(file)}`));
        console.error(chalk.gray(`  Error: ${error}`));
      }
    }

    // 显示删除结果统计
    console.log(chalk.blue('\nDeletion Summary:'));
    console.log(chalk.green(`✓ Successfully deleted: ${results.deleted.length} files`));
    if (results.failed.length > 0) {
      console.log(chalk.red(`✗ Failed to delete: ${results.failed.length} files`));
    }
    console.log(chalk.gray(`\nBackups are stored in: ${backupDir}`));
    console.log(chalk.gray('Use the restore command to recover deleted files if needed.'));

    return results;
  } catch (error) {
    console.error(chalk.red('Error during deletion:', error));
    throw error;
  }
}

export async function deleteRecent(count: number = 5): Promise<DeleteResult> {
  try {
    // 初始化管理器
    const dbManager = new DatabaseManager();
    await dbManager.init();
    const cacheManager = new CacheManager(dbManager);
    await cacheManager.init();

    // 获取最近的文件
    const recentFiles = await cacheManager.getRecentFiles(count);
    
    if (recentFiles.length === 0) {
      console.log(chalk.yellow('\nNo screenshots found to delete.'));
      return { deleted: [], failed: [], backupDir: '' };
    }

    console.log(chalk.blue(`\nFound ${recentFiles.length} recent screenshots:`));
    for (const [index, file] of recentFiles.entries()) {
      console.log(chalk.white(`${index + 1}. ${basename(file.path)}`));
      console.log(chalk.gray(`   Last accessed: ${new Date(file.lastAccessed).toLocaleString()}`));
      console.log(chalk.gray(`   Size: ${(file.size / 1024).toFixed(2)} KB`));
    }

    // 删除文件
    return await deleteFiles(recentFiles.map(f => f.path));
  } catch (error) {
    console.error(chalk.red('Error during deletion:', error));
    throw error;
  }
}

export async function deleteCommand(count: string | undefined): Promise<void> {
  try {
    const dbManager = new DatabaseManager();
    await dbManager.init();

    const cacheManager = new CacheManager(dbManager);
    await cacheManager.init();

    // 获取最近的文件
    const files = await cacheManager.getRecentFiles();
    if (files.length === 0) {
      console.log('No screenshots found to delete.');
      return;
    }

    // 解析要删除的文件数量
    const requestedCount = count ? parseInt(count) : 1;
    if (isNaN(requestedCount) || requestedCount <= 0) {
      console.error('Invalid number specified. Please provide a positive number.');
      process.exit(1);
    }

    // 确定实际可删除的文件数量
    const actualCount = Math.min(requestedCount, files.length);
    const filesToDelete = files.slice(0, actualCount);

    // 显示要删除的文件列表
    console.log(chalk.yellow(`\nPreparing to delete ${filesToDelete.length} screenshots${
      actualCount < requestedCount ? ` (requested: ${requestedCount})` : ''
    }:`));

    // 使用 listFiles 显示文件列表
    await listFiles(filesToDelete);

    // 创建备份目录
    const backupDir = join(process.cwd(), 'backups', new Date().toISOString().split('T')[0]);
    console.log(chalk.blue(`\nCreating backups in: ${backupDir}\n`));

    let successCount = 0;
    let failureCount = 0;

    for (const file of filesToDelete) {
      const filename = basename(file.path);
      console.log(`Processing: ${chalk.cyan(filename)}`);

      try {
        // 创建备份
        console.log('Creating backup...');
        await mkdir(backupDir, { recursive: true });
        const backupPath = join(backupDir, filename);
        await copyFile(file.path, backupPath);

        // 添加备份记录
        await dbManager.addBackup({
          originalPath: file.path,
          backupPath,
          size: file.size,
          createdAt: Date.now()
        });

        console.log(chalk.green('✓'), 'Backup created');

        // 删除原文件
        console.log('Deleting original file...');
        await unlink(file.path);
        console.log(chalk.green('✓'), 'File deleted');
        successCount++;

      } catch (error) {
        console.error(chalk.red('✗'), `Failed to process: ${filename}`);
        console.error('  Error:', error);
        failureCount++;
      }
      console.log();
    }

    // 显示删除摘要
    console.log('Deletion Summary:');
    if (successCount > 0) {
      console.log(chalk.green('✓'), `Successfully deleted: ${successCount} files`);
    }
    if (failureCount > 0) {
      console.log(chalk.red('✗'), `Failed to delete: ${failureCount} files`);
    }
    if (actualCount < requestedCount) {
      console.log(chalk.yellow('!'), `Note: Only ${actualCount} files were available (requested: ${requestedCount})`);
    }

    console.log(`\nBackups are stored in: ${backupDir}`);
    console.log('Use the restore command to recover deleted files if needed.');

  } catch (error) {
    console.error('Error deleting files:', error);
    process.exit(1);
  }
}

function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

export const deleteScreenshots = deleteFiles;
