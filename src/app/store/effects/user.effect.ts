import { Injectable } from '@angular/core';
import { createEffect, ofType, Actions } from '@ngrx/effects';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Store, select } from '@ngrx/store';
import {
  catchError,
  forkJoin,
  map,
  of,
  switchMap,
  tap,
  withLatestFrom,
} from 'rxjs';

import { UserService } from 'src/app/services/user/user.service';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { User } from 'src/app/models/User';
import { Report } from 'src/app/models/Report';
import { currentUserSelector } from 'src/app/store/selectors/auth.selector';

import {
  getCurrentUserAction,
  getCurrentUserFailureAction,
  getCurrentUserSuccessAction,
  getUserByIdAction,
  getUserByIdFailureAction,
  getUserByIdSuccessAction,
  reportUserAction,
  reportUserFailureAction,
  reportUserSuccessAction,
  updateCurrentUserAction,
  updateCurrentUserFailureAction,
  updateCurrentUserSuccessAction,
  blockUserAction,
  blockUserFailureAction,
  blockUserSuccessAction,
  getBlockedUsersAction,
  getBlockedUsersFailureAction,
  getBlockedUsersSuccessAction,
  unBlockUserAction,
  unBlockUserFailureAction,
  unBlockUserSuccessAction,
} from 'src/app/store/actions/user.action';

@Injectable()
export class UserEffects {
  getUser$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getCurrentUserAction),
      switchMap(({ userId }) => {
        return this.userService.getUserDoc(userId).pipe(
          map((payload: User) => getCurrentUserSuccessAction({ payload })),

          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(getCurrentUserFailureAction({ error }));
          })
        );
      })
    )
  );

  updateUser$ = createEffect(() =>
    this.actions$.pipe(
      ofType(updateCurrentUserAction),
      switchMap(({ request }) => {
        return this.userService
          .updateUserDoc(request.userId, request.data)
          .pipe(
            map((payload: User) => updateCurrentUserSuccessAction({ payload })),

            catchError((errorResponse: HttpErrorResponse) => {
              const error: ErrorInterface = {
                message: errorResponse.message,
              };
              return of(updateCurrentUserFailureAction({ error }));
            })
          );
      })
    )
  );

  getUserById$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getUserByIdAction),
      withLatestFrom(this.store.pipe(select(currentUserSelector))),
      switchMap(([{ userId }, currentUser]) => {
        const user$ = this.userService.getUserDoc(userId);
        let visitor$;

        if (currentUser?.privacy.includes('profileVisits')) {
          visitor$ = of(null); // If 'profileVisits' is in the privacy settings, don't create a visit document
        } else {
          visitor$ = this.userService.createVisitDoc(currentUser.$id, userId); // Otherwise, create a visit document
        }

        return forkJoin({ user: user$, visitor: visitor$ }).pipe(
          map(({ user, visitor }) =>
            getUserByIdSuccessAction({ payload: user })
          ),
          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(getUserByIdFailureAction({ error }));
          })
        );
      })
    )
  );

  redirectAfterGetUserByIdFailed$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(getUserByIdFailureAction),
        tap(() => {
          this.router.navigateByUrl('/home/messages', { replaceUrl: true });
        })
      ),
    { dispatch: false }
  );

  reportUser$ = createEffect(() =>
    this.actions$.pipe(
      ofType(reportUserAction),
      withLatestFrom(this.store.pipe(select(currentUserSelector))),
      switchMap(([{ request }, currentUser]) => {
        return this.userService
          .reportUser(currentUser.$id, request.userId, request.reason)
          .pipe(
            map((payload: Report) => reportUserSuccessAction({ payload })),

            catchError((errorResponse: HttpErrorResponse) => {
              const error: ErrorInterface = {
                message: errorResponse.message,
              };
              return of(reportUserFailureAction({ error }));
            })
          );
      })
    )
  );

  blockUser$ = createEffect(() =>
    this.actions$.pipe(
      ofType(blockUserAction),
      withLatestFrom(this.store.pipe(select(currentUserSelector))),
      switchMap(([{ request }, currentUser]) => {
        return this.userService.blockUser(currentUser, request.userId).pipe(
          map((payload: User) => blockUserSuccessAction({ payload })),

          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(blockUserFailureAction({ error }));
          })
        );
      })
    )
  );

  unBlockUser$ = createEffect(() =>
    this.actions$.pipe(
      ofType(unBlockUserAction),
      withLatestFrom(this.store.pipe(select(currentUserSelector))),
      switchMap(([{ request }, currentUser]) => {
        return this.userService.unBlockUser(currentUser, request.userId).pipe(
          map((payload: User) => unBlockUserSuccessAction({ payload })),

          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(unBlockUserFailureAction({ error }));
          })
        );
      })
    )
  );

  getBlockedUsers$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getBlockedUsersAction),
      switchMap(({ request }) => {
        return this.userService.getBlockedUsers(request.blockedUsers).pipe(
          map((payload: User[]) => {
            return getBlockedUsersSuccessAction({ payload });
          }),

          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(getBlockedUsersFailureAction({ error }));
          })
        );
      })
    )
  );

  constructor(
    private store: Store,
    private actions$: Actions,
    private router: Router,
    private userService: UserService
  ) {}
}
