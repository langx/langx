import { Injectable } from '@angular/core';
import { createEffect, ofType, Actions } from '@ngrx/effects';
import { HttpErrorResponse } from '@angular/common/http';
import { Store, select } from '@ngrx/store';
import { catchError, map, of, switchMap, withLatestFrom } from 'rxjs';

import { UserService } from 'src/app/services/user/user.service';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { listUsersResponseInterface } from 'src/app/models/types/responses/listUsersResponse.interface';
import { currentUserSelector } from 'src/app/store/selectors/auth.selector';

import {
  getUsersByCompletedProfileAction,
  getUsersByCompletedProfileFailureAction,
  getUsersByCompletedProfileSuccessAction,
  getUsersByCompletedProfileWithOffsetAction,
  getUsersByCompletedProfileWithOffsetFailureAction,
  getUsersByCompletedProfileWithOffsetSuccessAction,
  getUsersByCreatedAtAction,
  getUsersByCreatedAtFailureAction,
  getUsersByCreatedAtSuccessAction,
  getUsersByCreatedAtWithOffsetAction,
  getUsersByCreatedAtWithOffsetFailureAction,
  getUsersByCreatedAtWithOffsetSuccessAction,
  getUsersByLastSeenAction,
  getUsersByLastSeenFailureAction,
  getUsersByLastSeenSuccessAction,
  getUsersByLastSeenWithOffsetAction,
  getUsersByLastSeenWithOffsetFailureAction,
  getUsersByLastSeenWithOffsetSuccessAction,
  getUsersByTargetLanguageAction,
  getUsersByTargetLanguageFailureAction,
  getUsersByTargetLanguageSuccessAction,
  getUsersByTargetLanguageWithOffsetAction,
  getUsersByTargetLanguageWithOffsetFailureAction,
  getUsersByTargetLanguageWithOffsetSuccessAction,
} from 'src/app/store/actions/users.action';

