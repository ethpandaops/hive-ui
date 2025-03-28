import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TestResults from './components/TestResults';
import Header from './components/Header';
import Footer from './components/Footer';
import ThemeProvider from './contexts/theme-provider';
import { useState } from 'react';

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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MainApp />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
