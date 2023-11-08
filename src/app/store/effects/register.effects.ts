import { Injectable } from '@angular/core';
import { createEffect, ofType, Actions } from '@ngrx/effects';
import { catchError, map, of, switchMap, tap } from 'rxjs';

import {
  completeRegistrationAction,
  completeRegistrationFailureAction,
  completeRegistrationSuccessAction,
  registerAction,
  registerFailureAction,
  registerSuccessAction,
} from '../actions/register.action';
import { AuthService } from 'src/app/services/auth/auth.service';
import { Account } from 'src/app/models/Account';
import { HttpErrorResponse } from '@angular/common/http';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { Router } from '@angular/router';
import { UserService } from 'src/app/services/user/user.service';
import { User } from 'src/app/models/User';

@Injectable()
export class RegisterEffect {
  register$ = createEffect(() =>
    this.actions$.pipe(
      ofType(registerAction),
      switchMap(({ request }) =>
        this.authService.register(request).pipe(
          map((payload: Account) => registerSuccessAction({ payload })),

          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(registerFailureAction({ error }));
          })
        )
      )
    )
  );

  redirectAfterSubmit$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(registerSuccessAction),
        tap(() => {
          this.router.navigateByUrl('/login/signup/complete');
        })
      ),
    { dispatch: false }
  );

  completeRegistration$ = createEffect(() =>
    this.actions$.pipe(
      ofType(completeRegistrationAction),
      switchMap(({ request, id }) => {
        return this.userService.createUserDoc2(id, request).pipe(
          map((payload: User) =>
            completeRegistrationSuccessAction({ payload })
          ),

          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(completeRegistrationFailureAction({ error }));
          })
        );
      })
    )
  );

  constructor(
    private actions$: Actions,
    private authService: AuthService,
    private userService: UserService,
    private router: Router
  ) {}
}
