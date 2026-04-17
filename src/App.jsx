import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import AppRoutes from './routes/AppRoutes';
import { queryClient } from './lib/queryClient';
import { AuthProvider } from './contexts/AuthContext';
import { applyTheme, getStoredThemeMode } from './lib/theme';

function App() {
  useEffect(() => {
    applyTheme(getStoredThemeMode());
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
