/**
 * Game Log Service
 *
 * Monitors and reads Sims 4 log files in real-time.
 * Used with the Sims Log Enabler mod to display game logs.
 */

/**
 * Name of the Log Enabler mod folder
 */
const LOG_ENABLER_FOLDER = 'Sims_Log_Enabler';

/**
 * Subfolder where logs are stored
 */
const LOGS_SUBFOLDER = 'Logs/Fallback';

/**
 * A single log entry
 */
export interface LogEntry {
  /** Timestamp from the log line */
  timestamp: string;
  /** Log level (INFO, WARN, ERROR, etc.) */
  level: string;
  /** The log message content */
  message: string;
  /** Source log file name */
  source: string;
  /** Raw line content */
  raw: string;
}

/**
 * State of a watched log file
 */
interface WatchedFile {
  filename: string;
  lastSize: number;
  lastModified: number;
}

/**
 * Options for watching logs
 */
interface WatchOptions {
  /** Include DEBUG level logs (default: false) */
  includeDebugLogs?: boolean;
}

/**
 * Callback for new log entries
 */
export type LogCallback = (entries: LogEntry[]) => void;

/**
 * Service for monitoring game log files
 */
export class GameLogService {
  private modsPath: string | null = null;
  private watchedFiles: Map<string, WatchedFile> = new Map();
  private pollInterval: NodeJS.Timeout | null = null;
  private callback: LogCallback | null = null;
  private isWatching = false;
  private includeDebugLogs = false;

  /**
   * Get the path to the logs folder
   */
  private async getLogsPath(): Promise<string | null> {
    if (!this.modsPath) return null;

    const logsPath = await window.electron.ipcRenderer.invoke('path:join', this.modsPath, LOG_ENABLER_FOLDER, LOGS_SUBFOLDER);
    const logsExist = await window.electron.ipcRenderer.invoke('fs:exists', logsPath);

    return logsExist ? logsPath : null;
  }

  /**
   * Parse a log line into a structured entry
   */
  private parseLogLine(line: string, source: string): LogEntry | null {
    if (!line.trim()) return null;

    // Format: "13:01:31.002010 [INFO] Message..."
    const match = line.match(/^(\d{2}:\d{2}:\d{2}\.\d+)\s+\[(\w+)\]\s+(.*)$/);

    if (match) {
      const level = match[2];

      // Skip DEBUG logs if not enabled
      if (level === 'DEBUG' && !this.includeDebugLogs) {
        return null;
      }

      return {
        timestamp: match[1],
        level,
        message: match[3],
        source,
        raw: line,
      };
    }

    // Skip lines containing [DEBUG] if not enabled (fallback check)
    if (!this.includeDebugLogs && line.includes('[DEBUG]')) {
      return null;
    }

    // Return as-is if format doesn't match
    return {
      timestamp: '',
      level: 'INFO',
      message: line,
      source,
      raw: line,
    };
  }

  /**
   * Read new content from a log file since last check
   */
  private async readNewContent(filePath: string, filename: string): Promise<LogEntry[]> {
    try {
      const content = await window.electron.ipcRenderer.invoke('fs:readTextFile', filePath);
      const entries: LogEntry[] = [];

      const watched = this.watchedFiles.get(filename);

      // For simplicity, we'll track by content length
      const currentSize = content.length;

      if (watched && currentSize <= watched.lastSize) {
        // No new content
        return [];
      }

      // Get new lines (approximate by taking last portion)
      const newContent = watched
        ? content.slice(watched.lastSize)
        : content;

      const newLines = newContent.split('\n').filter((l: string) => l.trim());

      for (const line of newLines) {
        const entry = this.parseLogLine(line, filename.replace('.log', ''));
        if (entry) {
          entries.push(entry);
        }
      }

      // Update watched state
      this.watchedFiles.set(filename, {
        filename,
        lastSize: currentSize,
        lastModified: Date.now(),
      });

      return entries;
    } catch (error) {
      console.error(`[GameLogService] Error reading ${filename}:`, error);
      return [];
    }
  }

