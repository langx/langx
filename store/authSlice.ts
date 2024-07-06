import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";

import { User } from "@/models/User";
import { getCurrentUser, getCurrentSession } from "@/services/authService";

interface AuthState {
  isLoggedIn: boolean;
  isGuestIn: boolean;
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  isLoggedIn: false,
  isGuestIn: false,
  user: null,
  isLoading: true,
  error: null,
};

export const fetchAuthData = createAsyncThunk(
  "auth/fetchAuthData",
  async (_, { dispatch }) => {
    try {
      const [user, session] = await Promise.all([
        getCurrentUser(),
        getCurrentSession(),
      ]);

      if (user) {
        dispatch(setUser(user));
      }
      if (session) {
        dispatch(setGuest(session));
      }
    } catch (error) {
      console.error(error);
      dispatch(setError(error.message || "An error occurred"));
      dispatch(setUser(null));
    } finally {
    }
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User | null>) => {
      state.user = action.payload;
      state.isLoggedIn = !!action.payload;
    },
    setGuest: (state, action) => {
      state.isGuestIn = !!action.payload;
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
    builder.addCase(fetchAuthData.pending, (state) => {
      state.isLoading = true;
    });
    builder.addCase(fetchAuthData.fulfilled, (state) => {
      state.isLoading = false;
    });
    builder.addCase(fetchAuthData.rejected, (state) => {
      state.isLoading = false;
      setError("An error occurred");
    });
  },
});

export const { setUser, setGuest, setLoading, setError, setAuthInitialState } =
  authSlice.actions;
export default authSlice.reducer;
