import { Injectable } from '@angular/core';
import { Store, select } from '@ngrx/store';
import { createEffect, ofType, Actions } from '@ngrx/effects';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, map, of, switchMap, withLatestFrom } from 'rxjs';

import { TokenService } from 'src/app/services/user/token.service';
import { listCheckoutsResponseInterface } from 'src/app/models/types/responses/listCheckoutsResponse.interface';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';

import { currentUserSelector } from 'src/app/store/selectors/auth.selector';
import {
  getCheckoutsAction,
  getCheckoutsSuccessAction,
  getCheckoutsFailureAction,
  getCheckoutsWithOffsetAction,
  getCheckoutsWithOffsetSuccessAction,
  getCheckoutsWithOffsetFailureAction,
} from 'src/app/store/actions/checkouts.action';

@Injectable()
export class StreaksEffects {
  getStreaks$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getCheckoutsAction),
      withLatestFrom(this.store.pipe(select(currentUserSelector))),
      switchMap(([_, currentUser]) => {
        return this.tokenService.listCheckouts(currentUser).pipe(
          map((payload: listCheckoutsResponseInterface) => {
            return getCheckoutsSuccessAction({ payload });
          }),

          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(getCheckoutsFailureAction({ error }));
          })
        );
      })
    )
  );

  getStreakWithOffset$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getCheckoutsWithOffsetAction),
      withLatestFrom(this.store.pipe(select(currentUserSelector))),
      switchMap(([{ request }, currentUser]) => {
        return this.tokenService
          .listCheckouts(currentUser, request.offset)
          .pipe(
            map((payload: listCheckoutsResponseInterface) => {
              return getCheckoutsWithOffsetSuccessAction({ payload });
            }),

            catchError((errorResponse: HttpErrorResponse) => {
              const error: ErrorInterface = {
                message: errorResponse.message,
              };
              return of(getCheckoutsWithOffsetFailureAction({ error }));
            })
          );
      })
    )
  );

  constructor(
    private actions$: Actions,
    private store: Store,
    private tokenService: TokenService
  ) {}
}
