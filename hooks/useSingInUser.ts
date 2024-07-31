import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { useRouter } from 'expo-router';

import { Session } from '@/models/Session';
import { createJWT, getAccount, getCurrentUser } from '@/services/authService';
import {
  setAccount,
  setError,
  setJwt,
  setSession,
  setUser,
} from '@/store/authSlice';
import { showToast } from '@/constants/toast';

const useSignInUser = () => {
  const dispatch = useDispatch();
  const router = useRouter();

  const signInUser = useCallback(
    async (session: Session) => {
      try {
        const [account, user] = await Promise.all([
          getAccount(),
          getCurrentUser(),
        ]);
        const jwt = await createJWT();
        dispatch(setAccount(account));
        dispatch(setUser(user));
        dispatch(setSession(session));
        dispatch(setJwt(jwt));

        router.replace('/(home)/(tabs)');
        showToast('success', 'User signed in successfully');
      } catch (error) {
        dispatch(setError(error.message || 'An error occurred'));
        console.error('Error signing in user:', error);
        showToast('error', 'Failed to sign in user');
      }
    },
    [dispatch, router]
  );

  return signInUser;
};

export default useSignInUser;
