// Add declarations for lazy-loaded components
declare module '*.tsx' {
  import React from 'react';
  // Use unknown instead of any to satisfy eslint
  const Component: React.ComponentType<unknown>;
  export default Component;
}
