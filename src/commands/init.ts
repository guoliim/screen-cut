import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { CONFIG } from '../config/index.js';
import { screenshotCache } from '../utils/cache.js';

export async function init(): Promise<void> {
  console.log('Initializing screen-cut...');

  try {
    // 确保配置目录存在
    if (!existsSync(CONFIG.configDir)) {
      console.log(`Creating config directory: ${CONFIG.configDir}`);
      await mkdir(CONFIG.configDir, { recursive: true });
    } else {
      console.log(`Config directory already exists: ${CONFIG.configDir}`);
    }

    // 确保备份目录存在
    const backupDir = `${CONFIG.configDir}/backup`;
    if (!existsSync(backupDir)) {
      console.log(`Creating backup directory: ${backupDir}`);
      await mkdir(backupDir, { recursive: true });
    } else {
      console.log(`Backup directory already exists: ${backupDir}`);
    }

    // 初始化缓存
    console.log('Initializing cache...');
    await screenshotCache.init();
    const stats = await screenshotCache.getStats();
    console.log(`Cache initialized with ${stats.totalEntries} entries`);

    console.log('Initialization completed successfully.');
    process.exit(0); // 确保程序正常退出
  } catch (error: any) {
    console.error('Error during initialization:', error.message);
    process.exit(1);
  }
}

export default init;
