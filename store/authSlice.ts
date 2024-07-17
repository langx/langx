import { Models } from 'react-native-appwrite';
import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';

import { User } from '@/models/User';
import { Account } from '@/models/Account';
import { Session } from '@/models/Session';
import { Jwt } from '@/models/Jwt';
import {
  getCurrentUser,
  getCurrentSession,
  getAccount,
  createJWT,
} from '@/services/authService';

interface AuthState {
  isLoggedIn: boolean;
  isGuestIn: boolean;
  user: User | null;
  account: Account | null;
  session: Session | null;
  jwt: Jwt | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  isLoggedIn: false,
  isGuestIn: false,
  user: null,
  account: null,
  session: null,
  jwt: null,
  isLoading: true,
  error: null,
};

export const fetchAuthData = createAsyncThunk(
  'auth/fetchAuthData',
  async (_, { dispatch }) => {
    try {
      const [account, user, session, jwt]: [
        Account,
        User,
        Session,
        Models.Jwt
      ] = await Promise.all([
        getAccount(),
        getCurrentUser(),
        getCurrentSession(),
        createJWT(),
      ]);

      if (account) {
        dispatch(setAccount(account));
      }
      if (user) {
        dispatch(setUser(user));
      }
      if (session) {
        dispatch(setSession(session));
      }
      if (jwt) {
        dispatch(setJwt(jwt));
      }
    } catch (error) {
      console.error(error);
      dispatch(setError((error as Error).message || 'An error occurred'));
      dispatch(setUser(null));
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAccount: (state, action: PayloadAction<Account | null>) => {
      state.account = action.payload;
    },
    setUser: (state, action: PayloadAction<User | null>) => {
      state.user = action.payload;
    },
    setSession: (state, action: PayloadAction<Models.Session | null>) => {
      state.session = action.payload;
      !state.user ? (state.isGuestIn = true) : (state.isLoggedIn = true);
    },
    setJwt: (state, action: PayloadAction<Jwt | null>) => {
      state.jwt = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setAuthInitialState: (state) => {
      Object.assign(state, initialState);
      state.isLoading = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAuthData.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchAuthData.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(fetchAuthData.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'An error occurred';
      });
  },
});

export const {
  setAccount,
  setUser,
  setSession,
  setJwt,
  setLoading,
  setError,
  setAuthInitialState,
} = authSlice.actions;

export default authSlice.reducer;
