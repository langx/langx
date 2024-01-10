import { Injectable } from '@angular/core';
import { createEffect, ofType, Actions } from '@ngrx/effects';
import { Store, select } from '@ngrx/store';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, map, of, switchMap, withLatestFrom } from 'rxjs';

import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { UserService } from 'src/app/services/user/user.service';
import { currentUserSelector } from 'src/app/store/selectors/auth.selector';
import {
  getVisitsAction,
  getVisitsFailureAction,
  getVisitsSuccessAction,
} from 'src/app/store/actions/visits.action';

@Injectable()
export class VisitsEffects {
  getVisits$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getVisitsAction),
      withLatestFrom(this.store.pipe(select(currentUserSelector))),
      switchMap(([_, currentUser]) => {
        return this.userService.listVisits(currentUser.$id).pipe(
          map((payload: any) => {
            console.log('payload', payload);
            return getVisitsSuccessAction({ payload });
          }),

          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(getVisitsFailureAction({ error }));
          })
        );
      })
    )
  );

  constructor(
    private actions$: Actions,
    private store: Store,
    private userService: UserService
  ) {}
}
