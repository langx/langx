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

export function useRealtimeUsers() {
  const dispatch = useDispatch();

  useEffect(() => {
    console.log('USERS useRealtimeUser hook initialized');

    const unsubscribe = client.subscribe(
      `databases.${APP_DATABASE}.collections.${USERS_COLLECTION}.documents`,
      (response) => {
        console.log('USERS Database change detected:', response);
        // dispatch(updateRooms(response.payload as RoomExtendedInterface));
      }
    );

    return () => {
      console.log('USERS Unsubscribing from database changes for messages');
      unsubscribe();
    };
  }, [dispatch]);
}

export function useRealtimeRooms() {
  const dispatch = useDispatch();

  useEffect(() => {
    console.log('ROOMS useRealtimeRooms hook initialized');

    const unsubscribe = client.subscribe(
      `databases.${APP_DATABASE}.collections.${ROOMS_COLLECTION}.documents`,
      (response) => {
        console.log('ROOMS Database change detected:', response);
        // dispatch(updateRooms(response.payload as RoomExtendedInterface));
      }
    );

    return () => {
      console.log('ROOMS Unsubscribing from database changes for rooms');
      unsubscribe();
    };
  }, [dispatch]);
}

export function useRealtimeMessages() {
  const dispatch = useDispatch();

  useEffect(() => {
    console.log('MESSAGES useRealtimeMessages hook initialized');

    const unsubscribe = client.subscribe(
      `databases.${APP_DATABASE}.collections.${MESSAGES_COLLECTION}.documents`,
      (response) => {
        console.log('MESSAGES Database change detected:', response);
        // dispatch(updateRooms(response.payload as RoomExtendedInterface));
      }
    );

    return () => {
      console.log('MESSAGES Unsubscribing from database changes for messages');
      unsubscribe();
    };
  }, [dispatch]);
}
