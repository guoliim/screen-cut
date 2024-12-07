import { readFile } from 'fs/promises';
import { CONFIG } from '../config/index.js';
import chalk from 'chalk';
import { format, parseISO, isWithinInterval, parse } from 'date-fns';
import { statSync } from 'fs';

interface SearchOptions {
  tag?: boolean;
  from?: string;    // 开始日期 YYYY-MM-DD
  to?: string;      // 结束日期 YYYY-MM-DD
  size?: string;    // 文件大小筛选，例如：">1MB", "<500KB"
  regex?: boolean;  // 是否使用正则表达式搜索
  all?: boolean;    // 是否要求匹配所有标签（AND）
}

interface Screenshot {
  id: string;
  path: string;
  filename: string;
  createdAt: string;
  tags: string[];
}

// 解析文件大小条件
function parseSize(sizeStr: string): { op: string; size: number } | null {
  const match = sizeStr.match(/^([<>])?(\d+)(KB|MB|GB)?$/i);
  if (!match) return null;

  const [, op = '=', value, unit = 'B'] = match;
  const multipliers = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };
  const size = parseInt(value) * multipliers[unit.toUpperCase() as keyof typeof multipliers];

  return { op, size };
}

// 检查文件大小是否符合条件
function checkFileSize(filePath: string, condition: string): boolean {
  const sizeCondition = parseSize(condition);
  if (!sizeCondition) return true;

  const stats = statSync(filePath);
  const { op, size } = sizeCondition;

  switch (op) {
    case '>': return stats.size > size;
    case '<': return stats.size < size;
    default: return stats.size === size;
  }
}

export async function search(query: string, options: SearchOptions) {
  try {
    const db = JSON.parse(await readFile(CONFIG.dbPath, 'utf-8'));
    const screenshots: Screenshot[] = db.screenshots;
    
    let results = screenshots;

    // 1. 标签搜索
    if (options.tag) {
      const searchTags = query.toLowerCase().split(',').map(t => t.trim());
      results = screenshots.filter(screenshot => {
        const matchingTags = searchTags.filter(tag =>
          screenshot.tags.some(t => t.toLowerCase().includes(tag))
        );
        return options.all
          ? matchingTags.length === searchTags.length  // AND 逻辑
          : matchingTags.length > 0;                   // OR 逻辑
      });
    } else {
      // 2. 文件名搜索
      const searchPattern = options.regex
        ? new RegExp(query, 'i')
        : new RegExp(query.split('').map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*'), 'i');

      results = results.filter(screenshot =>
        searchPattern.test(screenshot.filename) ||
        screenshot.tags.some(tag => searchPattern.test(tag))
      );
    }

    // 3. 日期范围筛选
    if (options.from || options.to) {
      const fromDate = options.from ? parse(options.from, 'yyyy-MM-dd', new Date()) : new Date(0);
      const toDate = options.to ? parse(options.to, 'yyyy-MM-dd', new Date()) : new Date();

      results = results.filter(screenshot => {
        const screenshotDate = parseISO(screenshot.createdAt);
        return isWithinInterval(screenshotDate, { start: fromDate, end: toDate });
      });
    }

    // 4. 文件大小筛选
    if (options.size) {
      results = results.filter(screenshot => checkFileSize(screenshot.path, options.size!));
    }

    if (results.length === 0) {
      console.log(chalk.yellow(`No screenshots found matching "${query}"`));
      return;
    }

    // 优化显示结果
    console.log(chalk.blue(`\nSearch results for "${query}":`));
    results.forEach((screenshot, index) => {
      const stats = statSync(screenshot.path);
      const size = stats.size;
      let sizeStr = '';
      
      if (size < 1024) sizeStr = `${size}B`;
      else if (size < 1024 * 1024) sizeStr = `${(size / 1024).toFixed(1)}KB`;
      else sizeStr = `${(size / (1024 * 1024)).toFixed(1)}MB`;

      console.log(chalk.white(`\n${index + 1}. ${screenshot.filename}`));
      console.log(chalk.gray(`   Path: ${screenshot.path}`));
      console.log(chalk.gray(`   Created: ${format(parseISO(screenshot.createdAt), 'yyyy-MM-dd HH:mm:ss')}`));
      console.log(chalk.gray(`   Size: ${sizeStr}`));
      if (screenshot.tags.length > 0) {
        console.log(chalk.cyan(`   Tags: ${screenshot.tags.join(', ')}`));
      }
    });

    console.log(chalk.blue(`\nFound ${results.length} matching screenshots`));
  } catch (error) {
    console.error(chalk.red('Error searching screenshots:'), error);
    process.exit(1);
  }
}
