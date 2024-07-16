import { useEffect } from 'react';
import { useDispatch } from 'react-redux';

import {
  APP_DATABASE,
  USERS_COLLECTION,
  ROOMS_COLLECTION,
  MESSAGES_COLLECTION,
} from '@/constants/config';
import { User } from '@/models/User';
import { Room } from '@/models/Room';
import { Message } from '@/models/Message';
import { client } from '@/services/apiService';
import { setUser } from '@/store/authSlice';
import { updateRooms, createRoomThunk } from '@/store/roomSlice';

export function useRealtime(currentUserId) {
  const dispatch = useDispatch();

  useEffect(() => {
    console.log('Realtime updates hook initialized');

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
            const createdMessage = response.payload;
            // console.log('[NOTIFICATION] Message Created');
            // dispatch(findRoomAndAddMessage(createdMessage));
            // dispatch(findActiveRoomAndAddMessage(createdMessage));
            break;
          case `databases.${APP_DATABASE}.collections.${MESSAGES_COLLECTION}.documents.*.update`:
            const updatedMessage = response.payload;
            // console.log('[NOTIFICATION] Message Updated');
            // dispatch(findRoomAndUpdateMessage(updatedMessage));
            // dispatch(findActiveRoomAndUpdateMessage(updatedMessage));
            break;
          case `databases.${APP_DATABASE}.collections.${MESSAGES_COLLECTION}.documents.*.delete`:
            const deletedMessage = response.payload;
            // console.log('[NOTIFICATION] Message Deleted');
            // dispatch(findRoomAndDeleteMessage(deletedMessage));
            // dispatch(findActiveRoomAndDeleteMessage(deletedMessage));
            break;
          default:
            break;
        }
      });
    });

    return () => {
      console.log('Unsubscribing from database changes');
      unsubscribe();
    };
  }, [dispatch, currentUserId]);
}
