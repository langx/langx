import { Injectable } from '@angular/core';
import { createEffect, ofType, Actions } from '@ngrx/effects';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, map, of, switchMap } from 'rxjs';

import { User } from 'src/app/models/User';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { UserService } from 'src/app/services/user/user.service';
import { MessageService } from 'src/app/services/chat/message.service';

import {
  uploadAudioForMessageAction,
  uploadAudioForMessageFailureAction,
  uploadAudioForMessageSuccessAction,
  uploadImageForMessageAction,
  uploadImageForMessageFailureAction,
  uploadImageForMessageSuccessAction,
  uploadOtherPhotosAction,
  uploadOtherPhotosFailureAction,
  uploadOtherPhotosSuccessAction,
  uploadProfilePictureAction,
  uploadProfilePictureFailureAction,
  uploadProfilePictureSuccessAction,
} from 'src/app/store/actions/bucket.action';

@Injectable()
export class BucketEffects {
  uploadProfilePicture$ = createEffect(() =>
    this.actions$.pipe(
      ofType(uploadProfilePictureAction),
      switchMap(({ request, currentUserId }) => {
        return this.userService.uploadFile(request).pipe(
          map((payload: URL) => {
            return payload;
          }),
          switchMap((payload) => {
            return this.userService
              .updateUserDoc(currentUserId, {
                profilePhoto: payload,
              })
              .pipe(
                map((userData: User) => {
                  return uploadProfilePictureSuccessAction({
                    payload: userData,
                  });
                })
              );
          }),
          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(uploadProfilePictureFailureAction({ error }));
          })
        );
      })
    )
  );

  uploadOtherPhotos$ = createEffect(() =>
    this.actions$.pipe(
      ofType(uploadOtherPhotosAction),
      switchMap(({ request, currentUserId, otherPhotos }) => {
        return this.userService.uploadFile(request).pipe(
          map((payload: URL) => {
            return payload;
          }),
          switchMap((payload) => {
            const updatedOtherPhotos = [...otherPhotos, payload];
            return this.userService
              .updateUserDoc(currentUserId, {
                otherPhotos: updatedOtherPhotos,
              })
              .pipe(
                map((payload) => {
                  return uploadOtherPhotosSuccessAction({ payload });
                })
              );
          })
        );
      }),
      catchError((errorResponse: HttpErrorResponse) => {
        const error: ErrorInterface = {
          message: errorResponse.message,
        };
        return of(uploadOtherPhotosFailureAction({ error }));
      })
    )
  );

  uploadImageForMessage$ = createEffect(() =>
    this.actions$.pipe(
      ofType(uploadImageForMessageAction),
      switchMap(({ request }) => {
        return this.messageService.uploadImage(request).pipe(
          map((payload) => {
            return uploadImageForMessageSuccessAction({ payload });
          }),

          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(uploadImageForMessageFailureAction({ error }));
          })
        );
      })
    )
  );

  uploadAudioForMessage$ = createEffect(() =>
    this.actions$.pipe(
      ofType(uploadAudioForMessageAction),
      switchMap(({ request }) => {
        return this.messageService.uploadAudio(request).pipe(
          map((payload) => {
            return uploadAudioForMessageSuccessAction({ payload });
          }),

          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(uploadAudioForMessageFailureAction({ error }));
          })
        );
      })
    )
  );

  constructor(
    private actions$: Actions,
    private userService: UserService,
    private messageService: MessageService
  ) {}
}
