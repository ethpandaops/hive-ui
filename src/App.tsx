import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import TestResults from './components/TestResults';
import Header from './components/Header';
import Footer from './components/Footer';
import ThemeProvider from './contexts/theme-provider';
import { useState } from 'react';
import NotFound from './components/NotFound';

const queryClient = new QueryClient();

function MainApp() {
  const [showTables, setShowTables] = useState(true);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-color)',
      color: 'var(--text-primary)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <Header showTables={showTables} setShowTables={setShowTables} />
      <main style={{ flex: 1 }}>
        <TestResults showTables={showTables} />
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
        const module = await import('./components/TestDetail');
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
    path: '/logs/:group/:suiteId/:logFile',
    lazy: async () => {
      try {
        const module = await import('./components/LogViewer');
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
