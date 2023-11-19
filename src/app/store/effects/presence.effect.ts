import { Injectable } from '@angular/core';
import { createEffect, ofType, Actions } from '@ngrx/effects';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, map, of, switchMap } from 'rxjs';

import { NotificationService } from 'src/app/services/notification/notification.service';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { User } from 'src/app/models/User';

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
      switchMap(({ currentUserId, request }) => {
        return this.notificationService
          .updatePresence(currentUserId, request)
          .pipe(
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
      })
    )
  );

  constructor(
    private actions$: Actions,
    private notificationService: NotificationService
  ) {}
}
