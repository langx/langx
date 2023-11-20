import { Injectable } from '@angular/core';
import { createEffect, ofType, Actions } from '@ngrx/effects';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, map, of, switchMap, withLatestFrom } from 'rxjs';
import { Store, select } from '@ngrx/store';

// Interface Imports
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';

// Service Imports
import { RoomService } from 'src/app/services/chat/room.service';

// Selector Imports
import { currentUserSelector } from 'src/app/store/selectors/auth.selector';
import { roomsSelector } from 'src/app/store/selectors/room.selector';

// Action Imports
import {
  findOrAddRoomAction,
  findOrAddRoomFailureAction,
  findOrAddRoomSuccessAction,
  totalUnseenMessagesAction,
  totalUnseenMessagesSuccessAction,
} from 'src/app/store/actions/notification.action';
import {
  getRoomsSuccessAction,
  getRoomsWithOffsetSuccessAction,
} from 'src/app/store/actions/rooms.action';

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

  totalUnseenMessages$ = createEffect(() =>
    this.actions$.pipe(
      ofType(
        totalUnseenMessagesAction,
        getRoomsSuccessAction,
        getRoomsWithOffsetSuccessAction
      ),
      withLatestFrom(
        this.store.pipe(select(currentUserSelector)),
        this.store.pipe(select(roomsSelector))
      ),
      map(([action, currentUser, rooms]) => {
        // Calculate the total number of unseen messages
        const totalUnseenMessages = rooms
          ? rooms.reduce((count, room) => {
              const unseenMessagesInRoom = room.messages.reduce(
                (count, message) =>
                  count +
                  (message['seen'] || message.to !== currentUser.$id ? 0 : 1),
                0
              );
              return count + unseenMessagesInRoom;
            }, 0)
          : currentUser.totalUnseen;

        return totalUnseenMessagesSuccessAction({
          payload: totalUnseenMessages,
        });
      })
    )
  );

  constructor(
    private store: Store,
    private actions$: Actions,
    private roomService: RoomService
  ) {}
}
