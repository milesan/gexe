import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { MyBookings } from './MyBookings';
import { Book2Page } from '../pages/Book2Page';
import { AdminPage } from '../pages/AdminPage';
import { WhyPage } from '../pages/WhyPage';
import { useSession } from '../hooks/useSession';

export function AuthenticatedApp() {
  console.log('AuthenticatedApp: Rendering Routes');
  const session = useSession();
  const adminEmails = ['andre@thegarden.pt', 'redis213@gmail.com', 'dawn@thegarden.pt', 'simone@thegarden.pt', 'samjlloa@gmail.com', 'redis213+testadmin@gmail.com'];
  const isAdmin = session?.user?.email ? adminEmails.includes(session.user.email) : false;

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