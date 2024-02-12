import { Injectable } from '@angular/core';
import { createEffect, ofType, Actions } from '@ngrx/effects';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, map, of, switchMap } from 'rxjs';

import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { UserService } from 'src/app/services/user/user.service';
import {
  getContributorsAction,
  getContributorsFailureAction,
  getContributorsSuccessAction,
} from 'src/app/store/actions/contributors.action';

@Injectable()
export class ContributorsEffects {
  getVisits$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getContributorsAction),
      switchMap(() => {
        return this.userService.listContributors().pipe(
          map((payload: any) => {
            return getContributorsSuccessAction({ payload });
          }),

          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(getContributorsFailureAction({ error }));
          })
        );
      })
    )
  );

  constructor(private actions$: Actions, private userService: UserService) {}
}
