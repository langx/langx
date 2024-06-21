import { Injectable } from '@angular/core';
import { createEffect, ofType, Actions } from '@ngrx/effects';
import { HttpErrorResponse } from '@angular/common/http';
import { Store, select } from '@ngrx/store';
import { catchError, map, of, switchMap, withLatestFrom } from 'rxjs';

import { RoomService } from 'src/app/services/chat/room.service';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { listRoomsResponseInterface } from 'src/app/models/types/responses/listRoomsResponse.interface';
import { currentUserSelector } from 'src/app/store/selectors/auth.selector';
import {
  getArchivedRoomsAction,
  getArchivedRoomsFailureAction,
  getArchivedRoomsSuccessAction,
  getArchivedRoomsWithOffsetAction,
  getArchivedRoomsWithOffsetFailureAction,
  getArchivedRoomsWithOffsetSuccessAction,
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
      withLatestFrom(this.store.pipe(select(currentUserSelector))),
      switchMap(([_, currentUser]) =>
        this.roomService.listRooms(currentUser).pipe(
          map((payload: listRoomsResponseInterface) => {
            return getRoomsSuccessAction({ payload });
          }),

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
      withLatestFrom(this.store.pipe(select(currentUserSelector))),
      switchMap(([{ request }, currentUser]) =>
        this.roomService
          .listRooms(currentUser, { offset: request.offset })
          .pipe(
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

  getArchivedRooms$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getArchivedRoomsAction),
      withLatestFrom(this.store.pipe(select(currentUserSelector))),
      switchMap(([_, currentUser]) =>
        this.roomService.listRooms(currentUser, { archived: true }).pipe(
          map((payload: listRoomsResponseInterface) => {
            return getArchivedRoomsSuccessAction({ payload });
          }),

          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(getArchivedRoomsFailureAction({ error }));
          })
        )
      )
    )
  );

  getArchivedRoomsWithOffset$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getArchivedRoomsWithOffsetAction),
      withLatestFrom(this.store.pipe(select(currentUserSelector))),
      switchMap(([{ request }, currentUser]) =>
        this.roomService
          .listRooms(currentUser, { archived: true, offset: request.offset })
          .pipe(
            map((payload: listRoomsResponseInterface) => {
              return getArchivedRoomsWithOffsetSuccessAction({ payload });
            }),

            catchError((errorResponse: HttpErrorResponse) => {
              const error: ErrorInterface = {
                message: errorResponse.message,
              };
              return of(getArchivedRoomsWithOffsetFailureAction({ error }));
            })
          )
      )
    )
  );

  constructor(
    private store: Store,
    private actions$: Actions,
    private roomService: RoomService
  ) {}
}
