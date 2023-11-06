import { createAction, props } from '@ngrx/store';
import { ActionTypes } from './actionTypes';

export const registerAction = createAction(
  ActionTypes.REGISTER,
  props<{ name: string; password: string; email: string }>()
);
