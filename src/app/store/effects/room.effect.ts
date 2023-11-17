import { Injectable } from '@angular/core';
import { createEffect, ofType, Actions } from '@ngrx/effects';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  catchError,
  from,
  map,
  mergeMap,
  of,
  switchMap,
  tap,
  toArray,
} from 'rxjs';

import { RoomService } from 'src/app/services/chat/room.service';
import { UserService } from 'src/app/services/user/user.service';
import { MessageService } from 'src/app/services/chat/message.service';

import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { listRoomsResponseInterface } from 'src/app/models/types/responses/listRoomsResponse.interface';
import { RoomExtendedInterface } from 'src/app/models/types/roomExtended.interface';
import {
  getRoomsAction,
  getRoomsFailureAction,
  getRoomsSuccessAction,
  getRoomsWithOffsetAction,
  getRoomsWithOffsetFailureAction,
  getRoomsWithOffsetSuccessAction,
  // fillRoomsWithUserDataSuccessAction,
  // fillRoomsWithUserDataFailureAction,
  // fillRoomsWithMessagesSuccessAction,
  // fillRoomsWithMessagesFailureAction,
  // fillRoomsWithOffsetWithUserDataSuccessAction,
  // fillRoomsWithOffsetWithUserDataFailureAction,
  // fillRoomsWithOffsetWithMessagesSuccessAction,
  // fillRoomsWithOffsetWithMessagesFailureAction,
} from 'src/app/store/actions/rooms.action';
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
  fillRoomByIdWithUserDataSuccessAction,
  fillRoomByIdWithUserDataFailureAction,
  fillRoomByIdWithMessagesSuccessAction,
  fillRoomByIdWithMessagesFailureAction,
  fillRoomWithUserDataSuccessAction,
  fillRoomWithUserDataFailureAction,
  fillRoomWithMessagesSuccessAction,
  fillRoomWithMessagesFailureAction,
} from 'src/app/store/actions/room.action';

@Injectable()
export class RoomEffects {
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

  // fillRoomsWithUserData$ = createEffect(() =>
  //   this.actions$.pipe(
  //     ofType(getRoomsSuccessAction),
  //     mergeMap((action) =>
  //       from(action.payload.documents).pipe(
  //         mergeMap((room: any) => {
  //           const userId = room.users.filter(
  //             (id: string) => id !== action.currentUserId
  //           )[0];
  //           return this.userService
  //             .getUserDoc2(userId)
  //             .pipe(map((userData) => ({ ...room, userData })));
  //         }),
  //         toArray(),
  //         map((roomsWithUserData) =>
  //           fillRoomsWithUserDataSuccessAction({
  //             payload: {
  //               total: action.payload.total,
  //               documents: roomsWithUserData,
  //             },
  //           })
  //         ),

  //         catchError((errorResponse: HttpErrorResponse) => {
  //           const error: ErrorInterface = {
  //             message: errorResponse.message,
  //           };
  //           return of(fillRoomsWithUserDataFailureAction({ error }));
  //         })
  //       )
  //     )
  //   )
  // );

  // fillRoomsWithMessages$ = createEffect(() =>
  //   this.actions$.pipe(
  //     ofType(fillRoomsWithUserDataSuccessAction),
  //     mergeMap((action) =>
  //       from(action.payload.documents).pipe(
  //         mergeMap((room: any) => {
  //           return this.messageService.listMessages(room.$id).pipe(
  //             map((messages) => ({
  //               ...room,
  //               total: messages.total,
  //               messages: messages.documents,
  //             }))
  //           );
  //         }),
  //         toArray(),
  //         map((roomsWithMessages) =>
  //           fillRoomsWithMessagesSuccessAction({
  //             payload: {
  //               total: action.payload.total,
  //               documents: roomsWithMessages,
  //             },
  //           })
  //         ),
  //         catchError((errorResponse: HttpErrorResponse) => {
  //           const error: ErrorInterface = {
  //             message: errorResponse.message,
  //           };
  //           return of(fillRoomsWithMessagesFailureAction({ error }));
  //         })
  //       )
  //     )
  //   )
  // );

  // fillRoomsWithOffsetWithUserData$ = createEffect(() =>
  //   this.actions$.pipe(
  //     ofType(getRoomsWithOffsetSuccessAction),
  //     mergeMap((action) =>
  //       from(action.payload.documents).pipe(
  //         mergeMap((room: any) => {
  //           const userId = room.users.filter(
  //             (id: string) => id !== action.currentUserId
  //           )[0];
  //           return this.userService
  //             .getUserDoc2(userId)
  //             .pipe(map((userData) => ({ ...room, userData })));
  //         }),
  //         toArray(),
  //         map((roomsWithUserData) =>
  //           fillRoomsWithOffsetWithUserDataSuccessAction({
  //             payload: {
  //               total: action.payload.total,
  //               documents: roomsWithUserData,
  //             },
  //           })
  //         ),
  //         catchError((errorResponse: HttpErrorResponse) => {
  //           const error: ErrorInterface = {
  //             message: errorResponse.message,
  //           };
  //           return of(fillRoomsWithOffsetWithUserDataFailureAction({ error }));
  //         })
  //       )
  //     )
  //   )
  // );

