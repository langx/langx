import { useEffect } from 'react';
import { useDispatch } from 'react-redux';

import {
  APP_DATABASE,
  USERS_COLLECTION,
  ROOMS_COLLECTION,
  MESSAGES_COLLECTION,
} from '@/constants/config';
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
      console.log('Database change detected:', response);

      response.events.forEach((event) => {
        switch (event) {
          case `databases.${APP_DATABASE}.collections.${USERS_COLLECTION}.documents.${currentUserId}.update`:
            const updatedUser = response.payload;
            // dispatch(updateCurrentUserSuccess(updatedUser));
            break;
          case `databases.${APP_DATABASE}.collections.${MESSAGES_COLLECTION}.documents.*.create`:
            const createdMessage = response.payload;
            // dispatch(findRoomAndAddMessage(createdMessage));
            // dispatch(findActiveRoomAndAddMessage(createdMessage));
            break;
          case `databases.${APP_DATABASE}.collections.${MESSAGES_COLLECTION}.documents.*.update`:
            const updatedMessage = response.payload;
            // dispatch(findRoomAndUpdateMessage(updatedMessage));
            // dispatch(findActiveRoomAndUpdateMessage(updatedMessage));
            break;
          case `databases.${APP_DATABASE}.collections.${MESSAGES_COLLECTION}.documents.*.delete`:
            const deletedMessage = response.payload;
            // dispatch(findRoomAndDeleteMessage(deletedMessage));
            // dispatch(findActiveRoomAndDeleteMessage(deletedMessage));
            break;
          case `databases.${APP_DATABASE}.collections.${ROOMS_COLLECTION}.documents.*.create`:
            const createdRoom = response.payload;
            // dispatch(findOrAddRoom({ room: createdRoom, currentUserId }));
            break;
          case `databases.${APP_DATABASE}.collections.${ROOMS_COLLECTION}.documents.*.update`:
            const updatedRoom = response.payload;
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
