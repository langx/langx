import { Injectable } from '@angular/core';
import { createEffect, ofType, Actions, act } from '@ngrx/effects';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, map, mergeMap, of, switchMap, withLatestFrom } from 'rxjs';
import { Store, select } from '@ngrx/store';

// Interface Imports
import { Message } from 'src/app/models/Message';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { MessageService } from 'src/app/services/chat/message.service';
import { listMessagesResponseInterface } from 'src/app/models/types/responses/listMessagesResponse.interface';
import { createMessageRequestInterface } from 'src/app/models/types/requests/createMessageRequest.interface';

// Selector and Action Imports
import { currentUserSelector } from '../selectors/auth.selector';
import {
  createMessageAction,
  createMessageFailureAction,
  createMessageSuccessAction,
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
      withLatestFrom(this.store.select(currentUserSelector)),
      mergeMap(([{ request }, currentUser]) =>
        this.messagesService.createMessage(request, currentUser.$id).pipe(
          map((payload: Message) => createMessageSuccessAction({ payload })),

          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(createMessageFailureAction({ error, payload: request }));
          })
        )
      )
    )
  );

  updateMessage$ = createEffect(() =>
    this.actions$.pipe(
      ofType(updateMessageSeenAction),
      // TODO: #263 It may be mergeMap as well!
      switchMap(({ request }) =>
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
      withLatestFrom(this.store.pipe(select(currentUserSelector))),
      mergeMap(([action, currentUser]) => {
        const newRequest: createMessageRequestInterface = {
          $id: action.request.$id,
          roomId: action.request.roomId,
          to: action.request.to,
          type: action.request.type,
          body: action.request.body,
        };

        return this.messagesService
          .createMessage(newRequest, currentUser.$id)
          .pipe(
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

  constructor(
    private actions$: Actions,
    private store: Store,
    private messagesService: MessageService
  ) {}
}
