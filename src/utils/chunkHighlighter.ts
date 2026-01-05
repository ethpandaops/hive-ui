import Prism from 'prismjs';
import 'prismjs/components/prism-log';

const CHUNK_SIZE = 200; // Lines per chunk

export interface HighlightProgress {
  highlightedLines: Map<number, string>;
  progress: number;
  done: boolean;
}

export type ProgressCallback = (update: HighlightProgress) => void;

export function highlightLinesAsync(
  lines: string[],
  onProgress: ProgressCallback
): () => void {
  let cancelled = false;
  const highlightedLines = new Map<number, string>();
  let currentIndex = 0;

  const processChunk = () => {
    if (cancelled) return;

    const endIndex = Math.min(currentIndex + CHUNK_SIZE, lines.length);

    // Process a chunk of lines
    for (let i = currentIndex; i < endIndex; i++) {
      const line = lines[i];
      try {
        const highlighted = Prism.highlight(line, Prism.languages.log, 'log');
        highlightedLines.set(i, highlighted);
      } catch {
        // If highlighting fails, just use plain text
        highlightedLines.set(i, escapeHtml(line));
      }
    }

    currentIndex = endIndex;
    const progress = Math.round((currentIndex / lines.length) * 100);
    const done = currentIndex >= lines.length;

    // Send progress update
    onProgress({
      highlightedLines: new Map(highlightedLines),
      progress,
      done,
    });

    // Continue if not done
    if (!done && !cancelled) {
      // Use requestIdleCallback if available, otherwise setTimeout
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => processChunk(), { timeout: 100 });
      } else {
        setTimeout(processChunk, 0);
      }
    }
  };

  // Start processing
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => processChunk(), { timeout: 100 });
  } else {
    setTimeout(processChunk, 0);
  }

  // Return cancel function
  return () => {
    cancelled = true;
  };
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
