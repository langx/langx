import { Injectable } from '@angular/core';
import { createEffect, ofType, Actions } from '@ngrx/effects';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, from, map, of, switchMap } from 'rxjs';

import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { ApiService } from 'src/app/services/api/api.service';
import {
  listCountriesAction,
  listCountriesFailureAction,
  listCountriesSuccessAction,
  listLanguagesAction,
  listLanguagesFailureAction,
  listLanguagesSuccessAction,
} from 'src/app/store/actions/locale.action';

@Injectable()
export class LocaleEffects {
  listCountries$ = createEffect(() =>
    this.actions$.pipe(
      ofType(listCountriesAction),
      switchMap(() => {
        return from(this.api.listCountries()).pipe(
          map((payload: any[]) => {
            return listCountriesSuccessAction({ payload });
          }),

          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(listCountriesFailureAction({ error }));
          })
        );
      })
    )
  );

  listLanguages$ = createEffect(() =>
    this.actions$.pipe(
      ofType(listLanguagesAction),
      switchMap(() => {
        return from(this.api.listLanguages()).pipe(
          map((payload: any[]) => {
            return listLanguagesSuccessAction({ payload });
          }),

          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(listLanguagesFailureAction({ error }));
          })
        );
      })
    )
  );

  constructor(private actions$: Actions, private api: ApiService) {}
}
