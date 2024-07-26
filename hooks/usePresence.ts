import { useEffect } from 'react';

import { Jwt } from '@/models/Jwt';
import { updateUser } from '@/services/userService';

export function usePresence(currentUserId: string, jwt: Jwt) {
  useEffect(() => {
    if (!currentUserId || !jwt) return;

    console.log('[STARTED]: User presence hook.');
    const updateUserPresence = () => {
      updateUser(currentUserId, jwt, { lastSeen: new Date().toISOString() });
    };

    const intervalId = setInterval(updateUserPresence, 5 * 1000);
    return () => {
      console.log('[TERMINATED]: User presence hook.');
      clearInterval(intervalId);
    };
  }, [currentUserId, jwt]);
}
