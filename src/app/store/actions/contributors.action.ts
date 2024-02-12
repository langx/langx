import { createAction, props } from '@ngrx/store';

import { ActionTypes } from 'src/app/store/actions/types/contributors.actiontypes';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { listUsersResponseInterface } from 'src/app/models/types/responses/listUsersResponse.interface';

// Get Contributors Actions
export const getContributorsAction = createAction(ActionTypes.GET_CONTRIBUTORS);

export const getContributorsSuccessAction = createAction(
  ActionTypes.GET_CONTRIBUTORS_SUCCESS,
  props<{ payload: listUsersResponseInterface }>()
);

export const getContributorsFailureAction = createAction(
  ActionTypes.GET_CONTRIBUTORS_FAILED,
  props<{ error: ErrorInterface }>()
);
