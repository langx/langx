import { useEffect } from 'react';
import { useDispatch } from 'react-redux';

import {
  APP_DATABASE,
  USERS_COLLECTION,
  ROOMS_COLLECTION,
  MESSAGES_COLLECTION,
} from '@/constants/config';
import { client } from '@/services/apiService';
// import { updateRooms } from '@/store/roomSlice';

export function useRealtimeUser() {
  const dispatch = useDispatch();

  useEffect(() => {
    console.log('useRealtimeUser hook initialized');

    const unsubscribe = client.subscribe(
      `databases.${APP_DATABASE}.collections.${USERS_COLLECTION}.documents`,
      (response) => {
        console.log('Database change detected:', response);
        // dispatch(updateRooms(response.payload as RoomExtendedInterface));
      }
    );

    return () => {
      console.log('Unsubscribing from database changes for messages');
      unsubscribe();
    };
  }, [dispatch]);
}

export function useRealtimeRooms() {
  const dispatch = useDispatch();

  useEffect(() => {
    console.log('useRealtimeRooms hook initialized');

    const unsubscribe = client.subscribe(
      `databases.${APP_DATABASE}.collections.${ROOMS_COLLECTION}.documents`,
      (response) => {
        console.log('Database change detected:', response);
        // dispatch(updateRooms(response.payload as RoomExtendedInterface));
      }
    );

    return () => {
      console.log('Unsubscribing from database changes for rooms');
      unsubscribe();
    };
  }, [dispatch]);
}

export function useRealtimeMessages() {
  const dispatch = useDispatch();

  useEffect(() => {
    console.log('useRealtimeMessages hook initialized');

    const unsubscribe = client.subscribe(
      `databases.${APP_DATABASE}.collections.${MESSAGES_COLLECTION}.documents`,
      (response) => {
        console.log('Database change detected:', response);
        // dispatch(updateRooms(response.payload as RoomExtendedInterface));
      }
    );

    return () => {
      console.log('Unsubscribing from database changes for messages');
      unsubscribe();
    };
  }, [dispatch]);
}
