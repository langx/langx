import { Injectable } from '@angular/core';
import { createEffect, ofType, Actions } from '@ngrx/effects';
import { HttpErrorResponse } from '@angular/common/http';
import { Store, select } from '@ngrx/store';
import { catchError, map, of, switchMap, withLatestFrom } from 'rxjs';

import { listWalletResponseInterface } from 'src/app/models/types/responses/listWalletResponse.interface';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { WalletService } from 'src/app/services/user/wallet.service';

import { currentUserSelector } from 'src/app/store/selectors/auth.selector';
import {
  getWalletAction,
  getWalletSuccessAction,
  getWalletFailureAction,
} from 'src/app/store/actions/wallet.action';

@Injectable()
export class WalletEffects {
  getWallet$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getWalletAction),
      withLatestFrom(this.store.pipe(select(currentUserSelector))),
      switchMap(([_, currentUser]) => {
        return this.walletService.listWallet(currentUser).pipe(
          map((payload: listWalletResponseInterface) => {
            return getWalletSuccessAction({ payload: payload });
          }),

          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(getWalletFailureAction({ error }));
          })
        );
      })
    )
  );

  constructor(
    private actions$: Actions,
    private store: Store,
    private walletService: WalletService
  ) {}
}
