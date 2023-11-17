import { createAction, props } from '@ngrx/store';

import { ActionTypes } from 'src/app/store/actions/types/profile.actiontypes';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';

// Get Profile Actions
export const getProfileAction = createAction(
  ActionTypes.GET_PROFILE,
  props<{ userId: string }>()
);

export const getProfileSuccessAction = createAction(
  ActionTypes.GET_PROFILE_SUCCESS,
  // TODO: Add interface
  props<{ payload: any }>()
);

export const getProfileFailureAction = createAction(
  ActionTypes.GET_PROFILE_FAILURE,
  props<{ error: ErrorInterface }>()
);
