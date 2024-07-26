import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store/store';

import {
  APP_DATABASE,
  USERS_COLLECTION,
  ROOMS_COLLECTION,
  MESSAGES_COLLECTION,
} from '@/constants/config';
import { User } from '@/models/User';
import { Room } from '@/models/Room';
import { Jwt } from '@/models/Jwt';
import { Message } from '@/models/Message';
import { client } from '@/services/apiService';
import { updateUser } from '@/services/userService';
import { setUser } from '@/store/authSlice';
import {
  updateRooms,
  createMessage,
  updateMessage,
  createRoomThunk,
} from '@/store/roomSlice';

export function useRealtime(currentUserId: string, jwt: Jwt) {
  const dispatch: AppDispatch = useDispatch();

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

  useEffect(() => {
    if (!currentUserId) return;
    console.log('[STARTED]: Realtime updates hook.');

    const channels = [
      `databases.${APP_DATABASE}.collections.${USERS_COLLECTION}.documents`,
      `databases.${APP_DATABASE}.collections.${ROOMS_COLLECTION}.documents`,
      `databases.${APP_DATABASE}.collections.${MESSAGES_COLLECTION}.documents`,
    ];

    const unsubscribe = client.subscribe(channels, (response) => {
      response.events.forEach((event) => {
        switch (event) {
          case `databases.${APP_DATABASE}.collections.${USERS_COLLECTION}.documents.*.update`:
            const updatedUser = response.payload as User;
            if (updatedUser.$id === currentUserId) {
              console.log('[NOTIFICATION] Updated Current User');
              dispatch(setUser(updatedUser));
              break;
            }
            // TODO: #873 Update other users
            break;
          case `databases.${APP_DATABASE}.collections.${ROOMS_COLLECTION}.documents.*.create`:
            const createdRoom = response.payload as Room;
            console.log('[NOTIFICATION] Created room');
            dispatch(createRoomThunk(createdRoom));
            break;
          case `databases.${APP_DATABASE}.collections.${ROOMS_COLLECTION}.documents.*.update`:
            const updatedRoom = response.payload as Room;
            console.log('[NOTIFICATION] Room Updated');
            dispatch(updateRooms(updatedRoom));
            break;
          case `databases.${APP_DATABASE}.collections.${MESSAGES_COLLECTION}.documents.*.create`:
            const createdMessage = response.payload as Message;
            console.log('[NOTIFICATION] Message Created');
            dispatch(createMessage(createdMessage));
            break;
          case `databases.${APP_DATABASE}.collections.${MESSAGES_COLLECTION}.documents.*.update`:
            const updatedMessage = response.payload as Message;
            console.log('[NOTIFICATION] Message Updated');
            dispatch(updateMessage(updatedMessage));
            break;
          // case `databases.${APP_DATABASE}.collections.${MESSAGES_COLLECTION}.documents.*.delete`:
          //   const deletedMessage = response.payload as Message;
          //   console.log('[NOTIFICATION] Message Deleted');
          //   break;
          default:
            break;
        }
      });
    });

    return () => {
      console.log('[TERMINATED]: Realtime updates hook.');
      unsubscribe();
    };
  }, [dispatch, currentUserId]);
}
