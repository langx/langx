import { Injectable } from '@angular/core';
import { createEffect, ofType, Actions } from '@ngrx/effects';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, map, of, switchMap, tap } from 'rxjs';

import { RoomService } from 'src/app/services/chat/room.service';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { listRoomsResponseInterface } from 'src/app/models/types/responses/listRoomsResponse.interface';
import {
  getRoomsAction,
  getRoomsFailureAction,
  getRoomsSuccessAction,
  getRoomsWithOffsetAction,
  getRoomsWithOffsetFailureAction,
  getRoomsWithOffsetSuccessAction,
} from 'src/app/store/actions/rooms.action';

@Injectable()
export class RoomsEffects {
  getRooms$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getRoomsAction),
      switchMap(({ currentUserId }) =>
        this.roomService.listRooms(currentUserId).pipe(
          map((payload: listRoomsResponseInterface) =>
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
          map((payload: listRoomsResponseInterface) =>
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

  constructor(private actions$: Actions, private roomService: RoomService) {}
}
