import { createFeatureSelector, createSelector } from '@ngrx/store';

import { RoomsStateInterface } from 'src/app/models/types/states/roomsState.interface';

export const roomsFeatureSelector =
  createFeatureSelector<RoomsStateInterface>('rooms');

export const isLoadingSelector = createSelector(
  roomsFeatureSelector,
  (roomState: RoomsStateInterface) => roomState.isLoading
);

export const roomSelector = createSelector(
  roomsFeatureSelector,
  (roomState: RoomsStateInterface) => roomState.room
);

export const roomsSelector = createSelector(
  roomsFeatureSelector,
  (roomState: RoomsStateInterface) => roomState.rooms
);

export const totalSelector = createSelector(
  roomsFeatureSelector,
  (roomState: RoomsStateInterface) => roomState.total
);

export const errorSelector = createSelector(
  roomsFeatureSelector,
  (roomState: RoomsStateInterface) => roomState.error
);
