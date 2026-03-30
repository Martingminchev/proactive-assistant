// =============================================================================
// NEXUS - Agentic Coding Tools
// Tools for codebase exploration, search, analysis, and development operations.
// These tools enable NEXUS to act as a capable coding assistant.
// =============================================================================

import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { IToolRegistry } from './types';

const execAsync = promisify(exec);

// Helper to check if a command exists
async function commandExists(cmd: string): Promise<boolean> {
  try {
    const checkCmd = process.platform === 'win32' ? `where ${cmd}` : `which ${cmd}`;
    await execAsync(checkCmd);
    return true;
  } catch {
    return false;
  }
}

// Helper to respect .gitignore patterns
async function getIgnorePatterns(dir: string): Promise<string[]> {
  const defaultIgnores = ['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', '.venv', 'venv', '.idea', '.vscode', 'coverage', '.nyc_output'];
  try {
    const gitignorePath = path.join(dir, '.gitignore');
    const content = await fs.readFile(gitignorePath, 'utf-8');
    const patterns = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));
    return [...new Set([...defaultIgnores, ...patterns])];
  } catch {
    return defaultIgnores;
  }
}

// Helper to check if path should be ignored
function shouldIgnore(filePath: string, ignorePatterns: string[]): boolean {
  const parts = filePath.split(path.sep);
  return ignorePatterns.some(pattern => {
    // Simple pattern matching - could be enhanced
    const normalizedPattern = pattern.replace(/\//g, path.sep).replace(/\\/g, path.sep);
    return parts.some(part => part === normalizedPattern || part.startsWith(normalizedPattern.replace('*', '')));
  });
}

export function registerCodingTools(registry: IToolRegistry): void {
  // ===========================================================================
  // grep_codebase - Search for patterns across project files
  // ===========================================================================
  registry.registerTool(
    {
      type: 'function',
      function: {
        name: 'grep_codebase',
        description: 'Search for a regex pattern across all files in a directory. Returns matching lines with file paths and line numbers. Uses ripgrep if available for speed, falls back to Node.js implementation. Respects .gitignore.',
        parameters: {
          type: 'object',
          properties: {
            pattern: { type: 'string', description: 'Regex pattern to search for' },
            directory: { type: 'string', description: 'Directory to search in (defaults to current working directory)' },
            filePattern: { type: 'string', description: 'Glob pattern to filter files (e.g., "*.ts", "*.{js,jsx}")' },
            maxResults: { type: 'number', description: 'Maximum number of results to return (default 50)' },
            caseSensitive: { type: 'boolean', description: 'Whether search is case-sensitive (default false)' },
            contextLines: { type: 'number', description: 'Number of context lines before/after match (default 0)' },
          },
          required: ['pattern'],
        },
      },
    },
    async (args) => {
      const pattern = args.pattern as string;
      const directory = (args.directory as string) || process.cwd();
      const filePattern = args.filePattern as string | undefined;
      const maxResults = Math.min(Number(args.maxResults) || 50, 200);
      const caseSensitive = args.caseSensitive === true;
      const contextLines = Math.min(Number(args.contextLines) || 0, 5);

      if (!pattern) {
        return { success: false, error: 'pattern is required' };
      }

      try {
        // Check if directory exists
        await fs.access(directory);

        // Try ripgrep first (much faster)
        const hasRg = await commandExists('rg');
        
        if (hasRg) {
          // Build ripgrep command
          let cmd = `rg --json --max-count ${maxResults}`;
          if (!caseSensitive) cmd += ' -i';
          if (contextLines > 0) cmd += ` -C ${contextLines}`;
          if (filePattern) cmd += ` -g "${filePattern}"`;
          cmd += ` "${pattern.replace(/"/g, '\\"')}" "${directory}"`;

          try {
            const { stdout } = await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024 });
            const lines = stdout.trim().split('\n').filter(Boolean);
            const results: Array<{ file: string; line: number; content: string }> = [];
            
            for (const line of lines) {
              try {
                const parsed = JSON.parse(line);
                if (parsed.type === 'match') {
                  results.push({
                    file: path.relative(directory, parsed.data.path.text),
                    line: parsed.data.line_number,
                    content: parsed.data.lines.text.trim(),
                  });
                }
              } catch {
                // Skip malformed JSON lines
              }
            }

            return {
              success: true,
              data: {
                matches: results.slice(0, maxResults),
                totalMatches: results.length,
                searchDirectory: directory,
                usingRipgrep: true,
              },
            };
          } catch (e) {
            // ripgrep returns exit code 1 when no matches found
            if ((e as { code?: number }).code === 1) {
              return {
                success: true,
                data: { matches: [], totalMatches: 0, searchDirectory: directory },
              };
            }
            throw e;
          }
        }

        // Fallback: Node.js implementation
        const ignorePatterns = await getIgnorePatterns(directory);
        const regex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
        const results: Array<{ file: string; line: number; content: string }> = [];

        async function searchDir(dir: string): Promise<void> {
          if (results.length >= maxResults) return;

          const entries = await fs.readdir(dir, { withFileTypes: true });
          
          for (const entry of entries) {
            if (results.length >= maxResults) break;

            const fullPath = path.join(dir, entry.name);
            const relativePath = path.relative(directory, fullPath);

            if (shouldIgnore(relativePath, ignorePatterns)) continue;

            if (entry.isDirectory()) {
              await searchDir(fullPath);
            } else if (entry.isFile()) {
              // Check file pattern
              if (filePattern) {
                const ext = path.extname(entry.name);
                const patterns = filePattern.replace(/\{(.*?)\}/g, '$1').split(',').map(p => p.trim());
                const matches = patterns.some(p => {
                  if (p.startsWith('*.')) return ext === p.slice(1);
                  return entry.name.includes(p.replace('*', ''));
                });
                if (!matches) continue;
              }

              try {
                const content = await fs.readFile(fullPath, 'utf-8');
                const lines = content.split('\n');
                
                for (let i = 0; i < lines.length && results.length < maxResults; i++) {
                  if (regex.test(lines[i]!)) {
                    results.push({
                      file: relativePath,
                      line: i + 1,
                      content: lines[i]!.trim().slice(0, 200),
                    });
                    regex.lastIndex = 0; // Reset regex state
                  }
                }
              } catch {
                // Skip binary or unreadable files
              }
            }
          }
        }

        await searchDir(directory);

        return {
          success: true,
          data: {
            matches: results,
            totalMatches: results.length,
            searchDirectory: directory,
            usingRipgrep: false,
          },
        };
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : 'Search failed',
        };
      }
    },
    { timeoutMs: 30000 }
  );

  // ===========================================================================
  // list_directory - Show directory tree with smart filtering
  // ===========================================================================
  registry.registerTool(
    {
      type: 'function',
      function: {
        name: 'list_directory',
        description: 'List files and directories in a tree structure. Respects .gitignore and common ignore patterns. Shows file sizes and types.',
        parameters: {
          type: 'object',
          properties: {
            directory: { type: 'string', description: 'Directory to list (defaults to current working directory)' },
            depth: { type: 'number', description: 'Maximum depth to traverse (default 3, max 10)' },
            showHidden: { type: 'boolean', description: 'Show hidden files (default false)' },
            filePattern: { type: 'string', description: 'Only show files matching this pattern (e.g., "*.ts")' },
          },
        },
      },
    },
    async (args) => {
      const directory = (args.directory as string) || process.cwd();
      const maxDepth = Math.min(Math.max(Number(args.depth) || 3, 1), 10);
      const showHidden = args.showHidden === true;
      const filePattern = args.filePattern as string | undefined;

      try {
        await fs.access(directory);
        const ignorePatterns = await getIgnorePatterns(directory);

        interface TreeNode {
          name: string;
          type: 'file' | 'directory';
          size?: number;
          children?: TreeNode[];
        }

        async function buildTree(dir: string, depth: number): Promise<TreeNode[]> {
          if (depth > maxDepth) return [];

          const entries = await fs.readdir(dir, { withFileTypes: true });
          const nodes: TreeNode[] = [];

          // Sort: directories first, then files, alphabetically
          const sorted = entries.sort((a, b) => {
            if (a.isDirectory() && !b.isDirectory()) return -1;
            if (!a.isDirectory() && b.isDirectory()) return 1;
            return a.name.localeCompare(b.name);
          });

          for (const entry of sorted) {
            // Skip hidden files unless requested
            if (!showHidden && entry.name.startsWith('.')) continue;

            const fullPath = path.join(dir, entry.name);
            const relativePath = path.relative(directory, fullPath);

            // Skip ignored patterns
            if (shouldIgnore(relativePath, ignorePatterns)) continue;

            if (entry.isDirectory()) {
              const children = await buildTree(fullPath, depth + 1);
              // Only include directory if it has children or we're at max depth
              if (children.length > 0 || depth >= maxDepth) {
                nodes.push({
                  name: entry.name,
                  type: 'directory',
                  children: children.length > 0 ? children : undefined,
                });
              }
            } else if (entry.isFile()) {
              // Check file pattern
              if (filePattern) {
                const ext = path.extname(entry.name);
                const patterns = filePattern.replace(/\{(.*?)\}/g, '$1').split(',').map(p => p.trim());
                const matches = patterns.some(p => {
                  if (p.startsWith('*.')) return ext === p.slice(1);
                  return entry.name.includes(p.replace('*', ''));
                });
                if (!matches) continue;
              }

              try {
                const stats = await fs.stat(fullPath);
                nodes.push({
                  name: entry.name,
                  type: 'file',
                  size: stats.size,
                });
              } catch {
                nodes.push({
                  name: entry.name,
                  type: 'file',
                });
              }
            }
          }

          return nodes;
        }

        const tree = await buildTree(directory, 1);
        
        // Convert tree to string representation
        function treeToString(nodes: TreeNode[], prefix = ''): string {
          let result = '';
          nodes.forEach((node, index) => {
            const isLast = index === nodes.length - 1;
            const connector = isLast ? '└── ' : '├── ';
            const sizeStr = node.size !== undefined ? ` (${formatSize(node.size)})` : '';
            result += `${prefix}${connector}${node.name}${node.type === 'directory' ? '/' : sizeStr}\n`;
            if (node.children) {
              const newPrefix = prefix + (isLast ? '    ' : '│   ');
              result += treeToString(node.children, newPrefix);
            }
          });
          return result;
        }

        function formatSize(bytes: number): string {
          if (bytes < 1024) return `${bytes}B`;
          if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
          return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
        }

        const treeString = treeToString(tree);

        return {
          success: true,
          data: {
            directory: directory,
            tree: treeString || '(empty directory)',
            structure: tree,
          },
        };
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : 'Failed to list directory',
        };
      }
    },
    { timeoutMs: 15000 }
  );

  // ===========================================================================
  // get_file_outline - Extract structure from code files
  // ===========================================================================
  registry.registerTool(
    {
      type: 'function',
      function: {
        name: 'get_file_outline',
        description: 'Extract the structure of a code file: functions, classes, interfaces, types, exports. Useful for understanding file organization without reading the entire file.',
        parameters: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'Path to the code file' },
          },
          required: ['filePath'],
        },
      },
    },
    async (args) => {
      const filePath = args.filePath as string;
      if (!filePath) {
        return { success: false, error: 'filePath is required' };
      }

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const ext = path.extname(filePath).toLowerCase();
        const lines = content.split('\n');

        interface OutlineItem {
          type: string;
          name: string;
          line: number;
          signature?: string;
          exported?: boolean;
        }

        const outline: OutlineItem[] = [];

        // Language-specific patterns
        const patterns: Record<string, RegExp[]> = {
          typescript: [
            /^export\s+(async\s+)?function\s+(\w+)/,
            /^export\s+(const|let)\s+(\w+)\s*=/,
            /^export\s+(class|interface|type|enum)\s+(\w+)/,
            /^(async\s+)?function\s+(\w+)/,
            /^(class|interface|type|enum)\s+(\w+)/,
            /^(const|let)\s+(\w+)\s*=\s*(async\s+)?\(/,
            /^(const|let)\s+(\w+)\s*=\s*(async\s+)?function/,
            /^\s+(async\s+)?(\w+)\s*\([^)]*\)\s*[:{]/,
          ],
          python: [
            /^def\s+(\w+)\s*\(/,
            /^async\s+def\s+(\w+)\s*\(/,
            /^class\s+(\w+)/,
            /^\s+def\s+(\w+)\s*\(self/,
            /^\s+async\s+def\s+(\w+)\s*\(self/,
          ],
          rust: [
            /^pub\s+(async\s+)?fn\s+(\w+)/,
            /^(async\s+)?fn\s+(\w+)/,
            /^pub\s+struct\s+(\w+)/,
            /^struct\s+(\w+)/,
            /^pub\s+enum\s+(\w+)/,
            /^enum\s+(\w+)/,
            /^impl\s+(\w+)/,
            /^pub\s+trait\s+(\w+)/,
            /^trait\s+(\w+)/,
          ],
          go: [
            /^func\s+(\w+)\s*\(/,
            /^func\s+\([^)]+\)\s*(\w+)\s*\(/,
            /^type\s+(\w+)\s+(struct|interface)/,
          ],
        };

        // Determine language from extension
        let lang = 'typescript';
        if (['.py'].includes(ext)) lang = 'python';
        else if (['.rs'].includes(ext)) lang = 'rust';
        else if (['.go'].includes(ext)) lang = 'go';
        else if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.mts'].includes(ext)) lang = 'typescript';

        const langPatterns = patterns[lang] || patterns.typescript;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!;
          const trimmed = line.trim();

          // Skip comments and empty lines
          if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
            continue;
          }

          for (const pattern of langPatterns!) {
            const match = line.match(pattern);
            if (match) {
              const isExported = line.includes('export') || line.startsWith('pub ');
              let type = 'unknown';
              let name = '';

              // Determine type and name based on what matched
              if (/function|fn|def/.test(match[0])) {
                type = 'function';
                name = match[2] || match[1] || '';
              } else if (/class/.test(match[0])) {
                type = 'class';
                name = match[2] || match[1] || '';
              } else if (/interface/.test(match[0])) {
                type = 'interface';
                name = match[2] || match[1] || '';
              } else if (/type(?!\s+\w+\s+(struct|interface))/.test(match[0])) {
                type = 'type';
                name = match[2] || match[1] || '';
              } else if (/enum/.test(match[0])) {
                type = 'enum';
                name = match[2] || match[1] || '';
              } else if (/struct/.test(match[0])) {
                type = 'struct';
                name = match[1] || '';
              } else if (/trait/.test(match[0])) {
                type = 'trait';
                name = match[1] || '';
              } else if (/impl/.test(match[0])) {
                type = 'impl';
                name = match[1] || '';
              } else if (/const|let/.test(match[0]) && /\(/.test(line)) {
                type = 'function';
                name = match[2] || '';
              } else if (/const|let/.test(match[0])) {
                type = 'constant';
                name = match[2] || '';
              }

              if (name && !outline.some(o => o.name === name && o.line === i + 1)) {
                outline.push({
                  type,
                  name,
                  line: i + 1,
                  signature: trimmed.slice(0, 100) + (trimmed.length > 100 ? '...' : ''),
                  exported: isExported,
                });
              }
              break;
            }
          }
        }

        // Also detect imports
        const imports: string[] = [];
        for (const line of lines) {
          if (/^import\s/.test(line) || /^from\s/.test(line) || /^use\s/.test(line)) {
            imports.push(line.trim().slice(0, 80));
          }
          // Stop after first non-import, non-comment, non-empty line
          if (line.trim() && !/^(import|from|use|\/\/|#|\/\*|\*)/.test(line.trim())) {
            break;
          }
        }

        return {
          success: true,
          data: {
            filePath,
            language: lang,
            totalLines: lines.length,
            imports: imports.slice(0, 20),
            outline: outline,
          },
        };
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : 'Failed to analyze file',
        };
      }
    },
    { timeoutMs: 10000 }
  );

  // ===========================================================================
  // run_tests - Execute project test commands
  // ===========================================================================
  registry.registerTool(
    {
      type: 'function',
      function: {
        name: 'run_tests',
        description: 'Run the test suite for the current project. Automatically detects the test framework (npm test, pytest, cargo test, go test, etc.) based on project files.',
        parameters: {
          type: 'object',
          properties: {
            directory: { type: 'string', description: 'Project directory (defaults to current working directory)' },
            testPath: { type: 'string', description: 'Specific test file or pattern to run' },
            watch: { type: 'boolean', description: 'Run tests in watch mode (if supported)' },
          },
        },
      },
    },
    async (args) => {
      const directory = (args.directory as string) || process.cwd();
      const testPath = args.testPath as string | undefined;
      const watch = args.watch === true;

      try {
        await fs.access(directory);

        // Detect project type and test command
        let testCmd = '';
        let framework = '';

        // Check for different project types
        const checks = [
          { file: 'package.json', framework: 'npm', getCmd: async () => {
            const pkg = JSON.parse(await fs.readFile(path.join(directory, 'package.json'), 'utf-8'));
            if (pkg.scripts?.test) {
              let cmd = 'npm test';
              if (watch && (pkg.scripts.test.includes('jest') || pkg.scripts['test:watch'])) {
                cmd = pkg.scripts['test:watch'] ? 'npm run test:watch' : 'npm test -- --watch';
              }
              if (testPath) cmd += ` -- ${testPath}`;
              return cmd;
            }
            // Check for common test frameworks
            if (pkg.devDependencies?.jest || pkg.dependencies?.jest) {
              let cmd = 'npx jest';
              if (watch) cmd += ' --watch';
              if (testPath) cmd += ` ${testPath}`;
              return cmd;
            }
            if (pkg.devDependencies?.vitest || pkg.dependencies?.vitest) {
              let cmd = 'npx vitest run';
              if (watch) cmd = 'npx vitest';
              if (testPath) cmd += ` ${testPath}`;
              return cmd;
            }
            if (pkg.devDependencies?.mocha || pkg.dependencies?.mocha) {
              let cmd = 'npx mocha';
              if (watch) cmd += ' --watch';
              if (testPath) cmd += ` ${testPath}`;
              return cmd;
            }
            return null;
          }},
          { file: 'Cargo.toml', framework: 'cargo', getCmd: async () => {
            let cmd = 'cargo test';
            if (testPath) cmd += ` ${testPath}`;
            return cmd;
          }},
          { file: 'go.mod', framework: 'go', getCmd: async () => {
            let cmd = 'go test ./...';
            if (testPath) cmd = `go test ${testPath}`;
            return cmd;
          }},
          { file: 'pytest.ini', framework: 'pytest', getCmd: async () => {
            let cmd = 'pytest';
            if (watch) cmd += ' --watch';
            if (testPath) cmd += ` ${testPath}`;
            return cmd;
          }},
          { file: 'setup.py', framework: 'pytest', getCmd: async () => {
            let cmd = 'pytest';
            if (testPath) cmd += ` ${testPath}`;
            return cmd;
          }},
          { file: 'requirements.txt', framework: 'pytest', getCmd: async () => {
            let cmd = 'pytest';
            if (testPath) cmd += ` ${testPath}`;
            return cmd;
          }},
        ];

        for (const check of checks) {
          try {
            await fs.access(path.join(directory, check.file));
            const cmd = await check.getCmd();
            if (cmd) {
              testCmd = cmd;
              framework = check.framework;
              break;
            }
          } catch {
            // File doesn't exist, try next
          }
        }

        if (!testCmd) {
          return {
            success: false,
            error: 'Could not detect test framework. Please specify a test command or ensure your project has a package.json, Cargo.toml, go.mod, or pytest.ini',
          };
        }

        // Execute tests
        const { stdout, stderr } = await execAsync(testCmd, {
          cwd: directory,
          maxBuffer: 10 * 1024 * 1024,
          timeout: watch ? undefined : 300000, // 5 min timeout unless watch mode
        });

        return {
          success: true,
          data: {
            framework,
            command: testCmd,
            output: (stdout + (stderr ? '\n' + stderr : '')).slice(0, 10000),
          },
        };
      } catch (e) {
        const error = e as { stdout?: string; stderr?: string; message?: string };
        // Test failures often return non-zero exit codes
        if (error.stdout || error.stderr) {
          return {
            success: true,
            data: {
              testsPassed: false,
              output: ((error.stdout || '') + '\n' + (error.stderr || '')).slice(0, 10000),
            },
          };
        }
        return {
          success: false,
          error: error.message || 'Failed to run tests',
        };
      }
    },
    { timeoutMs: 300000, requireConfirmation: true }
  );

  // ===========================================================================
  // git_status - Get current git repository status
  // ===========================================================================
  registry.registerTool(
    {
      type: 'function',
      function: {
        name: 'git_status',
        description: 'Get the current git status including branch, staged changes, unstaged changes, and untracked files.',
        parameters: {
          type: 'object',
          properties: {
            directory: { type: 'string', description: 'Repository directory (defaults to current working directory)' },
          },
        },
      },
    },
    async (args) => {
      const directory = (args.directory as string) || process.cwd();

      try {
        // Get branch name
        const { stdout: branch } = await execAsync('git branch --show-current', { cwd: directory });
        
        // Get status
        const { stdout: status } = await execAsync('git status --porcelain', { cwd: directory });
        
        // Get recent commits
        const { stdout: log } = await execAsync('git log --oneline -5', { cwd: directory });
        
        // Parse status
        const lines = status.trim().split('\n').filter(Boolean);
        const staged: string[] = [];
        const unstaged: string[] = [];
        const untracked: string[] = [];

        for (const line of lines) {
          const indexStatus = line[0];
          const workStatus = line[1];
          const file = line.slice(3);

          if (indexStatus === '?' && workStatus === '?') {
            untracked.push(file);
          } else {
            if (indexStatus && indexStatus !== ' ' && indexStatus !== '?') {
              staged.push(`${indexStatus} ${file}`);
            }
            if (workStatus && workStatus !== ' ' && workStatus !== '?') {
              unstaged.push(`${workStatus} ${file}`);
            }
          }
        }

        return {
          success: true,
          data: {
            branch: branch.trim(),
            staged,
            unstaged,
            untracked,
            recentCommits: log.trim().split('\n'),
            clean: lines.length === 0,
          },
        };
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : 'Failed to get git status',
        };
      }
    },
    { timeoutMs: 10000 }
  );

  // ===========================================================================
  // git_diff - Show changes in the repository
  // ===========================================================================
  registry.registerTool(
    {
      type: 'function',
      function: {
        name: 'git_diff',
        description: 'Show git diff for staged or unstaged changes. Can also compare branches or commits.',
        parameters: {
          type: 'object',
          properties: {
            directory: { type: 'string', description: 'Repository directory (defaults to current working directory)' },
            staged: { type: 'boolean', description: 'Show staged changes (default false shows unstaged)' },
            file: { type: 'string', description: 'Specific file to diff' },
            compare: { type: 'string', description: 'Compare with branch or commit (e.g., "main", "HEAD~1")' },
          },
        },
      },
    },
    async (args) => {
      const directory = (args.directory as string) || process.cwd();
      const staged = args.staged === true;
      const file = args.file as string | undefined;
      const compare = args.compare as string | undefined;

      try {
        let cmd = 'git diff';
        if (staged) cmd += ' --staged';
        if (compare) cmd += ` ${compare}`;
        if (file) cmd += ` -- "${file}"`;

        const { stdout } = await execAsync(cmd, { 
          cwd: directory,
          maxBuffer: 5 * 1024 * 1024,
        });

        // Truncate if too long
        const diff = stdout.length > 15000 
          ? stdout.slice(0, 15000) + '\n... [diff truncated, showing first 15000 chars]'
          : stdout;

        return {
          success: true,
          data: {
            diff: diff || '(no changes)',
            staged,
            file: file || null,
            compare: compare || null,
          },
        };
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : 'Failed to get git diff',
        };
      }
    },
    { timeoutMs: 15000 }
  );

  // ===========================================================================
  // git_commit - Create a git commit
  // ===========================================================================
  registry.registerTool(
    {
      type: 'function',
      function: {
        name: 'git_commit',
        description: 'Stage files and create a git commit. Can stage all changes or specific files.',
        parameters: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Commit message' },
            directory: { type: 'string', description: 'Repository directory (defaults to current working directory)' },
            files: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Specific files to stage (if not provided, stages all changes)' 
            },
            addAll: { type: 'boolean', description: 'Stage all changes including untracked files (default true)' },
          },
          required: ['message'],
        },
      },
    },
    async (args) => {
      const message = args.message as string;
      const directory = (args.directory as string) || process.cwd();
      const files = args.files as string[] | undefined;
      const addAll = args.addAll !== false;

      if (!message) {
        return { success: false, error: 'message is required' };
      }

      try {
        // Stage files
        if (files && files.length > 0) {
          for (const file of files) {
            await execAsync(`git add "${file}"`, { cwd: directory });
          }
        } else if (addAll) {
          await execAsync('git add -A', { cwd: directory });
        }

        // Create commit
        const { stdout } = await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { 
          cwd: directory 
        });

        // Get the commit hash
        const { stdout: hash } = await execAsync('git rev-parse --short HEAD', { cwd: directory });

        return {
          success: true,
          data: {
            message,
            hash: hash.trim(),
            output: stdout.trim(),
          },
        };
      } catch (e) {
        const error = e as { stdout?: string; stderr?: string; message?: string };
        // Check if it's "nothing to commit"
        if (error.stdout?.includes('nothing to commit') || error.stderr?.includes('nothing to commit')) {
          return {
            success: false,
            error: 'Nothing to commit. Working tree is clean.',
          };
        }
        return {
          success: false,
          error: error.message || 'Failed to create commit',
        };
      }
    },
    { timeoutMs: 30000, requireConfirmation: true }
  );

  // ===========================================================================
  // git_log - View commit history
  // ===========================================================================
  registry.registerTool(
    {
      type: 'function',
      function: {
        name: 'git_log',
        description: 'View git commit history with optional filtering.',
        parameters: {
          type: 'object',
          properties: {
            directory: { type: 'string', description: 'Repository directory (defaults to current working directory)' },
            count: { type: 'number', description: 'Number of commits to show (default 10)' },
            file: { type: 'string', description: 'Show commits for a specific file' },
            author: { type: 'string', description: 'Filter by author name/email' },
            since: { type: 'string', description: 'Show commits after date (e.g., "2024-01-01", "1 week ago")' },
            oneline: { type: 'boolean', description: 'Show one line per commit (default true)' },
          },
        },
      },
    },
    async (args) => {
      const directory = (args.directory as string) || process.cwd();
      const count = Math.min(Number(args.count) || 10, 100);
      const file = args.file as string | undefined;
      const author = args.author as string | undefined;
      const since = args.since as string | undefined;
      const oneline = args.oneline !== false;

      try {
        let cmd = `git log -${count}`;
        if (oneline) cmd += ' --oneline';
        else cmd += ' --pretty=format:"%h | %an | %ar | %s"';
        if (author) cmd += ` --author="${author}"`;
        if (since) cmd += ` --since="${since}"`;
        if (file) cmd += ` -- "${file}"`;

        const { stdout } = await execAsync(cmd, { cwd: directory });

        return {
          success: true,
          data: {
            commits: stdout.trim().split('\n').filter(Boolean),
            count: stdout.trim().split('\n').filter(Boolean).length,
          },
        };
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : 'Failed to get git log',
        };
      }
    },
    { timeoutMs: 10000 }
  );
}
