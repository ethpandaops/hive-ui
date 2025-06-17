import { RunMetadata } from '../types';

export function formatHiveCommand(command: string[]): string {
  return command
    .map(arg => {
      if (arg.includes(' ') || arg.includes('"') || arg.includes("'")) {
        return `"${arg.replace(/"/g, '\\"')}"`;
      }
      return arg;
    })
    .join(' ');
}

export function formatCommitDate(commitDate: string): string {
  try {
    const date = new Date(commitDate);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return commitDate;
  }
}

export function formatCommitHash(commit: string): string {
  return commit.length > 7 ? commit.substring(0, 7) : commit;
}

export function getVersionDisplayText(hiveVersion: RunMetadata['hiveVersion']): string {
  const shortCommit = formatCommitHash(hiveVersion.commit);
  const dirtyIndicator = hiveVersion.dirty ? ' (dirty)' : '';
  return `${hiveVersion.branch}@${shortCommit}${dirtyIndicator}`;
}

export function parseConfigContent(content: unknown): { isValid: boolean; formatted: string } {
  try {
    if (typeof content === 'string') {
      const parsed = JSON.parse(content);
      return {
        isValid: true,
        formatted: JSON.stringify(parsed, null, 2)
      };
    } else if (typeof content === 'object') {
      return {
        isValid: true,
        formatted: JSON.stringify(content, null, 2)
      };
    }
    return {
      isValid: false,
      formatted: String(content)
    };
  } catch {
    return {
      isValid: false,
      formatted: typeof content === 'string' ? content : String(content)
    };
  }
}

export function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text)
      .then(() => true)
      .catch(() => false);
  } else {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const result = document.execCommand('copy');
      document.body.removeChild(textArea);
      return Promise.resolve(result);
    } catch {
      document.body.removeChild(textArea);
      return Promise.resolve(false);
    }
  }
}