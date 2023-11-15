import { Injectable } from '@angular/core';
import { createEffect, ofType, Actions } from '@ngrx/effects';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, map, of, switchMap, tap } from 'rxjs';
import { Router } from '@angular/router';

import { RoomService } from 'src/app/services/chat/room.service';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { getRoomsResponseInterface } from 'src/app/models/types/responses/getRoomsResponse.interface';
import { RoomWithUserData } from 'src/app/models/Room';
import {
  createRoomAction,
  createRoomFailureAction,
  createRoomSuccessAction,
  getRoomByIdAction,
  getRoomByIdFailureAction,
  getRoomByIdSuccessAction,
  getRoomAction,
  getRoomFailureAction,
  getRoomSuccessAction,
  selectRoomAction,
} from 'src/app/store/actions/room.action';
import {
  getRoomsAction,
  getRoomsFailureAction,
  getRoomsSuccessAction,
  getRoomsWithOffsetAction,
  getRoomsWithOffsetFailureAction,
  getRoomsWithOffsetSuccessAction,
} from 'src/app/store/actions/rooms.action';

@Injectable()
export class RoomEffects {
  getRoomById$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getRoomByIdAction),
      switchMap(({ roomId }) =>
        this.roomService.getRoomById(roomId).pipe(
          map((payload: RoomWithUserData) =>
            getRoomByIdSuccessAction({ payload })
          ),

          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(getRoomByIdFailureAction({ error }));
          })
        )
      )
    )
  );

  getRoom$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getRoomAction),
      switchMap(({ currentUserId, userId }) =>
        this.roomService.getRoom(currentUserId, userId).pipe(
          map((data: getRoomsResponseInterface) => {
            if (data.total === 1) {
              const payload: RoomWithUserData = data.documents[0];
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

  createRoom$ = createEffect(() =>
    this.actions$.pipe(
      ofType(createRoomAction),
      switchMap(({ currentUserId, userId }) =>
        this.roomService.createRoom(currentUserId, userId).pipe(
          map((payload: RoomWithUserData) =>
            createRoomSuccessAction({ payload })
          ),

          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(createRoomFailureAction({ error }));
          })
        )
      )
    )
  );

  redirectAfterGetOrCreateRoom$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(createRoomSuccessAction, getRoomSuccessAction),
        tap(({ payload }) => {
          const roomId = payload.$id;
          this.router.navigate(['/', 'home', 'chat', roomId]);
        })
      ),
    { dispatch: false }
  );

  redirectAfterSelectRoom$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(selectRoomAction),
        tap(({ payload }) => {
          const roomId = payload.$id;
          this.router.navigate(['/', 'home', 'chat', roomId]);
        })
      ),
    { dispatch: false }
  );

  getRooms$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getRoomsAction),
      switchMap(({ currentUserId }) =>
        this.roomService.listRooms(currentUserId).pipe(
          map((payload: getRoomsResponseInterface) =>
            getRoomsSuccessAction({ payload })
          ),

          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(getRoomsFailureAction({ error }));
          })
        )
      )
    )
  );

  getRoomsWithOffset$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getRoomsWithOffsetAction),
      switchMap(({ currentUserId, offset }) =>
        this.roomService.listRooms(currentUserId, offset).pipe(
          map((payload: getRoomsResponseInterface) =>
            // TODO: #248 Before dispatch getRoomsWithOffsetSuccessAction,
            // It may checked first all cureent rooms array,
            // Then order all of them by last message timestamp
            getRoomsWithOffsetSuccessAction({ payload })
          ),

          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(getRoomsWithOffsetFailureAction({ error }));
          })
        )
      )
    )
  );

  constructor(
    private actions$: Actions,
    private router: Router,
    private roomService: RoomService
  ) {}
}
