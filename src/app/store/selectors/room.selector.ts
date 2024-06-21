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

export const totalSelector = createSelector(
  roomFeatureSelector,
  (roomState: RoomStateInterface) => roomState.total
);

export const archivedRoomsSelector = createSelector(
  roomFeatureSelector,
  (roomState: RoomStateInterface) => roomState.archivedRooms
);

export const archivedTotalSelector = createSelector(
  roomFeatureSelector,
  (roomState: RoomStateInterface) => roomState.archivedTotal
);

export const errorSelector = createSelector(
  roomFeatureSelector,
  (roomState: RoomStateInterface) => roomState.error
);

export const createRoomErrorSelector = createSelector(
  roomFeatureSelector,
  (roomState: RoomStateInterface) => roomState.createRoomError
);