  // fillRoomsWithOffsetWithMessages$ = createEffect(() =>
  //   this.actions$.pipe(
  //     ofType(fillRoomsWithOffsetWithUserDataSuccessAction),
  //     mergeMap((action) =>
  //       from(action.payload.documents).pipe(
  //         mergeMap((room: any) => {
  //           return this.messageService.listMessages(room.$id).pipe(
  //             map((messages) => ({
  //               ...room,
  //               total: messages.total,
  //               messages: messages.documents,
  //             }))
  //           );
  //         }),
  //         toArray(),
  //         map((roomsWithMessages) =>
  //           fillRoomsWithOffsetWithMessagesSuccessAction({
  //             payload: {
  //               total: action.payload.total,
  //               documents: roomsWithMessages,
  //             },
  //           })
  //         ),
  //         catchError((errorResponse: HttpErrorResponse) => {
  //           const error: ErrorInterface = {
  //             message: errorResponse.message,
  //           };
  //           return of(fillRoomsWithOffsetWithMessagesFailureAction({ error }));
  //         })
  //       )
  //     )
  //   )
  // );

  getRoomById$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getRoomByIdAction),
      switchMap(({ currentUserId, roomId }) =>
        this.roomService.getRoomById(roomId).pipe(
          map((payload: RoomExtendedInterface) =>
            getRoomByIdSuccessAction({ payload, currentUserId })
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

  fillRoomByIdWithUserData$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getRoomByIdSuccessAction),
      mergeMap((action) => {
        const room = action.payload;
        const userId = room.users.filter(
          (id: string) => id !== action.currentUserId
        )[0];
        return this.userService.getUserDoc2(userId).pipe(
          map((userData) => ({ ...room, userData })),
          map((roomWithUserData) =>
            fillRoomByIdWithUserDataSuccessAction({ payload: roomWithUserData })
          )
        );
      }),

      catchError((errorResponse: HttpErrorResponse) => {
        const error: ErrorInterface = {
          message: errorResponse.message,
        };
        return of(fillRoomByIdWithUserDataFailureAction({ error }));
      })
    )
  );

  fillRoomByIdWithMessages$ = createEffect(() =>
    this.actions$.pipe(
      ofType(fillRoomByIdWithUserDataSuccessAction),
      mergeMap((action) => {
        const room = action.payload;
        return this.messageService.listMessages(room.$id).pipe(
          map((messages) => ({
            ...room,
            total: messages.total,
            messages: messages.documents,
          })),
          map((roomWithMessages) =>
            fillRoomByIdWithMessagesSuccessAction({ payload: roomWithMessages })
          )
        );
      }),

      catchError((errorResponse: HttpErrorResponse) => {
        const error: ErrorInterface = {
          message: errorResponse.message,
        };
        return of(fillRoomByIdWithMessagesFailureAction({ error }));
      })
    )
  );

  getRoom$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getRoomAction),
      switchMap(({ currentUserId, userId }) =>
        this.roomService.getRoom(currentUserId, userId).pipe(
          map((data: listRoomsResponseInterface) => {
            if (data.total === 1) {
              const payload: RoomExtendedInterface = data.documents[0];
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
          map((payload: RoomExtendedInterface) =>
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

  fillRoomWithUserData$ = createEffect(() =>
    this.actions$.pipe(
      ofType(createRoomSuccessAction, getRoomSuccessAction),
      mergeMap((action) => {
        const room = action.payload;
        const userId = room.users.filter((id: string) => id !== room.$id)[0];
        return this.userService.getUserDoc2(userId).pipe(
          map((userData) => ({ ...room, userData })),
          map((roomWithUserData) =>
            fillRoomWithUserDataSuccessAction({ payload: roomWithUserData })
          )
        );
      }),

      catchError((errorResponse: HttpErrorResponse) => {
        const error: ErrorInterface = {
          message: errorResponse.message,
        };
        return of(fillRoomWithUserDataFailureAction({ error }));
      })
    )
  );

  fillRoomWithMessages$ = createEffect(() =>
    this.actions$.pipe(
      ofType(fillRoomWithUserDataSuccessAction),
      mergeMap((action) => {
        const room = action.payload;
        return this.messageService.listMessages(room.$id).pipe(
          map((messages) => ({
            ...room,
            total: messages.total,
            messages: messages.documents,
          })),
          map((roomWithMessages) =>
            fillRoomWithMessagesSuccessAction({ payload: roomWithMessages })
          )
        );
      }),

      catchError((errorResponse: HttpErrorResponse) => {
        const error: ErrorInterface = {
          message: errorResponse.message,
        };
        return of(fillRoomWithMessagesFailureAction({ error }));
      })
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

  constructor(
    private actions$: Actions,
    private router: Router,
    private roomService: RoomService,
    private userService: UserService,
    private messageService: MessageService
  ) {}
}
