import { Injectable } from '@angular/core';
import { createEffect, ofType, Actions } from '@ngrx/effects';
import { HttpErrorResponse } from '@angular/common/http';
import { Store, select } from '@ngrx/store';
import { catchError, map, of, switchMap, withLatestFrom } from 'rxjs';

import { NotificationService } from 'src/app/services/notification/notification.service';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { User } from 'src/app/models/User';
import { currentUserSelector } from 'src/app/store/selectors/auth.selector';

import {
  updatePresenceAction,
  updatePresenceFailureAction,
  updatePresenceSuccessAction,
} from 'src/app/store/actions/presence.action';

@Injectable()
export class PresenceEffects {
  updatePresence$ = createEffect(() =>
    this.actions$.pipe(
      ofType(updatePresenceAction),
      withLatestFrom(this.store.pipe(select(currentUserSelector))),
      switchMap(([{ request }, currentUser]) => {
        if (currentUser?.privacy.includes('onlineStatus')) {
          // If 'onlineStatus' is in the privacy settings, don't update presence
          return of(updatePresenceSuccessAction({ payload: currentUser }));
        } else {
          // Otherwise, update presence
          return this.notificationService.updatePresence(request).pipe(
            map((payload: User) => {
              return updatePresenceSuccessAction({ payload });
            }),
            catchError((errorResponse: HttpErrorResponse) => {
              const error: ErrorInterface = {
                message: errorResponse.message,
              };
              return of(updatePresenceFailureAction({ error }));
            })
          );
        }
      })
    )
  );

  constructor(
    private store: Store,
    private actions$: Actions,
    private notificationService: NotificationService
  ) {}
}
