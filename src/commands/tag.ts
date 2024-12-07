import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { CONFIG } from '../config/index.js';
import chalk from 'chalk';
import { basename } from 'path';

interface Screenshot {
  id: string;
  path: string;
  filename: string;
  createdAt: string;
  tags: string[];
}

export async function tag(file: string, tags: string[]) {
  try {
    // Validate file exists
    if (!existsSync(file)) {
      console.error(chalk.red('Error: File does not exist'));
      process.exit(1);
    }

    const db = JSON.parse(await readFile(CONFIG.dbPath, 'utf-8'));
    const filename = basename(file);
    
    // Find screenshot in database
    const screenshotIndex = db.screenshots.findIndex((s: Screenshot) => 
      s.filename === filename || s.path === file
    );

    if (screenshotIndex === -1) {
      console.error(chalk.red('Error: Screenshot not found in database'));
      process.exit(1);
    }

    // Update tags
    const screenshot = db.screenshots[screenshotIndex];
    const uniqueTags = new Set([...screenshot.tags, ...tags]);
    screenshot.tags = Array.from(uniqueTags);

    // Update tags index
    tags.forEach(tag => {
      if (!db.tags[tag]) {
        db.tags[tag] = [];
      }
      if (!db.tags[tag].includes(screenshot.id)) {
        db.tags[tag].push(screenshot.id);
      }
    });

    // Save changes
    await writeFile(CONFIG.dbPath, JSON.stringify(db, null, 2));

    console.log(chalk.green(`Successfully tagged "${filename}" with: ${tags.join(', ')}`));
    console.log(chalk.blue('All tags:', screenshot.tags.join(', ')));
  } catch (error) {
    console.error(chalk.red('Error tagging screenshot:'), error);
    process.exit(1);
  }
}
