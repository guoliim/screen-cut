import { readdir, stat } from 'fs/promises';
import { join, basename } from 'path';
import chalk from 'chalk';
import { CONFIG } from '../config/index.js';
import { CacheManager } from '../utils/cache.js';
import { DatabaseManager } from '../utils/db-manager.js';
import { formatFileSize, formatDate } from '../utils/format.js';

interface Screenshot {
  path: string;
  name: string;
  mtime: Date;
  size: number;
}

interface FileInfo {
  path: string;
  size: number;
  lastAccessed: number;
  mtime?: string;
}

/**
 * 列出桌面上的所有 macOS 截图
 */
export async function listFiles(files: FileInfo[]): Promise<void> {
  if (files.length === 0) {
    console.log('No screenshots found.');
    return;
  }

  // 计算总大小
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  console.log(`\nFound ${files.length} screenshots:`);
  console.log(`Total size: ${formatFileSize(totalSize)}\n`);

  // 显示文件列表
  files.forEach((file, index) => {
    const filename = file.path.split('/').pop();
    console.log(`${index + 1}. ${chalk.cyan(filename)}`);
    console.log(`   Modified: ${formatDate(new Date(file.mtime || Date.now()))}`);
    console.log(`   Size: ${formatFileSize(file.size)}`);
    if (index < files.length - 1) console.log(''); // 文件之间添加空行
  });
}

/**
 * 列出桌面上的所有 macOS 截图
 */
export async function list(): Promise<void> {
  console.log(chalk.blue('Scanning for screenshots... (Read-only operation)'));
  console.log(chalk.gray('This command only displays screenshots and will not modify or delete any files.\n'));

  try {
    const dbManager = new DatabaseManager();
    await dbManager.init();
    const cacheManager = new CacheManager(dbManager);
    await cacheManager.init();

    const files = await readdir(CONFIG.screenshotDir);
    const screenshots: FileInfo[] = [];
    let totalSize = 0;

    for (const file of files) {
      if (!file.toLowerCase().endsWith('.png')) continue;
      
      const filePath = join(CONFIG.screenshotDir, file);
      const stats = await stat(filePath);
      
      // 将文件添加到数据库中
      await dbManager.addFile({
        path: filePath,
        size: stats.size,
        mtime: stats.mtime.toISOString(),
        lastAccessed: Date.now()
      });

      screenshots.push({
        path: filePath,
        size: stats.size,
        lastAccessed: Date.now(),
        mtime: stats.mtime.toISOString()
      });
      
      totalSize += stats.size;
    }

    // 显示文件列表
    await listFiles(screenshots);

  } catch (error) {
    console.error(chalk.red('Error listing screenshots:', error));
    process.exit(1);
  }
}
