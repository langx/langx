import { useEffect } from 'react';

import { Jwt } from '@/models/Jwt';
import { updateUser } from '@/services/userService';
import { PRESENCE_INTERVAL } from '@/constants/config';

export function usePresence(currentUserId: string, jwt: Jwt) {
  useEffect(() => {
    if (!currentUserId || !jwt) {
      // console.log(
      //   '[SKIPPED]: No user ID or JWT provided for Presence updates.'
      // );
      return;
    }

    console.log('[STARTED]: User presence hook.');
    const updateUserPresence = () => {
      updateUser(currentUserId, jwt, { lastSeen: new Date().toISOString() });
    };

    const intervalId = setInterval(updateUserPresence, PRESENCE_INTERVAL);
    return () => {
      console.log('[TERMINATED]: User presence hook.');
      clearInterval(intervalId);
    };
  }, [currentUserId, jwt]);
}
