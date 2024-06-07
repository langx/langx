import { Injectable } from '@angular/core';
import { createEffect, ofType, Actions } from '@ngrx/effects';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, map, of, switchMap } from 'rxjs';

import { UserService } from 'src/app/services/user/user.service';
import { listStreaksResponseInterface } from 'src/app/models/types/responses/listStreaksResponse.interface';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import {
  getStreaksAction,
  getStreaksFailureAction,
  getStreaksSuccessAction,
  getStreaksWithOffsetAction,
  getStreaksWithOffsetFailureAction,
  getStreaksWithOffsetSuccessAction,
} from 'src/app/store/actions/streaks.action';

@Injectable()
export class StreaksEffects {
  getStreaks$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getStreaksAction),
      switchMap(() => {
        return this.userService.listStreaks().pipe(
          map((payload: listStreaksResponseInterface) => {
            return getStreaksSuccessAction({ payload });
          }),

          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(getStreaksFailureAction({ error }));
          })
        );
      })
    )
  );

  getStreakWithOffset$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getStreaksWithOffsetAction),
      switchMap(({ request }) => {
        return this.userService.listStreaks(request.offset).pipe(
          map((payload: listStreaksResponseInterface) => {
            return getStreaksWithOffsetSuccessAction({ payload });
          }),

          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(getStreaksWithOffsetFailureAction({ error }));
          })
        );
      })
    )
  );

  constructor(private actions$: Actions, private userService: UserService) {}
}
