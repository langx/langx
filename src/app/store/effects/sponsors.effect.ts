import { Injectable } from '@angular/core';
import { createEffect, ofType, Actions } from '@ngrx/effects';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, map, of, switchMap } from 'rxjs';

import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { UserService } from 'src/app/services/user/user.service';
import {
  getSponsorsAction,
  getSponsorsSuccessAction,
  getSponsorsFailureAction,
} from 'src/app/store/actions/sponsors.action';

@Injectable()
export class SponsorsEffects {
  getSponsors$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getSponsorsAction),
      switchMap(() => {
        return this.userService.listSponsors().pipe(
          map((payload: any) => {
            return getSponsorsSuccessAction({ payload });
          }),

          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(getSponsorsFailureAction({ error }));
          })
        );
      })
    )
  );

  constructor(private actions$: Actions, private userService: UserService) {}
}
