import { Injectable } from '@angular/core';
import { createEffect, ofType, Actions } from '@ngrx/effects';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, map, of, switchMap, tap } from 'rxjs';

import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { MessageService } from 'src/app/services/chat/message.service';
import { listMessagesResponseInterface } from 'src/app/models/types/responses/listMessagesResponse.interface';
import { Message } from 'src/app/models/Message';
import {
  activateRoomAction,
  createMessageAction,
  createMessageFailureAction,
  createMessageSuccessAction,
  getMessagesAction,
  getMessagesFailureAction,
  getMessagesSuccessAction,
  getMessagesWithOffsetAction,
  getMessagesWithOffsetFailureAction,
  getMessagesWithOffsetSuccessAction,
} from 'src/app/store/actions/message.action';

@Injectable()
export class MessageEffects {
  getMessages$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getMessagesAction),
      switchMap(({ roomId }) =>
        this.messagesService.listMessages(roomId).pipe(
          map((payload: listMessagesResponseInterface) =>
            getMessagesSuccessAction({ payload })
          ),

          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(getMessagesFailureAction({ error }));
          })
        )
      )
    )
  );

  getMessagesWithOffset$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getMessagesWithOffsetAction),
      switchMap(({ roomId, offset }) =>
        this.messagesService.listMessages(roomId, offset).pipe(
          map((payload: listMessagesResponseInterface) =>
            getMessagesWithOffsetSuccessAction({ payload })
          ),

          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(getMessagesWithOffsetFailureAction({ error }));
          })
        )
      )
    )
  );

  createMessage$ = createEffect(() =>
    this.actions$.pipe(
      ofType(createMessageAction),
      switchMap(({ request, currentUserId }) =>
        this.messagesService.createMessage(request, currentUserId).pipe(
          map((payload: Message) => createMessageSuccessAction({ payload })),

          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(createMessageFailureAction({ error }));
          })
        )
      )
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

  constructor(
    private actions$: Actions,
    private messagesService: MessageService,
    private router: Router
  ) {}
}
