import { Injectable } from '@angular/core';
import { createEffect, ofType, Actions } from '@ngrx/effects';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, map, of, switchMap, withLatestFrom } from 'rxjs';
import { Store } from '@ngrx/store';

import { RoomService } from 'src/app/services/chat/room.service';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';

import { roomsSelector } from '../selectors/room.selector';
import {
  findOrAddRoomAction,
  findOrAddRoomFailureAction,
  findOrAddRoomSuccessAction,
} from 'src/app/store/actions/notification.action';

@Injectable()
export class NotificationEffects {
  findOrAddRoom$ = createEffect(() =>
    this.actions$.pipe(
      ofType(findOrAddRoomAction),
      withLatestFrom(this.store.select(roomsSelector)),
      switchMap(([{ payload, currentUserId }, rooms]) => {
        if (rooms) {
          const existingRoom = rooms.find((room) => room.$id === payload.$id);
          if (existingRoom) {
            return of(findOrAddRoomSuccessAction({ payload: existingRoom }));
          }
        }
        return this.roomService.extendRoom(payload, currentUserId).pipe(
          map((payload) => {
            return findOrAddRoomSuccessAction({ payload });
          }),
          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(findOrAddRoomFailureAction({ error }));
          })
        );
      })
    )
  );

  constructor(
    private store: Store,
    private actions$: Actions,
    private roomService: RoomService
  ) {}
}
