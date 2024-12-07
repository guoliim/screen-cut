# Screen Cut

A powerful command-line tool for managing screenshots on macOS, with features for organizing, backing up, and cleaning up screenshot files.

## Features

- **Screenshot Management**
  - Automatically detect and manage screenshots across multiple directories
  - Support for various screenshot naming patterns
  - File organization and categorization

- **Backup System**
  - Automatic backup of deleted screenshots
  - Configurable backup retention (default: 30 days)
  - Maximum backup sets limit (default: 10 sets)

- **Cache Management**
  - Intelligent caching system for faster operations
  - Automatic cache cleanup (files older than 7 days)
  - Cache size limit management (default: 1GB)

- **Cleanup System**
  - Automatic cleanup of old cache files and backups
  - Database optimization through periodic vacuuming
  - Configurable cleanup intervals

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/screen-cut.git
cd screen-cut
```

2. Install dependencies:
```bash
pnpm install
```

3. Build the project:
```bash
pnpm run build
```

## Usage

### Basic Commands

1. **List Screenshots**
```bash
node dist/index.js list
```

2. **Delete Screenshots**
```bash
node dist/index.js delete [options]
```
Options:
- `-p, --path <path>`: Specify screenshot path to delete
- `-a, --all`: Delete all screenshots
- `-f, --force`: Skip confirmation

3. **Cleanup**
```bash
node dist/index.js cleanup [options]
```
Options:
- `-f, --force`: Force cleanup regardless of last cleanup time

### Configuration

The default configuration can be found in `src/config/index.ts`. Key settings include:

- Screenshot directories
- Cache and backup retention periods
- File patterns for screenshot detection
- Database settings

## Development

1. **Setup Development Environment**
```bash
pnpm install
```

2. **Watch Mode**
```bash
pnpm run dev
```

3. **Build**
```bash
pnpm run build
```

4. **Run Tests**
```bash
pnpm test
```

## Project Structure

```
screen-cut/
├── src/
│   ├── commands/       # Command implementations
│   ├── config/         # Configuration files
│   ├── utils/          # Utility functions
│   └── index.ts        # Main entry point
├── dist/               # Compiled JavaScript files
├── tests/              # Test files
└── package.json        # Project dependencies and scripts
```

## Tech Stack

- TypeScript
- Node.js
- SQLite (for data storage)
- Commander.js (for CLI interface)
- fs/promises (for file system operations)

## Contributing

Contributions via Pull Requests and Issues are welcome! Before submitting, please ensure:

1. Code has been tested
2. Code follows existing style
3. Documentation has been updated

## License

This project is licensed under the MIT License - see the LICENSE file for details.
