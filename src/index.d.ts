// Allow TypeScript to import .tsx files
declare module '*.tsx' {
  import React from 'react';
  const Component: React.ComponentType<Record<string, unknown>>;
  export default Component;
}
