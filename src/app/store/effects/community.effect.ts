import { Injectable } from '@angular/core';
import { createEffect, ofType, Actions } from '@ngrx/effects';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, map, of, switchMap, tap } from 'rxjs';

import { UserService } from 'src/app/services/user/user.service';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { getUsersResponseInterface } from 'src/app/models/types/responses/getUsersResponse.interface';
import {
  getUsersAction,
  getUsersFailureAction,
  getUsersSuccessAction,
  getUsersWithOffsetAction,
  getUsersWithOffsetFailureAction,
  getUsersWithOffsetSuccessAction,
} from 'src/app/store/actions/community.action';

@Injectable()
export class CommunityEffects {
  getUsers$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getUsersAction),
      switchMap(({ filterData }) =>
        this.userService.listUsers(filterData).pipe(
          map((payload: getUsersResponseInterface) =>
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
      switchMap(({ filterData, offset }) =>
        this.userService.listUsers(filterData, offset).pipe(
          map((payload: getUsersResponseInterface) =>
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

  constructor(private actions$: Actions, private userService: UserService) {}
}
