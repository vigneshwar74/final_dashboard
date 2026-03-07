import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { SocketProvider } from './context/SocketContext';
import Sidebar from './components/Sidebar';
import NotificationBell from './components/NotificationBell';
import ThemeToggle from './components/ThemeToggle';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ResourcesPage from './pages/ResourcesPage';
import BookingsPage from './pages/BookingsPage';
import CalendarPage from './pages/CalendarPage';
import ApprovalsPage from './pages/ApprovalsPage';
import AssignmentsPage from './pages/AssignmentsPage';
import MessagesPage from './pages/MessagesPage';
import StudentAssignmentsPage from './pages/StudentAssignmentsPage';
import AuditLogPage from './pages/AuditLogPage';
import FeedbackPage from './pages/FeedbackPage';
import ExamAllocationPage from './pages/ExamAllocationPage';
import OccupancyPage from './pages/OccupancyPage';

const ProtectedRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading"><div className="spinner"></div></div>;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="top-bar">
          <div className="top-bar-right">
            <ThemeToggle />
            <NotificationBell />
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  );
};

const AdminRoute = () => {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return <Outlet />;
};

const StaffRoute = () => {
  const { user } = useAuth();
  if (user?.role !== 'staff') return <Navigate to="/" replace />;
  return <Outlet />;
};

const StaffOrAdminRoute = () => {
  const { user } = useAuth();
  if (user?.role !== 'staff' && user?.role !== 'admin') return <Navigate to="/" replace />;
  return <Outlet />;
};

const PublicRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading"><div className="spinner"></div></div>;
  if (user) return <Navigate to="/" replace />;
  return <Outlet />;
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SocketProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<PublicRoute />}>
                <Route path="/login" element={<LoginPage />} />
              </Route>
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/messages" element={<MessagesPage />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/feedback" element={<FeedbackPage />} />
                <Route path="/occupancy" element={<OccupancyPage />} />
                <Route element={<AdminRoute />}>
                  <Route path="/resources" element={<ResourcesPage />} />
                  <Route path="/approvals" element={<ApprovalsPage />} />
                  <Route path="/assignments" element={<AssignmentsPage />} />
                  <Route path="/exam-allocations" element={<ExamAllocationPage />} />
                  <Route path="/audit-log" element={<AuditLogPage />} />
                </Route>
                <Route element={<StaffRoute />}>
                  <Route path="/bookings" element={<BookingsPage />} />
                  <Route path="/my-assignments" element={<AssignmentsPage />} />
                </Route>
                <Route element={<StaffOrAdminRoute />}>
                  <Route path="/student-activities" element={<StudentAssignmentsPage />} />
                </Route>
                <Route path="/my-activities" element={<StudentAssignmentsPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
