import { performance } from 'perf_hooks';
import { screenshotCache } from '../utils/cache.js';
import { readdir, stat, writeFile, readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { CONFIG } from '../config/index.js';

interface BenchmarkResult {
  operation: string;
  duration: number;
  itemsProcessed: number;
}

async function getScreenshotsInDateRange(startDate: string, endDate: string): Promise<string[]> {
  const screenshots: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  // 获取日期范围内的所有文件
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const dateStr = date.toISOString().split('T')[0];
    const files = await screenshotCache.getByDate(dateStr);
    screenshots.push(...Array.from(files));
  }

  return screenshots;
}

export async function benchmark() {
  const results: BenchmarkResult[] = [];
  const startTime = performance.now();

  try {
    console.log('Starting benchmark...\n');

    // 1. 测试缓存加载性能
    console.log('Testing cache initialization...');
    const initStart = performance.now();
    await screenshotCache.init();
    const initDuration = performance.now() - initStart;
    
    results.push({
      operation: 'Cache Initialization',
      duration: initDuration,
      itemsProcessed: 1
    });

    // 2. 测试日期查询性能
    console.log('Testing date query performance...');
    const today = new Date();
    const dateQueryStart = performance.now();
    const dateFiles = await screenshotCache.getByDate(today.toISOString().split('T')[0]);
    const dateQueryDuration = performance.now() - dateQueryStart;

    results.push({
      operation: 'Date Query',
      duration: dateQueryDuration,
      itemsProcessed: dateFiles.length
    });

    // 获取缓存统计
    const stats = await screenshotCache.getStats();
    console.log('\nCache Statistics:');
    console.log(`Total Entries: ${stats.totalEntries}`);
    console.log(`Total Size: ${stats.totalSize} bytes`);
    console.log(`Total Files: ${stats.totalFiles}`);
    console.log(`Memory Usage:`);
    console.log(`  Heap Total: ${stats.memoryUsage.heapTotal} bytes`);
    console.log(`  Heap Used: ${stats.memoryUsage.heapUsed} bytes`);
    console.log(`  External: ${stats.memoryUsage.external} bytes`);

    // 3. 测试文件系统操作性能
    console.log('Testing file system operations...');
    const fsStart = performance.now();
    const files = await readdir(CONFIG.screenshotDir);
    const statPromises = files.map(file => 
      stat(join(CONFIG.screenshotDir, file))
    );
    await Promise.all(statPromises);
    const fsDuration = performance.now() - fsStart;

    results.push({
      operation: 'File System Operations',
      duration: fsDuration,
      itemsProcessed: files.length
    });

    // 测试文件操作性能
    console.log('\nTesting file operations...');
    const filePath = join(process.cwd(), 'test.txt');
    await writeFile(filePath, 'test content');

    console.time('File read');
    await readFile(filePath, 'utf-8');
    console.timeEnd('File read');

    console.time('File write');
    await writeFile(filePath, 'new content');
    console.timeEnd('File write');

    console.time('File delete');
    await unlink(filePath);
    console.timeEnd('File delete');

    // 打印结果
    console.log('\nBenchmark Results:');
    results.forEach(result => {
      console.log(`\n${result.operation}:`);
      console.log(`  Duration: ${result.duration.toFixed(2)}ms`);
      console.log(`  Items Processed: ${result.itemsProcessed}`);
      if (result.itemsProcessed > 1) {
        console.log(`  Average Time Per Item: ${(result.duration / result.itemsProcessed).toFixed(2)}ms`);
      }
    });

    const totalDuration = performance.now() - startTime;
    console.log(`\nTotal Benchmark Duration: ${totalDuration.toFixed(2)}ms`);

  } catch (error) {
    console.error('Error during benchmark:', error);
    throw error;
  }
}
