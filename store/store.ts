import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/store/authSlice';
import registerReducer from '@/store/registerSlice';
import userSlice from '@/store/userSlice';
import roomReducer from '@/store/roomSlice';

const store = configureStore({
  reducer: {
    auth: authReducer,
    register: registerReducer,
    user: userSlice,
    room: roomReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
