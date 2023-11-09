import { Injectable } from '@angular/core';
import { createEffect, ofType, Actions } from '@ngrx/effects';
import { catchError, map, of, switchMap, tap, forkJoin } from 'rxjs';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import {
  completeRegistrationAction,
  completeRegistrationFailureAction,
  completeRegistrationSuccessAction,
  languageSelectionAction,
  languageSelectionFailureAction,
  languageSelectionSuccessAction,
  registerAction,
  registerFailureAction,
  registerSuccessAction,
} from '../actions/register.action';
import { AuthService } from 'src/app/services/auth/auth.service';
import { Account } from 'src/app/models/Account';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { UserService } from 'src/app/services/user/user.service';
import { User } from 'src/app/models/User';
import { LanguageService } from 'src/app/services/user/language.service';
import { Language } from 'src/app/models/Language';
import { AddLanguageRequestInterface } from 'src/app/models/types/requests/addLanguageRequest.interface';

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

  redirectAfterRegister$ = createEffect(
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
        return this.userService.createUserDoc(id, request).pipe(
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

  redirectAfterComplete$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(completeRegistrationSuccessAction),
        tap(() => {
          this.router.navigateByUrl('/login/signup/language');
        })
      ),
    { dispatch: false }
  );

  languageSelection$ = createEffect(() =>
    this.actions$.pipe(
      ofType(languageSelectionAction),

      switchMap(({ languages }) => {
        const observables = languages.map(
          (language: AddLanguageRequestInterface) => {
            return this.languageService.createLanguageDoc2(language);
          }
        );
        return forkJoin(observables).pipe(
          map((payload: Language[]) =>
            languageSelectionSuccessAction({ payload })
          ),

          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(languageSelectionFailureAction({ error }));
          })
        );
      })
    )
  );

  constructor(
    private actions$: Actions,
    private authService: AuthService,
    private userService: UserService,
    private languageService: LanguageService,
    private router: Router
  ) {}
}
