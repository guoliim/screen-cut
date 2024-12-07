import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const DEFAULT_SCREENSHOT_LOCATIONS = [
  join(homedir(), 'Desktop'),
  join(homedir(), 'Downloads'),
  join(homedir(), 'Pictures')
];

const CONFIG_DIR = join(homedir(), '.config', 'screen-cut');
const CACHE_DIR = join(CONFIG_DIR, 'cache');
const BACKUP_DIR = join(CONFIG_DIR, 'backup');

// 确保目录存在
[CONFIG_DIR, CACHE_DIR, BACKUP_DIR].forEach(dir => {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
});

export const CONFIG = {
  // 目录配置
  defaultScreenshotDirs: DEFAULT_SCREENSHOT_LOCATIONS,
  screenshotDir: join(homedir(), 'Desktop'),
  backupDir: BACKUP_DIR,
  cacheDir: CACHE_DIR,
  configDir: CONFIG_DIR,
  dbPath: join(CONFIG_DIR, 'screen_cut.db'),

  // 文件格式
  supportedFormats: ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
  screenshotPatterns: [
    /^Screen(shot|[ ]Shot) \d{4}-\d{2}-\d{2} at \d{2}\.\d{2}\.\d{2}.*\.png$/,
    /^Screenshot \d{4}-\d{2}-\d{2} at \d{1,2}\.\d{2}\.\d{2}.*\.png$/,
    /^截屏\d{4}-\d{2}-\d{2}.*\.png$/,
    /^Screen Shot \d{4}-\d{2}-\d{2}.*\.png$/,
  ],

  // 缓存设置
  maxCacheSize: 1024 * 1024 * 1024, // 1GB
  maxCacheAge: 7 * 24 * 60 * 60 * 1000, // 7天
  cacheCleanupInterval: 24 * 60 * 60 * 1000, // 每24小时清理一次缓存
  cacheExpirationTime: 7 * 24 * 60 * 60 * 1000, // 缓存过期时间：7天

  // 备份设置
  maxBackupAge: 30 * 24 * 60 * 60 * 1000, // 30天
  maxBackupSets: 10, // 最多保留10个备份集
  backupCleanupInterval: 24 * 60 * 60 * 1000, // 每24小时清理一次备份

  // 数据库设置
  databaseVacuumInterval: 7 * 24 * 60 * 60 * 1000, // 每7天进行一次数据库vacuum
};
