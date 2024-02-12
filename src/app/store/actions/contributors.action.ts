import { createAction, props } from '@ngrx/store';

import { ActionTypes } from 'src/app/store/actions/types/contributors.actiontypes';
import { User } from 'src/app/models/User';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';

// Get Contributors Actions
export const getContributorsAction = createAction(ActionTypes.GET_CONTRIBUTORS);

export const getContributorssSuccessAction = createAction(
  ActionTypes.GET_CONTRIBUTORS_SUCCESS,
  props<{ payload: User[] }>()
);

export const getContributorsFailureAction = createAction(
  ActionTypes.GET_CONTRIBUTORS_FAILED,
  props<{ error: ErrorInterface }>()
);
