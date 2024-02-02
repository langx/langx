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
  getUsersAction,
  getUsersFailureAction,
  getUsersSuccessAction,
  getUsersWithOffsetAction,
  getUsersWithOffsetFailureAction,
  getUsersWithOffsetSuccessAction,
} from 'src/app/store/actions/users.action';

@Injectable()
export class UsersEffects {
  getUsers$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getUsersAction),
      withLatestFrom(this.store.pipe(select(currentUserSelector))),
      switchMap(([{ request }, currentUser]) =>
        this.userService
          .listUsersByLastSeen(currentUser, request.filterData)
          .pipe(
            map((payload: listUsersResponseInterface) =>
              getUsersSuccessAction({ payload })
            ),

            catchError((errorResponse: HttpErrorResponse) => {
              const error: ErrorInterface = {
                message: errorResponse.message,
              };
              return of(getUsersFailureAction({ error }));
            })
          )
      )
    )
  );

  getUsersWithOffset$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getUsersWithOffsetAction),
      withLatestFrom(this.store.pipe(select(currentUserSelector))),
      switchMap(([{ request }, currentUser]) =>
        this.userService
          .listUsersByLastSeen(currentUser, request.filterData, request.offset)
          .pipe(
            map((payload: listUsersResponseInterface) =>
              getUsersWithOffsetSuccessAction({ payload })
            ),

            catchError((errorResponse: HttpErrorResponse) => {
              const error: ErrorInterface = {
                message: errorResponse.message,
              };
              return of(getUsersWithOffsetFailureAction({ error }));
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
