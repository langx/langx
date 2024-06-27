import { Injectable } from '@angular/core';
import { createEffect, ofType, Actions } from '@ngrx/effects';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Observable,
  catchError,
  from,
  map,
  mergeMap,
  of,
  switchMap,
} from 'rxjs';

// Interface Imports
import { Message } from 'src/app/models/Message';
import { BucketFile } from 'src/app/models/BucketFile';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { AxiosError } from 'axios';
import { listMessagesResponseInterface } from 'src/app/models/types/responses/listMessagesResponse.interface';

// Service Imports
import { ApiService } from 'src/app/services/api/api.service';
import { MessageService } from 'src/app/services/chat/message.service';

// Selector and Action Imports
import {
  createMessageAction,
  createMessageFailureAction,
  createMessageSuccessAction,
  deleteMessageAction,
  deleteMessageFailureAction,
  deleteMessageSuccessAction,
  detachCopilotAction,
  detachCopilotFailureAction,
  detachCopilotSuccessAction,
  getMessagesWithOffsetAction,
  getMessagesWithOffsetFailureAction,
  getMessagesWithOffsetSuccessAction,
  updateMessageAction,
  updateMessageFailureAction,
  updateMessageSuccessAction,
} from 'src/app/store/actions/message.action';

@Injectable()
export class MessageEffects {
  getMessagesWithOffset$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getMessagesWithOffsetAction),
      switchMap(({ roomId, offset }) =>
        this.messageService.listMessages(roomId, offset).pipe(
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
      mergeMap(({ messageType, request, file }) => {
        if (request.to === 'deleted-user') {
          const error: ErrorInterface = {
            message: 'Cannot send message to deleted user',
          };
          return of(createMessageFailureAction({ error, payload: request }));
        }

        // If there's no file and messageType is 'body', directly create the message
        if (!file && messageType === 'body') {
          return this.messageService.createMessage(request).pipe(
            map((payload: Message) => createMessageSuccessAction({ payload })),
            catchError((errorResponse: AxiosError) => {
              const error: ErrorInterface = {
                message: errorResponse?.response?.data['message'],
              };
              return of(
                createMessageFailureAction({ error, payload: request })
              );
            })
          );
        }

        let uploadObservable: Observable<BucketFile>;
        let updatedRequest;
        if (file) {
          if (messageType === 'image') {
            uploadObservable = this.messageService.uploadMessageImage(file);
          } else if (messageType === 'audio') {
            uploadObservable = this.messageService.uploadMessageAudio(file);
          }
        }

        return uploadObservable.pipe(
          switchMap((uploadResponse) => {
            // Trigger bucket permission function here
            return from(
              this.api.function.createExecution(
                'update-file-permission',
                JSON.stringify({
                  fileId: uploadResponse.$id,
                  to: request.to,
                  type: messageType,
                })
              )
            ).pipe(
              switchMap(() => {
                if (messageType === 'image') {
                  updatedRequest = {
                    ...request,
                    imageId: uploadResponse.$id,
                  };
                } else if (messageType === 'audio') {
                  updatedRequest = {
                    ...request,
                    audioId: uploadResponse.$id,
                  };
                }

                return this.messageService.createMessage(updatedRequest).pipe(
                  map((payload: Message) =>
                    createMessageSuccessAction({ payload })
                  ),
                  catchError((errorResponse: AxiosError) => {
                    const error: ErrorInterface = {
                      message: errorResponse?.response?.data['message'],
                    };
                    return of(
                      createMessageFailureAction({
                        error,
                        payload: updatedRequest,
                      })
                    );
                  })
                );
              })
            );
          })
        );
      })
    )
  );

  updateMessage$ = createEffect(() =>
    this.actions$.pipe(
      ofType(updateMessageAction),
      mergeMap(({ request }) =>
        this.messageService.updateMessage(request).pipe(
          map((payload: Message) => updateMessageSuccessAction({ payload })),

          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(updateMessageFailureAction({ error }));
          })
        )
      )
    )
  );

  detachCopilot$ = createEffect(() =>
    this.actions$.pipe(
      ofType(detachCopilotAction),
      mergeMap(({ payload }) =>
        this.messageService.detachCopilot(payload).pipe(
          map(() => detachCopilotSuccessAction({ payload })),
          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(detachCopilotFailureAction({ error }));
          })
        )
      )
    )
  );

  deleteMessage$ = createEffect(() =>
    this.actions$.pipe(
      ofType(deleteMessageAction),
      mergeMap(({ request }) =>
        this.messageService.deleteMessage(request).pipe(
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
    private api: ApiService,
    private messageService: MessageService
  ) {}
}
