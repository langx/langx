import { createAction, props } from '@ngrx/store';

import { ActionTypes } from 'src/app/store/actions/types/filters.actiontypes';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { FilterDataInterface } from 'src/app/models/types/filterData.interface';

// Get Filters Actions
export const getFiltersAction = createAction(ActionTypes.GET_FILTERS);

export const getFiltersSuccessAction = createAction(
  ActionTypes.GET_FILTERS_SUCCESS,
  props<{ payload: FilterDataInterface }>()
);

export const getContributorsFailureAction = createAction(
  ActionTypes.GET_FILTERS_FAILURE,
  props<{ error: ErrorInterface }>()
);

// Set Filters Actions
export const setFiltersAction = createAction(
  ActionTypes.SET_FILTERS,
  props<{ payload: FilterDataInterface }>()
);

export const setFiltersSuccessAction = createAction(
  ActionTypes.SET_FILTERS_SUCCESS,
  props<{ payload: FilterDataInterface }>()
);

export const setFiltersFailureAction = createAction(
  ActionTypes.SET_FILTERS_FAILURE,
  props<{ error: ErrorInterface }>()
);
