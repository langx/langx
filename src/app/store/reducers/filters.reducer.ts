import { Action, createReducer, on } from '@ngrx/store';

import { FiltersStateInterface } from 'src/app/models/types/states/filtersState.interface';
import {
  getFiltersAction,
  setFiltersAction,
  clearFiltersAction,
} from 'src/app/store/actions/filters.action';
import {
  deleteAccountSuccessAction,
  logoutSuccessAction,
} from 'src/app/store/actions/auth.action';

const initialState: FiltersStateInterface = {
  filterData: null,
};

const filtersReducer = createReducer(
  initialState,

  // Get Filters Reducers
  on(
    getFiltersAction,
    (state): FiltersStateInterface => ({
      ...state,
    })
  ),
  // Set Filters Reducers
  on(
    setFiltersAction,
    (state, action): FiltersStateInterface => ({
      ...state,
      filterData: action.payload,
    })
  ),
  // Clear Filters Reducers
  on(clearFiltersAction, (): FiltersStateInterface => initialState),

  // Set initialState after Logout/Delete Success Action
  on(
    logoutSuccessAction,
    deleteAccountSuccessAction,
    (): FiltersStateInterface => ({
      ...initialState,
    })
  )
);

export function filtersReducers(state: FiltersStateInterface, action: Action) {
  return filtersReducer(state, action);
}