@Injectable()
export class UsersEffects {
  // Get Users By Target Language Effects
  getUsersByTargetLanguage$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getUsersByTargetLanguageAction),
      withLatestFrom(this.store.pipe(select(currentUserSelector))),
      switchMap(([{ request }, currentUser]) =>
        this.userService
          .listUsersByTargetLanguage(currentUser, request.filterData)
          .pipe(
            map((payload: listUsersResponseInterface) =>
              getUsersByTargetLanguageSuccessAction({ payload })
            ),

            catchError((errorResponse: HttpErrorResponse) => {
              const error: ErrorInterface = {
                message: errorResponse.message,
              };
              return of(getUsersByTargetLanguageFailureAction({ error }));
            })
          )
      )
    )
  );

  getUsersByTargetLanguageWithOffset$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getUsersByTargetLanguageWithOffsetAction),
      withLatestFrom(this.store.pipe(select(currentUserSelector))),
      switchMap(([{ request }, currentUser]) =>
        this.userService
          .listUsersByTargetLanguage(
            currentUser,
            request.filterData,
            request.offset
          )
          .pipe(
            map((payload: listUsersResponseInterface) =>
              getUsersByTargetLanguageWithOffsetSuccessAction({ payload })
            ),

            catchError((errorResponse: HttpErrorResponse) => {
              const error: ErrorInterface = {
                message: errorResponse.message,
              };
              return of(
                getUsersByTargetLanguageWithOffsetFailureAction({ error })
              );
            })
          )
      )
    )
  );

  // Get Users By Completed Profile Effects
  getUsersByCompletedProfile$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getUsersByCompletedProfileAction),
      withLatestFrom(this.store.pipe(select(currentUserSelector))),
      switchMap(([{ request }, currentUser]) =>
        this.userService
          .listUsersByCompletedProfile(currentUser, request.filterData)
          .pipe(
            map((payload: listUsersResponseInterface) =>
              getUsersByCompletedProfileSuccessAction({ payload })
            ),

            catchError((errorResponse: HttpErrorResponse) => {
              const error: ErrorInterface = {
                message: errorResponse.message,
              };
              return of(getUsersByCompletedProfileFailureAction({ error }));
            })
          )
      )
    )
  );

  getUsersByCompletedProfileWithOffset$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getUsersByCompletedProfileWithOffsetAction),
      withLatestFrom(this.store.pipe(select(currentUserSelector))),
      switchMap(([{ request }, currentUser]) =>
        this.userService
          .listUsersByCompletedProfile(
            currentUser,
            request.filterData,
            request.offset
          )
          .pipe(
            map((payload: listUsersResponseInterface) =>
              getUsersByCompletedProfileWithOffsetSuccessAction({ payload })
            ),

            catchError((errorResponse: HttpErrorResponse) => {
              const error: ErrorInterface = {
                message: errorResponse.message,
              };
              return of(
                getUsersByCompletedProfileWithOffsetFailureAction({ error })
              );
            })
          )
      )
    )
  );

  // Get Users By Last Seen Effects
  getUsersByLastSeen$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getUsersByLastSeenAction),
      withLatestFrom(this.store.pipe(select(currentUserSelector))),
      switchMap(([{ request }, currentUser]) =>
        this.userService
          .listUsersByLastSeen(currentUser, request.filterData)
          .pipe(
            map((payload: listUsersResponseInterface) =>
              getUsersByLastSeenSuccessAction({ payload })
            ),

            catchError((errorResponse: HttpErrorResponse) => {
              const error: ErrorInterface = {
                message: errorResponse.message,
              };
              return of(getUsersByLastSeenFailureAction({ error }));
            })
          )
      )
    )
  );

  getUsersByLastSeenWithOffset$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getUsersByLastSeenWithOffsetAction),
      withLatestFrom(this.store.pipe(select(currentUserSelector))),
      switchMap(([{ request }, currentUser]) =>
        this.userService
          .listUsersByLastSeen(currentUser, request.filterData, request.offset)
          .pipe(
            map((payload: listUsersResponseInterface) =>
              getUsersByLastSeenWithOffsetSuccessAction({ payload })
            ),

            catchError((errorResponse: HttpErrorResponse) => {
              const error: ErrorInterface = {
                message: errorResponse.message,
              };
              return of(getUsersByLastSeenWithOffsetFailureAction({ error }));
            })
          )
      )
    )
  );

  // Get Users By Created At Effects
  getUsersByCreatedAt$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getUsersByCreatedAtAction),
      withLatestFrom(this.store.pipe(select(currentUserSelector))),
      switchMap(([{ request }, currentUser]) =>
        this.userService
          .listUsersByCreatedAt(currentUser, request.filterData)
          .pipe(
            map((payload: listUsersResponseInterface) =>
              getUsersByCreatedAtSuccessAction({ payload })
            ),

            catchError((errorResponse: HttpErrorResponse) => {
              const error: ErrorInterface = {
                message: errorResponse.message,
              };
              return of(getUsersByCreatedAtFailureAction({ error }));
            })
          )
      )
    )
  );

  getUsersByCreatedAtWithOffset$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getUsersByCreatedAtWithOffsetAction),
      withLatestFrom(this.store.pipe(select(currentUserSelector))),
      switchMap(([{ request }, currentUser]) =>
        this.userService
          .listUsersByCreatedAt(currentUser, request.filterData, request.offset)
          .pipe(
            map((payload: listUsersResponseInterface) =>
              getUsersByCreatedAtWithOffsetSuccessAction({ payload })
            ),

            catchError((errorResponse: HttpErrorResponse) => {
              const error: ErrorInterface = {
                message: errorResponse.message,
              };
              return of(getUsersByCreatedAtWithOffsetFailureAction({ error }));
            })
          )
      )
    )
  );

  constructor(
    private store: Store,
    private actions$: Actions,
    private userService: UserService
  ) {}
}
