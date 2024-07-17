import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { jwtDecode } from 'jwt-decode';

import { RootState } from '@/store/store';
import { setJwt } from '@/store/authSlice';
import { createJWT } from '@/services/authService';
export const useAuth = () => {
  const dispatch = useDispatch();
  const jwt = useSelector((state: RootState) => state.auth.jwt);
  const currentUser = useSelector((state: RootState) => state.auth.user);

  useEffect(() => {
    const checkAndRenewJWT = async () => {
      if (jwt) {
        const { exp } = jwtDecode<{ exp: number }>(jwt.jwt);
        if (Date.now() >= exp * 1000) {
          try {
            const newJwt = await createJWT();
            dispatch(setJwt(newJwt));
          } catch (error) {
            console.error('Failed to renew JWT', error);
          }
        }
      }
    };

    checkAndRenewJWT();
  }, [jwt, dispatch]);

  return { jwt, currentUser };
};
