import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { MyBookings } from './MyBookings';
import { Book2Page } from '../pages/Book2Page';
import { AdminPage } from '../pages/AdminPage';
import { WhyPage } from '../pages/WhyPage';
import { useSession } from '../hooks/useSession';
import { useUserPermissions } from '../hooks/useUserPermissions';

export function AuthenticatedApp() {
  console.log('AuthenticatedApp: Rendering Routes');
  const { session, isLoading: sessionLoading } = useSession();
  const { isAdmin, hasHousekeeping, isLoading: permissionsLoading } = useUserPermissions(session);
  const location = useLocation();

  console.log('[AuthenticatedApp] Loading states:', { sessionLoading, permissionsLoading });
  console.log('[AuthenticatedApp] Access check results:', { isAdmin, hasHousekeeping });
  console.log('[AuthenticatedApp] Current location:', { pathname: location.pathname });

  return (
    <>
      <Routes>
        <Route path="/" element={<Book2Page />} />
        <Route path="/my-bookings" element={<MyBookings />} />
        <Route path="/admin" element={
          (isAdmin || hasHousekeeping) ? (
            <AdminPage />
          ) : (
            (() => {
              console.log('[AuthenticatedApp] Access denied to /admin, redirecting to /');
              return <Navigate to="/" />;
            })()
          )
        } />
        <Route path="/housekeeping" element={
          hasHousekeeping ? (
            <AdminPage housekeepingOnly={true} />
          ) : (
            (() => {
              console.log('[AuthenticatedApp] Access denied to /housekeeping, redirecting to /');
              return <Navigate to="/" />;
            })()
          )
        } />
        <Route path="/why" element={<WhyPage />} />
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}