import { Action, createReducer, on } from '@ngrx/store';

import { FiltersStateInterface } from 'src/app/models/types/states/filtersState.interface';
import {
  getFiltersAction,
  getFiltersSuccessAction,
  getFiltersFailureAction,
  setFiltersAction,
  setFiltersSuccessAction,
  setFiltersFailureAction,
} from 'src/app/store/actions/filters.action';
import {
  deleteAccountSuccessAction,
  logoutSuccessAction,
} from 'src/app/store/actions/auth.action';

const initialState: FiltersStateInterface = {
  isLoading: false,
  filterData: null,
  error: null,
};

const filtersReducer = createReducer(
  initialState,

  // Get Filters Reducers
  on(
    getFiltersAction,
    (state): FiltersStateInterface => ({
      ...state,
      isLoading: true,
      error: null,
    })
  ),
  on(
    getFiltersSuccessAction,
    (state, action): FiltersStateInterface => ({
      ...state,
      isLoading: false,
      filterData: action.payload,
    })
  ),
  on(
    getFiltersFailureAction,
    (state, action): FiltersStateInterface => ({
      ...state,
      isLoading: false,
      error: action.error,
    })
  ),

  // Set Filters Reducers
  on(
    setFiltersAction,
    (state): FiltersStateInterface => ({
      ...state,
      isLoading: true,
      error: null,
    })
  ),
  on(
    setFiltersSuccessAction,
    (state, action): FiltersStateInterface => ({
      ...state,
      isLoading: false,
      filterData: action.payload,
    })
  ),
  on(
    setFiltersFailureAction,
    (state, action): FiltersStateInterface => ({
      ...state,
      isLoading: false,
      error: action.error,
    })
  ),

  // Set initialState after Logout/Delete Success Action
  on(
    logoutSuccessAction,
    deleteAccountSuccessAction,
    (): FiltersStateInterface => ({
      ...initialState,
    })
  ),

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
