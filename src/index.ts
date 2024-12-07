#!/usr/bin/env node

import { Command } from 'commander';
import { list } from './commands/list.js';
import { deleteCommand } from './commands/delete.js';
import { DatabaseManager } from './utils/db-manager.js';
import { formatFileSize, formatDate } from './utils/format.js';
import { mkdir, copyFile } from 'fs/promises';
import { dirname } from 'path';
import chalk from 'chalk';
import { CleanupManager } from './utils/cleanup-manager.js';

const program = new Command();

// 初始化数据库管理器
const dbManager = new DatabaseManager();
const cleanupManager = new CleanupManager(dbManager);

// 在每个命令执行前检查是否需要清理
program.hook('preAction', async () => {
  await dbManager.init();
  await cleanupManager.checkAndCleanup();
});

program
  .name('screen-cut')
  .description('CLI tool to manage screenshots')
  .version('1.0.0');

program
  .command('list')
  .description('List all screenshots')
  .action(list);

program
  .command('delete')
  .description('Delete screenshots')
  .option('-n, --number <number>', 'Number of recent screenshots to delete')
  .action(async (options) => {
    try {
      await deleteCommand(options.number);
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

program
  .command('restore')
  .description('Restore screenshots from backup')
  .option('-l, --list', 'List available backups')
  .option('-p, --path <path>', 'Path to restore')
  .option('-n, --number <number>', 'Number of recent backups to restore')
  .action(async (options) => {
    try {
      if (options.list) {
        // 列出所有可用的备份
        const backups = await dbManager.getBackups();
        if (backups.length === 0) {
          console.log('No backups available.');
          return;
        }

        console.log('\nAvailable backups:');
        console.log('Total:', backups.length, 'files\n');

        for (const backup of backups) {
          const filename = backup.originalPath.split('/').pop();
          console.log(chalk.cyan(filename));
          console.log(`  Original path: ${backup.originalPath}`);
          console.log(`  Backup path: ${backup.backupPath}`);
          console.log(`  Size: ${formatFileSize(backup.size)}`);
          console.log(`  Backup time: ${formatDate(new Date(backup.createdAt))}`);
          console.log();
        }
        return;
      }

      if (options.number) {
        // 恢复最近的 n 个备份
        const count = parseInt(options.number);
        if (isNaN(count) || count <= 0) {
          console.error('Invalid number specified. Please provide a positive number.');
          process.exit(1);
        }

        const backups = await dbManager.getBackups();
        if (backups.length === 0) {
          console.log('No backups available.');
          return;
        }

        const toRestore = backups.slice(0, count);
        console.log(`\nRestoring ${toRestore.length} recent backups...\n`);

        for (const backup of toRestore) {
          const filename = backup.originalPath.split('/').pop();
          console.log(`Processing: ${filename}`);
          
          try {
            // 创建目标目录（如果不存在）
            await mkdir(dirname(backup.originalPath), { recursive: true });

            // 复制文件
            await copyFile(backup.backupPath, backup.originalPath);
            console.log(chalk.green('✓'), 'File restored successfully:', backup.originalPath);
          } catch (error) {
            console.error(chalk.red('✗'), 'Failed to restore:', backup.originalPath);
            console.error('  Error:', error);
          }
          console.log();
        }
        return;
      }

      if (!options.path) {
        console.error('Please specify either --number or --path option');
        process.exit(1);
      }

      // 查找备份
      const backups = await dbManager.getBackups(options.path);
      if (backups.length === 0) {
        console.error('No backup found for:', options.path);
        process.exit(1);
      }

      const backup = backups[0]; // 使用最新的备份
      const targetPath = backup.originalPath;

      // 创建目标目录（如果不存在）
      await mkdir(dirname(targetPath), { recursive: true });

      // 复制文件
      await copyFile(backup.backupPath, targetPath);
      console.log(chalk.green('✓'), 'File restored successfully:', targetPath);

    } catch (error) {
      console.error('Error restoring file:', error);
      process.exit(1);
    }
  });

program
  .command('cleanup')
  .description('Clean up old backups and cache files')
  .option('-f, --force', 'Force cleanup regardless of last cleanup time')
  .action(async (options) => {
    try {
      await cleanupManager.checkAndCleanup(options.force);
    } catch (error) {
      console.error('Error running cleanup:', error);
      process.exit(1);
    }
  });

program.parse();
