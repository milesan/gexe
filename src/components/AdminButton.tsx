import React from 'react';
import { useSession } from '../hooks/useSession';

export function AdminButton() {
  const session = useSession();

  // Only show admin button for andre@thegarden.pt and redis213@gmail.com
  if (!session?.user?.email || (session.user.email !== 'andre@thegarden.pt' && session.user.email !== 'redis213@gmail.com')) {
    return null;
  }

  return null; // We don't need this component anymore since admin is in the nav
}