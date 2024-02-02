import { Injectable } from '@angular/core';
import { createEffect, ofType, Actions } from '@ngrx/effects';
import { HttpErrorResponse } from '@angular/common/http';
import { Store, select } from '@ngrx/store';
import { catchError, map, of, switchMap, withLatestFrom } from 'rxjs';

import { UserService } from 'src/app/services/user/user.service';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { listUsersResponseInterface } from 'src/app/models/types/responses/listUsersResponse.interface';
import { currentUserSelector } from 'src/app/store/selectors/auth.selector';

import {
  getUsersByCreatedAtAction,
  getUsersByCreatedAtFailureAction,
  getUsersByCreatedAtSuccessAction,
  getUsersByCreatedAtWithOffsetAction,
  getUsersByCreatedAtWithOffsetFailureAction,
  getUsersByCreatedAtWithOffsetSuccessAction,
  getUsersByLastSeenAction,
  getUsersByLastSeenFailureAction,
  getUsersByLastSeenSuccessAction,
  getUsersByLastSeenWithOffsetAction,
  getUsersByLastSeenWithOffsetFailureAction,
  getUsersByLastSeenWithOffsetSuccessAction,
} from 'src/app/store/actions/users.action';

@Injectable()
export class UsersEffects {
  // Get Users By Last Seen Effects
  getUsersByLastSeen$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getUsersByLastSeenAction),
      withLatestFrom(this.store.pipe(select(currentUserSelector))),
      switchMap(([{ request }, currentUser]) =>
        this.userService
          .listUsersByLastSeen(currentUser, request.filterData)
          .pipe(
            map((payload: listUsersResponseInterface) =>
              getUsersByLastSeenSuccessAction({ payload })
            ),

            catchError((errorResponse: HttpErrorResponse) => {
              const error: ErrorInterface = {
                message: errorResponse.message,
              };
              return of(getUsersByLastSeenFailureAction({ error }));
            })
          )
      )
    )
  );

  getUsersByLastSeenWithOffset$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getUsersByLastSeenWithOffsetAction),
      withLatestFrom(this.store.pipe(select(currentUserSelector))),
      switchMap(([{ request }, currentUser]) =>
        this.userService
          .listUsersByLastSeen(currentUser, request.filterData, request.offset)
          .pipe(
            map((payload: listUsersResponseInterface) =>
              getUsersByLastSeenWithOffsetSuccessAction({ payload })
            ),

            catchError((errorResponse: HttpErrorResponse) => {
              const error: ErrorInterface = {
                message: errorResponse.message,
              };
              return of(getUsersByLastSeenWithOffsetFailureAction({ error }));
            })
          )
      )
    )
  );

  // Get Users By Created At Effects
  getUsersByCreatedAt$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getUsersByCreatedAtAction),
      withLatestFrom(this.store.pipe(select(currentUserSelector))),
      switchMap(([{ request }, currentUser]) =>
        this.userService
          .listUsersByCreatedAt(currentUser, request.filterData)
          .pipe(
            map((payload: listUsersResponseInterface) =>
              getUsersByCreatedAtSuccessAction({ payload })
            ),

            catchError((errorResponse: HttpErrorResponse) => {
              const error: ErrorInterface = {
                message: errorResponse.message,
              };
              return of(getUsersByCreatedAtFailureAction({ error }));
            })
          )
      )
    )
  );

  getUsersByCreatedAtWithOffset$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getUsersByCreatedAtWithOffsetAction),
      withLatestFrom(this.store.pipe(select(currentUserSelector))),
      switchMap(([{ request }, currentUser]) =>
        this.userService
          .listUsersByCreatedAt(currentUser, request.filterData, request.offset)
          .pipe(
            map((payload: listUsersResponseInterface) =>
              getUsersByCreatedAtWithOffsetSuccessAction({ payload })
            ),

            catchError((errorResponse: HttpErrorResponse) => {
              const error: ErrorInterface = {
                message: errorResponse.message,
              };
              return of(getUsersByCreatedAtWithOffsetFailureAction({ error }));
            })
          )
      )
    )
  );

  constructor(
    private store: Store,
    private actions$: Actions,
    private userService: UserService
  ) {}
}
