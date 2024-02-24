import { createAction, props } from '@ngrx/store';

import { ActionTypes } from 'src/app/store/actions/types/sponsors.actiontypes';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { listUsersResponseInterface } from 'src/app/models/types/responses/listUsersResponse.interface';

// Get Sponsors Actions
export const getSponsorsAction = createAction(ActionTypes.GET_SPONSORS);

export const getSponsorsSuccessAction = createAction(
  ActionTypes.GET_SPONSORS_SUCCESS,
  props<{ payload: listUsersResponseInterface }>()
);

export const getSponsorsFailureAction = createAction(
  ActionTypes.GET_SPONSORS_FAILED,
  props<{ error: ErrorInterface }>()
);
