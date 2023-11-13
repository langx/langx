import { createFeatureSelector, createSelector } from '@ngrx/store';

import { RoomStateInterface } from 'src/app/models/types/states/roomState.interface';

export const roomFeatureSelector =
  createFeatureSelector<RoomStateInterface>('room');

export const isLoadingSelector = createSelector(
  roomFeatureSelector,
  (roomState: RoomStateInterface) => roomState.isLoading
);

export const roomsSelector = createSelector(
  roomFeatureSelector,
  (roomState: RoomStateInterface) => roomState.rooms
);

export const totalRoomsSelector = createSelector(
  roomFeatureSelector,
  (roomState: RoomStateInterface) => roomState.total_rooms
);

export const errorRoomsSelector = createSelector(
  roomFeatureSelector,
  (roomState: RoomStateInterface) => roomState.error_rooms
);

export const messagesSelector = createSelector(
  roomFeatureSelector,
  (roomState: RoomStateInterface) => roomState.messages
);

export const totalMessagesSelector = createSelector(
  roomFeatureSelector,
  (roomState: RoomStateInterface) => roomState.total_messages
);

export const errorMessagesSelector = createSelector(
  roomFeatureSelector,
  (roomState: RoomStateInterface) => roomState.error_messages
);
