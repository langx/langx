import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { User } from '@/models/User';

interface UserState {
  users: User[];
  isLoading: boolean;
  error: string | null;
}

const initialState: UserState = {
  users: [],
  isLoading: false,
  error: null,
};

const userSlice = createSlice({
  name: 'user',
  initialState: initialState as UserState,
  reducers: {
    setUsers: (state, action: PayloadAction<User[]>) => {
      state.users = action.payload;
    },
    updateUser: (state, action: PayloadAction<User>) => {
      const userIndex = state.users.findIndex(
        (user: User) => user.$id === action.payload.$id
      );

      // if (userIndex !== -1) {
      //   if (
      //     action.payload.lastMessageUpdatedAt >
      //     state.rooms[roomIndex].lastMessageUpdatedAt
      //   ) {
      //     const updatedRoom: RoomExtendedInterface = {
      //       ...state.rooms[roomIndex],
      //       ...action.payload,
      //       userData: state.rooms[roomIndex].userData,
      //       messages: state.rooms[roomIndex].messages,
      //     };
      //     state.rooms.splice(roomIndex, 1);
      //     state.rooms.unshift(updatedRoom);
      //   } else {
      //     state.rooms[roomIndex] = {
      //       ...state.rooms[roomIndex],
      //       ...action.payload,
      //     };
      //   }
      // }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setUserInitialState: (state) => {
      Object.assign(state, initialState);
    },
  },
});

export const {
  setUsers,
  updateUser,
  setLoading,
  setError,
  setUserInitialState,
} = userSlice.actions;

export default userSlice.reducer;
