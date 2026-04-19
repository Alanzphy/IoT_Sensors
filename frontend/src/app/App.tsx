import { RouterProvider } from 'react-router';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import { router } from './routes';

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ToastProvider>
  );
}
