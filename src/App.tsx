import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import Groups from './components/Groups';
import Header from './components/Header';
import Footer from './components/Footer';
import ThemeProvider from './contexts/theme-provider';
import React from 'react';
import NotFound from './components/NotFound';

const queryClient = new QueryClient();

function MainApp() {

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-color)',
      color: 'var(--text-primary)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <Header />
      <main style={{ flex: 1 }}>
        <Groups />
      </main>
      <Footer />
    </div>
  );
}

// Create router with routes
const router = createHashRouter([
  {
    path: '/',
    element: <MainApp />
  },
  {
    path: '/test/:discoveryName/:suiteid',
    lazy: async () => {
      try {
        // Use unknown type instead of any
        const module = await import('./components/TestDetail') as unknown as { default: React.ComponentType<unknown> };
        return { Component: module.default };
      } catch (error) {
        console.error('Failed to load TestDetail component:', error);
        return {
          Component: () => <div>Test Details Loading Error</div>
        };
      }
    }
  },
  {
    path: '/compare/:discoveryName',
    lazy: async () => {
      try {
        // Use unknown type instead of any
        const module = await import('./components/TestComparison') as unknown as { default: React.ComponentType<unknown> };
        return { Component: module.default };
      } catch (error) {
        console.error('Failed to load TestComparison component:', error);
        return {
          Component: () => <div>Test Comparison Loading Error</div>
        };
      }
    }
  },
  {
    path: '/logs/:group/:suiteId/:logFile',
    lazy: async () => {
      try {
        // Use unknown type instead of any
        const module = await import('./components/LogViewer') as unknown as { default: React.ComponentType<unknown> };
        return { Component: module.default };
      } catch (error) {
        console.error('Failed to load LogViewer component:', error);
        return {
          Component: () => <div>Log Viewer Loading Error</div>
        };
      }
    }
  },
  {
    path: '/group/:name',
    lazy: async () => {
      try {
        const module = await import('./components/GroupDetail') as unknown as { default: React.ComponentType<unknown> };
        return { Component: module.default };
      } catch (error) {
        console.error('Failed to load GroupDetail component:', error);
        return {
          Component: () => <div>Group Detail Loading Error</div>
        };
      }
    }
  },
  {
    path: '*',
    element: <NotFound />
  }
]);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