  /**
   * Scan for log files and read new content
   */
  private async pollLogs(): Promise<void> {
    const logsPath = await this.getLogsPath();
    if (!logsPath) return;

    try {
      const entries = await window.electron.ipcRenderer.invoke('fs:readDir', logsPath);
      const allNewEntries: LogEntry[] = [];

      for (const entry of entries) {
        if (!entry.name.endsWith('.log')) continue;

        const filePath = await window.electron.ipcRenderer.invoke('path:join', logsPath, entry.name);
        const newEntries = await this.readNewContent(filePath, entry.name);
        allNewEntries.push(...newEntries);
      }

      // Sort by timestamp and notify
      if (allNewEntries.length > 0 && this.callback) {
        allNewEntries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        this.callback(allNewEntries);
      }
    } catch (error) {
      console.error('[GameLogService] Error polling logs:', error);
    }
  }

  /**
   * Start watching log files
   *
   * @param modsPath - Path to the Mods folder
   * @param callback - Function called with new log entries
   * @param intervalMs - Polling interval in milliseconds (default: 1000)
   * @param options - Watch options (includeDebugLogs, etc.)
   */
  async startWatching(
    modsPath: string,
    callback: LogCallback,
    intervalMs: number = 1000,
    options: WatchOptions = {}
  ): Promise<boolean> {
    if (this.isWatching) {
      this.stopWatching();
    }

    this.modsPath = modsPath;
    this.callback = callback;
    this.includeDebugLogs = options.includeDebugLogs ?? false;
    this.watchedFiles.clear();

    // Check if logs folder exists
    const logsPath = await this.getLogsPath();
    if (!logsPath) {
      console.warn('[GameLogService] Logs folder not found');
      return false;
    }

    this.isWatching = true;

    // Initial read of all existing content
    await this.pollLogs();

    // Start polling
    this.pollInterval = setInterval(() => {
      this.pollLogs();
    }, intervalMs);

    console.log('[GameLogService] Started watching logs');
    return true;
  }

  /**
   * Stop watching log files
   */
  stopWatching(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    this.isWatching = false;
    this.watchedFiles.clear();
    this.callback = null;

    console.log('[GameLogService] Stopped watching logs');
  }

  /**
   * Check if currently watching
   */
  isActive(): boolean {
    return this.isWatching;
  }

  /**
   * Get all current log files
   */
  async getLogFiles(): Promise<string[]> {
    const logsPath = await this.getLogsPath();
    if (!logsPath) return [];

    try {
      const entries = await window.electron.ipcRenderer.invoke('fs:readDir', logsPath);
      return entries
        .filter((e: any) => e.name.endsWith('.log'))
        .map((e: any) => e.name);
    } catch {
      return [];
    }
  }

  /**
   * Read entire content of a specific log file
   */
  async readLogFile(filename: string): Promise<LogEntry[]> {
    const logsPath = await this.getLogsPath();
    if (!logsPath) return [];

    try {
      const filePath = await window.electron.ipcRenderer.invoke('path:join', logsPath, filename);
      const content = await window.electron.ipcRenderer.invoke('fs:readTextFile', filePath);
      const lines = content.split('\n');
      const entries: LogEntry[] = [];

      for (const line of lines) {
        const entry = this.parseLogLine(line, filename.replace('.log', ''));
        if (entry) {
          entries.push(entry);
        }
      }

      return entries;
    } catch (error) {
      console.error(`[GameLogService] Error reading ${filename}:`, error);
      return [];
    }
  }

  /**
   * Clear logs folder (delete all .log files)
   *
   * @param modsPathOverride - Optional mods path if not currently watching
   */
  async clearLogs(modsPathOverride?: string): Promise<boolean> {
    const originalModsPath = this.modsPath;

    // Use override if provided
    if (modsPathOverride) {
      this.modsPath = modsPathOverride;
    }

    const logsPath = await this.getLogsPath();

    // Restore original
    if (modsPathOverride) {
      this.modsPath = originalModsPath;
    }

    if (!logsPath) return false;

    try {
      const entries = await window.electron.ipcRenderer.invoke('fs:readDir', logsPath);

      for (const entry of entries) {
        if (entry.name.endsWith('.log')) {
          const filePath = await window.electron.ipcRenderer.invoke('path:join', logsPath, entry.name);
          await window.electron.ipcRenderer.invoke('fs:remove', filePath);
        }
      }

      this.watchedFiles.clear();
      console.log('[GameLogService] Cleared all logs');
      return true;
    } catch (error) {
      console.error('[GameLogService] Error clearing logs:', error);
      return false;
    }
  }

  /**
   * Set mods path without starting watch
   */
  setModsPath(modsPath: string): void {
    this.modsPath = modsPath;
  }
}

// Export singleton instance
export const gameLogService = new GameLogService();
