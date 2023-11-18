import { Injectable } from '@angular/core';
import { createEffect, ofType, Actions } from '@ngrx/effects';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, map, of, switchMap } from 'rxjs';

import { LanguageService } from 'src/app/services/user/language.service';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { Language } from 'src/app/models/Language';

import {
  createLanguageAction,
  createLanguageFailureAction,
  createLanguageSuccessAction,
  updateLanguageAction,
  updateLanguageFailureAction,
  updateLanguageSuccessAction,
} from 'src/app/store/actions/language.action';

@Injectable()
export class LanguageEffects {
  createLanguage$ = createEffect(() =>
    this.actions$.pipe(
      ofType(createLanguageAction),
      switchMap(({ request }) => {
        return this.languageService
          .createLanguageDocWithUpdatingLanguageArray(request)
          .pipe(
            map((payload: Language) =>
              createLanguageSuccessAction({ payload })
            ),

            catchError((errorResponse: HttpErrorResponse) => {
              const error: ErrorInterface = {
                message: errorResponse.message,
              };
              return of(createLanguageFailureAction({ error }));
            })
          );
      })
    )
  );

  updateLanguage$ = createEffect(() =>
    this.actions$.pipe(
      ofType(updateLanguageAction),
      switchMap(({ request }) => {
        return this.languageService
          .updateLanguageDoc(request.id, request.data)
          .pipe(
            map((payload: Language) =>
              updateLanguageSuccessAction({ payload })
            ),

            catchError((errorResponse: HttpErrorResponse) => {
              const error: ErrorInterface = {
                message: errorResponse.message,
              };
              return of(updateLanguageFailureAction({ error }));
            })
          );
      })
    )
  );

  constructor(
    private actions$: Actions,
    private languageService: LanguageService
  ) {}
}
