import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { APP_DATABASE, MESSAGES_COLLECTION } from '@/constants/config';
import { client } from '@/services/apiService';
// import { updateDataAction } from '@/store/dataSlice';

export function useRealtimeMessages(roomId: string) {
  const dispatch = useDispatch();

  useEffect(() => {
    console.log('useRealtimeMessages hook initialized', roomId);

    const unsubscribe = client.subscribe(
      `databases.${APP_DATABASE}.collections.${MESSAGES_COLLECTION}.documents`,
      (response) => {
        console.log('Database change detected:', response);
        // Uncomment and adjust based on your Redux setup
        // dispatch(updateDataAction(response));
      }
    );

    return () => {
      console.log('Unsubscribing from database changes for room:', roomId);
      unsubscribe();
    };
  }, [roomId, dispatch]);
}
