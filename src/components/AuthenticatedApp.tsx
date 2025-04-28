import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { MyBookings } from './MyBookings';
import { Book2Page } from '../pages/Book2Page';
import { AdminPage } from '../pages/AdminPage';
import { WhyPage } from '../pages/WhyPage';
import { useSession } from '../hooks/useSession';
import { isAdminUser } from '../lib/authUtils';

export function AuthenticatedApp() {
  console.log('AuthenticatedApp: Rendering Routes');
  const { session, isLoading } = useSession();
  const isAdmin = isAdminUser(session);

  if (isLoading) {
    return <div>Loading session...</div>;
  }

  console.log('[AuthenticatedApp] isAdmin check result:', isAdmin);

  return (
    <>
      <Routes>
        <Route path="/" element={<Book2Page />} />
        <Route path="/my-bookings" element={<MyBookings />} />
        <Route path="/admin" element={isAdmin ? <AdminPage /> : <Navigate to="/" />} />
        <Route path="/why" element={<WhyPage />} />
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}