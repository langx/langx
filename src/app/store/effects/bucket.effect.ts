import { Injectable } from '@angular/core';
import { createEffect, ofType, Actions } from '@ngrx/effects';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, map, of, switchMap, withLatestFrom } from 'rxjs';
import { Store, select } from '@ngrx/store';
import { InAppReview } from '@capacitor-community/in-app-review';

import { User } from 'src/app/models/User';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { UserService } from 'src/app/services/user/user.service';
import { MessageService } from 'src/app/services/chat/message.service';

import { currentUserSelector } from 'src/app/store/selectors/auth.selector';

import {
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
      switchMap(({ request }) => {
        return this.userService.uploadUserFile(request).pipe(
          switchMap((payload) => {
            return this.userService
              .updateUserDoc({
                profilePic: payload.$id,
              })
              .pipe(
                map((userData: User) => {
                  // Request a review
                  InAppReview.requestReview();

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
      withLatestFrom(this.store.pipe(select(currentUserSelector))),
      switchMap(([{ request }, currentUser]) => {
        return this.userService.uploadUserFile(request).pipe(
          switchMap((payload) => {
            const updatedOtherPics = [...currentUser?.otherPics, payload.$id];
            return this.userService
              .updateUserDoc({
                otherPics: updatedOtherPics,
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

  constructor(
    private store: Store,
    private actions$: Actions,
    private userService: UserService,
    private messageService: MessageService
  ) {}
}
