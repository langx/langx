import { createAction, props } from '@ngrx/store';

import { ActionTypes } from 'src/app/store/actions/types/visits.actiontypes';
import { User } from 'src/app/models/User';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';

export const getVisitsAction = createAction(ActionTypes.GET_VISITS);

export const getVisitsSuccessAction = createAction(
  ActionTypes.GET_VISITS_SUCCESS,
  props<{ payload: User[] }>()
);

export const getVisitsFailureAction = createAction(
  ActionTypes.GET_VISITS_FAILURE,
  props<{ error: ErrorInterface }>()
);
