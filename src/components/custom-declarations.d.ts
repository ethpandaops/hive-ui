// This file provides TypeScript declarations for custom components
declare module './TestDetail' {
  import React from 'react';
  const TestDetail: React.ComponentType<Record<string, unknown>>;
  export default TestDetail;
}

declare module './LogViewer' {
  import React from 'react';
  const LogViewer: React.ComponentType<Record<string, unknown>>;
  export default LogViewer;
}
