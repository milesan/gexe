import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { MyBookings } from './MyBookings';
import { Book2Page } from '../pages/Book2Page';
import { AdminPage } from '../pages/AdminPage';
import { WhyPage } from '../pages/WhyPage';
import { useSession } from '../hooks/useSession';
import { useUserPermissions } from '../hooks/useUserPermissions';

export function AuthenticatedApp() {
  const { session, isLoading: sessionLoading } = useSession();
  const { isAdmin, hasHousekeeping, isLoading: permissionsLoading } = useUserPermissions(session);
  const location = useLocation();

  return (
    <>
      <Routes>
        <Route path="/" element={<Book2Page />} />
        <Route path="/my-bookings" element={<MyBookings />} />
        <Route path="/admin" element={
          (isAdmin || hasHousekeeping) ? (
            <AdminPage />
          ) : (
            <Navigate to="/" />
          )
        } />
        <Route path="/housekeeping" element={
          hasHousekeeping ? (
            <AdminPage housekeepingOnly={true} />
          ) : (
            <Navigate to="/" />
          )
        } />
        <Route path="/why" element={<WhyPage />} />
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}