import { useEffect } from 'react';
import { useDispatch } from 'react-redux';

import {
  APP_DATABASE,
  USERS_COLLECTION,
  ROOMS_COLLECTION,
  MESSAGES_COLLECTION,
} from '@/constants/config';
import { User } from '@/models/User';
import { setUser } from '@/store/authSlice';
import { client } from '@/services/apiService';

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
          case `databases.${APP_DATABASE}.collections.${USERS_COLLECTION}.documents.${currentUserId}.update`:
            const updatedUser = response.payload as User;
            console.log('[NOTIFICATION] Updated user');
            dispatch(setUser(updatedUser));
            break;
          case `databases.${APP_DATABASE}.collections.${MESSAGES_COLLECTION}.documents.*.create`:
            const createdMessage = response.payload;
            // console.log('[NOTIFICATION] Created message:', createdMessage);
            // dispatch(findRoomAndAddMessage(createdMessage));
            // dispatch(findActiveRoomAndAddMessage(createdMessage));
            break;
          case `databases.${APP_DATABASE}.collections.${MESSAGES_COLLECTION}.documents.*.update`:
            const updatedMessage = response.payload;
            // console.log('[NOTIFICATION] Updated message:', updatedMessage);
            // dispatch(findRoomAndUpdateMessage(updatedMessage));
            // dispatch(findActiveRoomAndUpdateMessage(updatedMessage));
            break;
          case `databases.${APP_DATABASE}.collections.${MESSAGES_COLLECTION}.documents.*.delete`:
            const deletedMessage = response.payload;
            // console.log('[NOTIFICATION] Deleted message:', deletedMessage);
            // dispatch(findRoomAndDeleteMessage(deletedMessage));
            // dispatch(findActiveRoomAndDeleteMessage(deletedMessage));
            break;
          case `databases.${APP_DATABASE}.collections.${ROOMS_COLLECTION}.documents.*.create`:
            const createdRoom = response.payload;
            // console.log('[NOTIFICATION] Created room:', createdRoom);
            // dispatch(findOrAddRoom({ room: createdRoom, currentUserId }));
            break;
          case `databases.${APP_DATABASE}.collections.${ROOMS_COLLECTION}.documents.*.update`:
            const updatedRoom = response.payload;
            // console.log('[NOTIFICATION] Updated room:', updatedRoom);
            // dispatch(findAndUpdateRoomUpdatedAt(updatedRoom));
            // dispatch(findAndUpdateActiveRoomUpdatedAt(updatedRoom));
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
