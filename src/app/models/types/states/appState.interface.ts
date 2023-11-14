// TODO: Not used yet, but will be used in the future
import { AuthStateInterface } from './authState.interface';
import { MessageStateInterface } from './messageState.interface';
import { RoomStateInterface } from './roomState.interface';
import { UserStateInterface } from './userState.interface';

export interface AppStateInterface {
  auth: AuthStateInterface;
  user: UserStateInterface;
  room: RoomStateInterface;
  message: MessageStateInterface;
}

/*
 * This is the root state of the app
 * It contains every substate of the app
 * How to use this interface:
 * Example:
 * const store = createStore(
 *  reducers,
 * initialState as AppStateInterface
 * );
 *
 */

/*
The AppStateInterface is typically used in NgRx to type the state parameter in selectors and effects. It represents the entire state of your application.
1- In your store configuration:

import { StoreModule } from '@ngrx/store';
import { AppStateInterface } from './appState.interface';
import { combinedReducer } from './combined.reducer';

@NgModule({
  imports: [
    StoreModule.forRoot<AppStateInterface>({ state: combinedReducer }),
    // other imports
  ],
  // other module configuration
})
export class AppModule { }

2- In your selectors:

import { createFeatureSelector, createSelector } from '@ngrx/store';
import { AppStateInterface } from './appState.interface';

export const selectState = createFeatureSelector<AppStateInterface>('state');

export const selectRoomState = createSelector(
  selectState,
  (state: AppStateInterface) => state.roomState
);

// create other selectors

3- In your effects:

import { Actions, ofType, createEffect } from '@ngrx/effects';
import { Store, select } from '@ngrx/store';
import { AppStateInterface } from './appState.interface';
import { getRoomByIdAction, getRoomByIdSuccessAction } from './actions';
import { selectRoomState } from './selectors';
import { Injectable } from '@angular/core';

@Injectable()
export class AppEffects {
  constructor(
    private actions$: Actions,
    private store: Store<AppStateInterface>
  ) {}

  getRoomById$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getRoomByIdAction),
      withLatestFrom(this.store.pipe(select(selectRoomState))),
      // other effect logic
    )
  );

  // define other effects
}

Sure, here's an example of a combinedReducer file using NgRx's combineReducers function. This example assumes you have separate reducers for auth, user, room, and message states.

import { ActionReducerMap, combineReducers } from '@ngrx/store';
import { AppStateInterface } from './appState.interface';
import { authReducer } from './auth.reducer';
import { userReducer } from './user.reducer';
import { roomReducer } from './room.reducer';
import { messageReducer } from './message.reducer';

export const reducers: ActionReducerMap<AppStateInterface> = {
  auth: authReducer,
  user: userReducer,
  room: roomReducer,
  message: messageReducer,
};

export const combinedReducer = combineReducers(reducers);

In this file, reducers is an object that maps each state field to its corresponding reducer. combineReducers is a function from NgRx that combines these reducers into a single reducer function, which you can then use in your store configuration.

Remember to replace authReducer, userReducer, roomReducer, and messageReducer with your actual reducer functions.
*/
