import { Injectable } from '@angular/core';
import { createEffect, ofType, Actions } from '@ngrx/effects';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, map, of, switchMap } from 'rxjs';

import { UserService } from 'src/app/services/user/user.service';
import { RoomService } from 'src/app/services/chat/room.service';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { getUsersResponseInterface } from 'src/app/models/types/responses/getUsersResponse.interface';
import { getRoomsResponseInterface } from 'src/app/models/types/responses/getRoomsResponse.interface';
import {
  createRoomAction,
  getRoomAction,
  getRoomFailureAction,
  getRoomSuccessAction,
  getUsersAction,
  getUsersFailureAction,
  getUsersSuccessAction,
  getUsersWithOffsetAction,
  getUsersWithOffsetFailureAction,
  getUsersWithOffsetSuccessAction,
} from 'src/app/store/actions/community.action';

@Injectable()
export class CommunityEffects {
  getUsers$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getUsersAction),
      switchMap(({ filterData }) =>
        this.userService.listUsers(filterData).pipe(
          map((payload: getUsersResponseInterface) =>
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
      switchMap(({ filterData, offset }) =>
        this.userService.listUsers(filterData, offset).pipe(
          map((payload: getUsersResponseInterface) =>
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

  getRoom$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getRoomAction),
      switchMap(({ currentUserId, userId }) =>
        this.roomService.getRoom2(currentUserId, userId).pipe(
          map((payload: getRoomsResponseInterface) => {
            if (payload.total === 1) {
              return getRoomSuccessAction({ payload });
            } else {
              return createRoomAction({ currentUserId, userId });
            }
          }),

          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(getRoomFailureAction({ error }));
          })
        )
      )
    )
  );

  constructor(
    private actions$: Actions,
    private userService: UserService,
    private roomService: RoomService
  ) {}
}
