import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/store/authSlice';
import userSlice from '@/store/userSlice';
import roomReducer from '@/store/roomSlice';

const store = configureStore({
  reducer: {
    auth: authReducer,
    user: userSlice,
    room: roomReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
