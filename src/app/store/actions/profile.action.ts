import { createAction, props } from '@ngrx/store';

import { ActionTypes } from 'src/app/store/actions/types/profile.actiontypes';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { User } from 'src/app/models/User';

// Get Profile Actions
export const getProfileAction = createAction(
  ActionTypes.GET_PROFILE,
  // TODO: Add request interface
  props<{ userId: string }>()
);

export const getProfileSuccessAction = createAction(
  ActionTypes.GET_PROFILE_SUCCESS,
  // TODO: Add interface
  props<{ payload: User }>()
);

export const getProfileFailureAction = createAction(
  ActionTypes.GET_PROFILE_FAILURE,
  props<{ error: ErrorInterface }>()
);
