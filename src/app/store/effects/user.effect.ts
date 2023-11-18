import { Injectable } from '@angular/core';
import { createEffect, ofType, Actions } from '@ngrx/effects';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, map, of, switchMap } from 'rxjs';

import { UserService } from 'src/app/services/user/user.service';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { User } from 'src/app/models/User';

import {
  getUserAction,
  getUserFailureAction,
  getUserSuccessAction,
  updateUserAction,
  updateUserFailureAction,
  updateUserSuccessAction,
} from 'src/app/store/actions/user.action';

@Injectable()
export class UserEffects {
  getUser$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getUserAction),
      switchMap(({ userId }) => {
        return this.userService.getUserDoc(userId).pipe(
          map((payload: User) => getUserSuccessAction({ payload })),

          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(getUserFailureAction({ error }));
          })
        );
      })
    )
  );

  updateUser$ = createEffect(() =>
    this.actions$.pipe(
      ofType(updateUserAction),
      switchMap(({ request }) => {
        return this.userService
          .updateUserDoc2(request.userId, request.data)
          .pipe(
            map((payload: User) => updateUserSuccessAction({ payload })),

            catchError((errorResponse: HttpErrorResponse) => {
              const error: ErrorInterface = {
                message: errorResponse.message,
              };
              return of(updateUserFailureAction({ error }));
            })
          );
      })
    )
  );

  constructor(private actions$: Actions, private userService: UserService) {}
}
