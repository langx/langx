import { Injectable } from '@angular/core';
import { createEffect, ofType, Actions } from '@ngrx/effects';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, map, mergeMap, of, switchMap } from 'rxjs';
import { Store } from '@ngrx/store';

// Interface Imports
import { Message } from 'src/app/models/Message';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { AxiosError } from 'axios';
import { MessageService } from 'src/app/services/chat/message.service';
import { listMessagesResponseInterface } from 'src/app/models/types/responses/listMessagesResponse.interface';
import { createMessageRequestInterface } from 'src/app/models/types/requests/createMessageRequest.interface';

// Selector and Action Imports
import {
  createMessageAction,
  createMessageFailureAction,
  createMessageSuccessAction,
  deleteMessageAction,
  deleteMessageFailureAction,
  deleteMessageSuccessAction,
  getMessagesWithOffsetAction,
  getMessagesWithOffsetFailureAction,
  getMessagesWithOffsetSuccessAction,
  resendMessageFromTempMessagesAction,
  resendMessageFromTempMessagesFailureAction,
  resendMessageFromTempMessagesSuccessAction,
  updateMessageSeenAction,
  updateMessageSeenFailureAction,
  updateMessageSeenSuccessAction,
} from 'src/app/store/actions/message.action';

@Injectable()
export class MessageEffects {
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
      mergeMap(({ request }) => {
        if (request.to === 'deleted-user') {
          const error: ErrorInterface = {
            message: 'Cannot send message to deleted user',
          };
          return of(createMessageFailureAction({ error, payload: request }));
        }

        return this.messagesService.createMessage(request).pipe(
          map((payload: Message) => createMessageSuccessAction({ payload })),

          catchError((errorResponse: AxiosError) => {
            console.log(errorResponse?.response?.data);
            const error: ErrorInterface = {
              message: errorResponse?.response?.data['message'],
            };
            return of(createMessageFailureAction({ error, payload: request }));
          })
        );
      })
    )
  );

  updateMessage$ = createEffect(() =>
    this.actions$.pipe(
      ofType(updateMessageSeenAction),
      mergeMap(({ request }) =>
        this.messagesService.updateMessage(request).pipe(
          map((payload: Message) =>
            updateMessageSeenSuccessAction({ payload })
          ),

          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(updateMessageSeenFailureAction({ error }));
          })
        )
      )
    )
  );

  // TODO: Use request directly instead of creating newRequest
  resendMessage$ = createEffect(() =>
    this.actions$.pipe(
      ofType(resendMessageFromTempMessagesAction),
      mergeMap((action) => {
        const newRequest: createMessageRequestInterface = {
          $id: action.request.$id,
          roomId: action.request.roomId,
          to: action.request.to,
          type: action.request.type,
          body: action.request?.body || null,
          image: action.request?.image || null,
          audio: action.request?.audio || null,
        };

        return this.messagesService.createMessage(newRequest).pipe(
          map((payload: Message) =>
            resendMessageFromTempMessagesSuccessAction({ payload })
          ),

          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(
              resendMessageFromTempMessagesFailureAction({
                error,
                payload: action.request,
              })
            );
          })
        );
      })
    )
  );

  deleteMessage$ = createEffect(() =>
    this.actions$.pipe(
      ofType(deleteMessageAction),
      mergeMap(({ request }) =>
        this.messagesService.deleteMessage(request).pipe(
          map((payload: Message) =>
            deleteMessageSuccessAction({
              payload: { ...payload, $id: request.$id },
            })
          ),
          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(deleteMessageFailureAction({ error }));
          })
        )
      )
    )
  );

  constructor(
    private actions$: Actions,
    private store: Store,
    private messagesService: MessageService
  ) {}
}
