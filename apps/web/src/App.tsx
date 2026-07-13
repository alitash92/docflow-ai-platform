import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from './auth';
import Landing from './pages/Landing';
import LandingPaper from './pages/LandingPaper';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import Contact from './pages/Contact';
import Demo from './pages/Demo';
import Dashboard from './Dashboard';

/** Gate the dashboard behind the demo session; otherwise send to /signin. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { signedIn } = useAuth();
  const location = useLocation();
  if (!signedIn) {
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/demo" element={<LandingPaper />} />
          <Route path="/demo/live" element={<Demo />} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
