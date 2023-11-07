import { Injectable } from '@angular/core';
import { createEffect, ofType, Actions } from '@ngrx/effects';
import { catchError, map, of, switchMap } from 'rxjs';

import {
  registerAction,
  registerFailureAction,
  registerSuccessAction,
} from '../actions/register.action';
import { AuthService } from 'src/app/services/auth/auth.service';
import { Account } from 'src/app/models/Account';

@Injectable()
export class RegisterEffect {
  register$ = createEffect(() =>
    this.actions$.pipe(
      ofType(registerAction),
      map((action) => {
        console.log(action);
        return action;
      }),
      switchMap(({ request }) =>
        this.authService.register2(request).pipe(
          map((payload: Account) => registerSuccessAction({ payload })),

          catchError(() => {
            return of(registerFailureAction());
          })
        )
      )
    )
  );

  constructor(private actions$: Actions, private authService: AuthService) {}
}
