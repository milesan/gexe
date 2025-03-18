import React from 'react';
import { useSession } from '../hooks/useSession';

export function AdminButton() {
  const session = useSession();

  // Only show admin button for andre@thegarden.pt, redis213@gmail.com, dawn@thegarden.pt, simone@thegarden.pt, samjlloa@gmail.com
  if (!session?.user?.email ||
      (session.user.email !== 'andre@thegarden.pt' &&
       session.user.email !== 'redis213@gmail.com' &&
       session.user.email !== 'dawn@thegarden.pt' &&
       session.user.email !== 'simone@thegarden.pt' &&
       session.user.email !== 'samjlloa@gmail.com')) {
    return null;
  }

  return null; // We don't need this component anymore since admin is in the nav
}