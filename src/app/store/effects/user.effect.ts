import { Injectable } from '@angular/core';
import { createEffect, ofType, Actions } from '@ngrx/effects';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, map, of, switchMap } from 'rxjs';

import { UserService } from 'src/app/services/user/user.service';
import { LanguageService } from 'src/app/services/user/language.service';
import { NotificationService } from 'src/app/services/notification/notification.service';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { listUsersResponseInterface } from 'src/app/models/types/responses/listUsersResponse.interface';
import { User } from 'src/app/models/User';
import { Language } from 'src/app/models/Language';

import {
  getUsersAction,
  getUsersFailureAction,
  getUsersSuccessAction,
  getUsersWithOffsetAction,
  getUsersWithOffsetFailureAction,
  getUsersWithOffsetSuccessAction,
} from 'src/app/store/actions/users.action';
import {
  updatePresenceAction,
  updatePresenceFailureAction,
  updatePresenceSuccessAction,
} from '../actions/presence.action';
import {
  getUserAction,
  getUserFailureAction,
  getUserSuccessAction,
  updateUserAction,
  updateUserFailureAction,
  updateUserSuccessAction,
} from 'src/app/store/actions/user.action';
import {
  updateLanguageAction,
  updateLanguageFailureAction,
  updateLanguageSuccessAction,
} from 'src/app/store/actions/language.action';

@Injectable()
export class UserEffects {
  getUsers$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getUsersAction),
      switchMap(({ currentUserId, filterData }) =>
        this.userService.listUsers(currentUserId, filterData).pipe(
          map((payload: listUsersResponseInterface) =>
            getUsersSuccessAction({ payload })
          ),

          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(getUsersFailureAction({ error }));
          })
        )
      )
    )
  );

  getUsersWithOffset$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getUsersWithOffsetAction),
      switchMap(({ currentUserId, filterData, offset }) =>
        this.userService.listUsers(currentUserId, filterData, offset).pipe(
          map((payload: listUsersResponseInterface) =>
            getUsersWithOffsetSuccessAction({ payload })
          ),

          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(getUsersWithOffsetFailureAction({ error }));
          })
        )
      )
    )
  );

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

  getUser$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getUserAction),
      switchMap(({ userId }) => {
        return this.userService.getUserDoc2(userId).pipe(
          map((payload: User) => getUserSuccessAction({ payload })),

          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(getUserFailureAction({ error }));
          })
        );
      })
    )
  );

  updateUser$ = createEffect(() =>
    this.actions$.pipe(
      ofType(updateUserAction),
      switchMap(({ request }) => {
        return this.userService
          .updateUserDoc2(request.userId, request.data)
          .pipe(
            map((payload: User) => updateUserSuccessAction({ payload })),

            catchError((errorResponse: HttpErrorResponse) => {
              const error: ErrorInterface = {
                message: errorResponse.message,
              };
              return of(updateUserFailureAction({ error }));
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
    private userService: UserService,
    private languageService: LanguageService,
    private notificationService: NotificationService
  ) {}
}
