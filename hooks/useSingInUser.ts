import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';

import { createJWT, getAccount, getCurrentUser } from '@/services/authService';
import {
  setAccount,
  setError,
  setJwt,
  setSession,
  setUser,
} from '@/store/authSlice';

const useSignInUser = () => {
  const dispatch = useDispatch();
  const router = useRouter();

  const signInUser = useCallback(
    async (session) => {
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

        router.push('/(home)/(tabs)');
        Alert.alert('Success', 'User signed in successfully');
      } catch (error) {
        dispatch(setError(error.message || 'An error occurred'));
        console.error('Error signing in user:', error);
        Alert.alert('Error', 'Failed to sign in user');
      }
    },
    [dispatch, router]
  );

  return signInUser;
};

export default useSignInUser;
