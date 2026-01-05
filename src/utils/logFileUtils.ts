export type LogFileMode = 'small' | 'large';

export interface LogFileConfig {
  mode: LogFileMode;
  enableHighlighting: boolean;
  enableVirtualization: boolean;
}

// Thresholds for file classification
const SMALL_FILE_MAX_LINES = 10000;
const SMALL_FILE_MAX_BYTES = 500 * 1024; // 500KB

export function classifyLogFile(lineCount: number, sizeBytes: number): LogFileConfig {
  // Small: < 10K lines AND < 500KB - use sync rendering with highlighting
  if (lineCount < SMALL_FILE_MAX_LINES && sizeBytes < SMALL_FILE_MAX_BYTES) {
    return {
      mode: 'small',
      enableHighlighting: true,
      enableVirtualization: false,
    };
  }

  // Large: anything else - use virtualization with async highlighting
  return {
    mode: 'large',
    enableHighlighting: true,
    enableVirtualization: true,
  };
}

export function splitIntoLines(content: string): string[] {
  const lines = content.split('\n');
  // Remove trailing empty line if content ends with newline
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines;
}

export function getFileSizeBytes(content: string): number {
  return new Blob([content]).size;
}
