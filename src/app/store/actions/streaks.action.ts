import { createAction, props } from '@ngrx/store';

import { ActionTypes } from 'src/app/store/actions/types/streaks.actiontypes';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { listStreaksResponseInterface } from 'src/app/models/types/responses/listStreaksResponse.interface';

// Get Streaks Actions
export const getStreaksAction = createAction(ActionTypes.GET_STREAKS);

export const getStreaksSuccessAction = createAction(
  ActionTypes.GET_STREAKS_SUCCESS,
  props<{ payload: listStreaksResponseInterface }>()
);

export const getStreaksFailureAction = createAction(
  ActionTypes.GET_STREAKS_FAILURE,
  props<{ error: ErrorInterface }>()
);

// Get Streaks With Offset Actions
export const getStreaksWithOffsetAction = createAction(
  ActionTypes.GET_STREAKS_WITH_OFFSET,
  props<{ request: { offset: number } }>()
);

export const getStreaksWithOffsetSuccessAction = createAction(
  ActionTypes.GET_STREAKS_WITH_OFFSET_SUCCESS,
  props<{ payload: listStreaksResponseInterface }>()
);

export const getStreaksWithOffsetFailureAction = createAction(
  ActionTypes.GET_STREAKS_WITH_OFFSET_FAILURE,
  props<{ error: ErrorInterface }>()
);

// Clear Errors Actions
export const clearErrorsAction = createAction(ActionTypes.CLEAR_ERRORS);
