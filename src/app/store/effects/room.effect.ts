import { Injectable } from '@angular/core';
import { createEffect, ofType, Actions } from '@ngrx/effects';
import { HttpErrorResponse } from '@angular/common/http';
import { Store, select } from '@ngrx/store';
import { Router } from '@angular/router';
import { catchError, map, of, switchMap, tap, withLatestFrom } from 'rxjs';
import { AxiosError } from 'axios';

import { User } from 'src/app/models/User';
import { Room } from 'src/app/models/Room';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { listRoomsResponseInterface } from 'src/app/models/types/responses/listRoomsResponse.interface';
import { updateRoomRequestInterface } from 'src/app/models/types/requests/updateRoomRequest.interface';
import { RoomExtendedInterface } from 'src/app/models/types/roomExtended.interface';
import { RoomService } from 'src/app/services/chat/room.service';
import { currentUserSelector } from 'src/app/store/selectors/auth.selector';
import { activateRoomAction } from 'src/app/store/actions/message.action';
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
  updateRoomAction,
  updateRoomSuccessAction,
  updateRoomFailureAction,
  archiveRoomAction,
  archiveRoomSuccessAction,
  archiveRoomFailureAction,
  unArchiveRoomAction,
  unArchiveRoomSuccessAction,
  unArchiveRoomFailureAction,
} from 'src/app/store/actions/room.action';

@Injectable()
export class RoomEffects {
  getRoomById$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getRoomByIdAction),
      switchMap(({ currentUserId, roomId }) =>
        this.roomService.getRoomById(currentUserId, roomId).pipe(
          map((data: listRoomsResponseInterface) => {
            if (data.total === 1) {
              const payload: RoomExtendedInterface = data.documents[0];
              return getRoomByIdSuccessAction({ payload });
            } else {
              const error: ErrorInterface = {
                message: 'Room with requested ID could not find',
              };
              return getRoomByIdFailureAction({ error });
            }
          }),

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

  redirectAfterGetRoomByIdFailure$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(getRoomByIdFailureAction),
        tap(() => {
          this.router.navigate(['/', 'home', 'messages']);
        })
      ),
    { dispatch: false }
  );

  getRoom$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getRoomAction),
      switchMap(({ currentUserId, userId }) =>
        this.roomService.getRoom(currentUserId, userId).pipe(
          map((data: listRoomsResponseInterface) => {
            if (data.total === 0) {
              return createRoomAction({ currentUserId, userId });
            } else if (data.total === 1) {
              const payload: RoomExtendedInterface = data.documents[0];
              return getRoomSuccessAction({ payload });
            } else {
              const error: ErrorInterface = {
                message: 'Room was not found and not created',
              };
              return getRoomFailureAction({ error });
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
          map((data: listRoomsResponseInterface) => {
            if (data.total === 1) {
              const payload: RoomExtendedInterface = data.documents[0];
              return createRoomSuccessAction({ payload });
            } else {
              const error: ErrorInterface = {
                message: 'Room was not created',
              };
              return createRoomFailureAction({ error });
            }
          }),

          catchError((errorResponse: AxiosError) => {
            console.log(errorResponse?.response?.data);
            const error: ErrorInterface = {
              message: errorResponse?.response?.data['message'],
            };
            return of(createRoomFailureAction({ error }));
          })
        )
      )
    )
  );

  updateRoom$ = createEffect(() =>
    this.actions$.pipe(
      ofType(updateRoomAction),
      switchMap(({ request }) =>
        this.roomService.updateRoom(request).pipe(
          map((payload: Room) => {
            return updateRoomSuccessAction({ payload });
          }),
          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(updateRoomFailureAction({ error }));
          })
        )
      )
    )
  );

  activateRoomAfterGetOrCreateRoom$ = createEffect(() =>
    this.actions$.pipe(
      ofType(
        getRoomSuccessAction,
        createRoomSuccessAction,
        getRoomByIdSuccessAction
      ),
      map((action) => activateRoomAction({ payload: action.payload }))
    )
  );

  redirectAfterActivateRoom$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(activateRoomAction),
        tap(({ payload }) => {
          const roomId = payload.$id;
          this.router.navigate(['/', 'home', 'chat', roomId]);
        })
      ),
    { dispatch: false }
  );

  archiveRoom$ = createEffect(() =>
    this.actions$.pipe(
      ofType(archiveRoomAction),
      withLatestFrom(this.store.pipe(select(currentUserSelector))),
      switchMap(([{ request }, currentUser]) =>
        this.roomService.archiveRoom(currentUser, request.room).pipe(
          switchMap((payload: User) => {
            const updateRequest: updateRoomRequestInterface = {
              roomId: request.room.$id,
              data: { archived: true },
            };
            return of(
              updateRoomAction({ request: updateRequest }),
              archiveRoomSuccessAction({ payload })
            );
          }),
          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(archiveRoomFailureAction({ error }));
          })
        )
      )
    )
  );

  unArchivedRoom$ = createEffect(() =>
    this.actions$.pipe(
      ofType(unArchiveRoomAction),
      withLatestFrom(this.store.pipe(select(currentUserSelector))),
      switchMap(([{ request }, currentUser]) =>
        this.roomService.unArchiveRoom(currentUser, request.room).pipe(
          switchMap((payload: User) => {
            const updateRequest: updateRoomRequestInterface = {
              roomId: request.room.$id,
              data: { archived: false },
            };
            return of(
              unArchiveRoomSuccessAction({ payload }),
              updateRoomAction({ request: updateRequest })
            );
          }),
          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(unArchiveRoomFailureAction({ error }));
          })
        )
      )
    )
  );

  constructor(
    private actions$: Actions,
    private store: Store,
    private router: Router,
    private roomService: RoomService
  ) {}
}
