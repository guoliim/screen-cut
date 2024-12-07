import chokidar from 'chokidar';
import { CONFIG } from '../config/index.js';
import { readFile, writeFile } from 'fs/promises';
import { basename, extname } from 'path';
import chalk from 'chalk';

interface WatchOptions {
  dir?: string;
}

// 用于确保数据库写入的互斥锁
let isWriting = false;

export async function watch(options: WatchOptions) {
  const watchDirs = options.dir ? [options.dir] : CONFIG.defaultScreenshotDirs;
  
  console.log(chalk.blue('Watching directories:'));
  watchDirs.forEach(dir => {
    console.log(chalk.gray(`- ${dir}`));
  });

  const watcher = chokidar.watch(watchDirs, {
    ignored: /(^|[\/\\])\../, // ignore hidden files
    persistent: true,
    ignoreInitial: false // 这会让它检查现有文件
  });

  watcher.on('add', async (path) => {
    const filename = basename(path);
    const isScreenshot = CONFIG.screenshotPatterns.some(pattern => pattern.test(filename));
    
    if (isScreenshot) {
      while (isWriting) {
        await new Promise(resolve => setTimeout(resolve, 100)); // 等待其他写入完成
      }
      
      try {
        isWriting = true;
        const db = JSON.parse(await readFile(CONFIG.dbPath, 'utf-8'));
        
        // 检查是否已经存在
        const exists = db.screenshots.some((s: any) => s.path === path);
        if (exists) {
          isWriting = false;
          return;
        }

        // Add new screenshot to database
        const screenshot = {
          id: Date.now().toString(),
          path,
          filename,
          createdAt: new Date().toISOString(),
          tags: []
        };

        db.screenshots.push(screenshot);
        await writeFile(CONFIG.dbPath, JSON.stringify(db, null, 2));
        console.log(chalk.green(`New screenshot detected: ${filename}`));
      } catch (error) {
        console.error(chalk.red('Error processing screenshot:'), error);
      } finally {
        isWriting = false;
      }
    }
  });

  watcher.on('error', (error) => {
    console.error(chalk.red('Error watching directory:'), error);
  });
}
