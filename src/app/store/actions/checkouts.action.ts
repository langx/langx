import { createAction, props } from '@ngrx/store';

import { ActionTypes } from 'src/app/store/actions/types/checkouts.actiontypes';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { listCheckoutsResponseInterface } from 'src/app/models/types/responses/listCheckoutsResponse.interface';

// Get Checkouts Actions
export const getCheckoutsAction = createAction(ActionTypes.GET_CHECKOUTS);

export const getCheckoutsSuccessAction = createAction(
  ActionTypes.GET_CHECKOUTS_SUCCESS,
  props<{ payload: listCheckoutsResponseInterface }>()
);

export const getCheckoutsFailureAction = createAction(
  ActionTypes.GET_CHECKOUTS_FAILURE,
  props<{ error: ErrorInterface }>()
);

// Get Checkouts With Offset Actions
export const getCheckoutsWithOffsetAction = createAction(
  ActionTypes.GET_CHECKOUTS_WITH_OFFSET,
  props<{ request: { offset: number } }>()
);

export const getCheckoutsWithOffsetSuccessAction = createAction(
  ActionTypes.GET_CHECKOUTS_WITH_OFFSET_SUCCESS,
  props<{ payload: listCheckoutsResponseInterface }>()
);

export const getCheckoutsWithOffsetFailureAction = createAction(
  ActionTypes.GET_CHECKOUTS_WITH_OFFSET_FAILURE,
  props<{ error: ErrorInterface }>()
);
