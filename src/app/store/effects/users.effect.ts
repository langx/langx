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
  getUsersByLastSeenAction,
  getUsersByLastSeenFailureAction,
  getUsersByLastSeenSuccessAction,
  getUsersByLastSeenWithOffsetAction,
  getUsersByLastSeenWithOffsetFailureAction,
  getUsersByLastSeenWithOffsetSuccessAction,
} from 'src/app/store/actions/users.action';

@Injectable()
export class UsersEffects {
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

  constructor(
    private store: Store,
    private actions$: Actions,
    private userService: UserService
  ) {}
}
