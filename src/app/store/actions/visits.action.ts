import { createAction, props } from '@ngrx/store';

import { ActionTypes } from 'src/app/store/actions/types/visits.actiontypes';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { listVisitsResponseInterface } from 'src/app/models/types/responses/listVisitsResponse.interface';

// Get Visits Actions
export const getVisitsAction = createAction(ActionTypes.GET_VISITS);

export const getVisitsSuccessAction = createAction(
  ActionTypes.GET_VISITS_SUCCESS,
  props<{ payload: listVisitsResponseInterface }>()
);

export const getVisitsFailureAction = createAction(
  ActionTypes.GET_VISITS_FAILURE,
  props<{ error: ErrorInterface }>()
);

// Get Visits With Offset Actions
export const getVisitsWithOffsetAction = createAction(
  ActionTypes.GET_VISITS_WITH_OFFSET,
  props<{ offset: number }>()
);

export const getVisitsWithOffsetSuccessAction = createAction(
  ActionTypes.GET_VISITS_WITH_OFFSET_SUCCESS,
  props<{ payload: listVisitsResponseInterface }>()
);

export const getVisitsWithOffsetFailureAction = createAction(
  ActionTypes.GET_VISITS_WITH_OFFSET_FAILURE,
  props<{ error: ErrorInterface }>()
);
