import { createFeatureSelector, createSelector } from '@ngrx/store';

import { MessageStateInterface } from 'src/app/models/types/states/messageState.interface';

export const messageFeatureSelector =
  createFeatureSelector<MessageStateInterface>('message');

export const isLoadingSelector = createSelector(
  messageFeatureSelector,
  (messageState: MessageStateInterface) => messageState.isLoading
);

export const messagesSelector = createSelector(
  messageFeatureSelector,
  (messageState: MessageStateInterface) => messageState.messages
);

export const totalSelector = createSelector(
  messageFeatureSelector,
  (messageState: MessageStateInterface) => messageState.total
);

export const errorSelector = createSelector(
  messageFeatureSelector,
  (messageState: MessageStateInterface) => messageState.error
);
