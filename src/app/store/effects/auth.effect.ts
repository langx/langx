import { Injectable } from '@angular/core';
import { createEffect, ofType, Actions } from '@ngrx/effects';
import { Router } from '@angular/router';
import { Store, select } from '@ngrx/store';
import { HttpErrorResponse } from '@angular/common/http';
import {
  catchError,
  map,
  of,
  switchMap,
  tap,
  forkJoin,
  combineLatest,
  withLatestFrom,
} from 'rxjs';

// Import Services
import { AuthService } from 'src/app/services/auth/auth.service';
import { UserService } from 'src/app/services/user/user.service';
import { LanguageService } from 'src/app/services/user/language.service';

// Import Interfaces
import { Account } from 'src/app/models/Account';
import { User } from 'src/app/models/User';
import { Language } from 'src/app/models/Language';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { createLanguageRequestInterface } from 'src/app/models/types/requests/createLanguageRequest.interface';
import { isLoggedInResponseInterface } from 'src/app/models/types/responses/isLoggedInResponse.interface';
import { listIdentitiesResponseInterface } from 'src/app/models/types/responses/listIdentitiesResponse.interface';
import { listSessionsResponseInterface } from 'src/app/models/types/responses/listSessionsResponse.interface';

// Import Selector and Actions
import { currentUserSelector } from 'src/app/store/selectors/auth.selector';
import {
  blockUserAction,
  blockUserFailureAction,
  blockUserSuccessAction,
  completeRegistrationAction,
  completeRegistrationFailureAction,
  completeRegistrationSuccessAction,
  deleteAccountAction,
  deleteAccountFailureAction,
  deleteAccountSuccessAction,
  getBlockedUsersAction,
  getBlockedUsersFailureAction,
  getBlockedUsersSuccessAction,
  isLoggedInAction,
  isLoggedInFailureAction,
  isLoggedInSuccessAction,
  isLoggedInSuccessCompleteRegistrationAction,
  languageSelectionAction,
  languageSelectionFailureAction,
  languageSelectionSuccessAction,
  listIdentitiesAction,
  listIdentitiesFailureAction,
  listIdentitiesSuccessAction,
  listSessionsAction,
  listSessionsFailureAction,
  listSessionsSuccessAction,
  loginAction,
  loginFailureAction,
  loginSuccessAction,
  logoutAction,
  logoutFailureAction,
  logoutSuccessAction,
  registerAction,
  registerFailureAction,
  registerSuccessAction,
  resetPasswordAction,
  resetPasswordConfirmationAction,
  resetPasswordConfirmationFailureAction,
  resetPasswordConfirmationSuccessAction,
  resetPasswordFailureAction,
  resetPasswordSuccessAction,
  unBlockUserAction,
  unBlockUserFailureAction,
  unBlockUserSuccessAction,
  updateLanguageArrayAction,
  updateLanguageArrayFailureAction,
  updateLanguageArraySuccessAction,
  updatePasswordAction,
  updatePasswordFailureAction,
  updatePasswordSuccessAction,
  verifyEmailAction,
  verifyEmailConfirmationAction,
  verifyEmailConfirmationFailureAction,
  verifyEmailConfirmationSuccessAction,
  verifyEmailFailureAction,
  verifyEmailSuccessAction,
} from 'src/app/store/actions/auth.action';

@Injectable()
export class AuthEffect {
  login$ = createEffect(() =>
    this.actions$.pipe(
      ofType(loginAction),
      switchMap(({ request }) =>
        this.authService.login(request).pipe(
          map((payload: Account) => loginSuccessAction({ payload })),

          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(loginFailureAction({ error }));
          })
        )
      )
    )
  );

  redirectAfterLogin$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(loginSuccessAction),
        tap(() => {
          this.router.navigateByUrl('/auth/success');
        })
      ),
    { dispatch: false }
  );

  register$ = createEffect(() =>
    this.actions$.pipe(
      ofType(registerAction),
      switchMap(({ request }) =>
        this.authService.register(request).pipe(
          map((payload: Account) => registerSuccessAction({ payload })),

          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(registerFailureAction({ error }));
          })
        )
      )
    )
  );

  redirectAfterRegister$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(registerSuccessAction),
        tap(() => {
          this.router.navigateByUrl('/signup/complete');
        })
      ),
    { dispatch: false }
  );

  completeRegistration$ = createEffect(() =>
    this.actions$.pipe(
      ofType(completeRegistrationAction),
      switchMap(({ request, id }) => {
        return this.userService.createUserDoc(id, request).pipe(
          map((payload: User) =>
            completeRegistrationSuccessAction({ payload })
          ),

          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(completeRegistrationFailureAction({ error }));
          })
        );
      })
    )
  );

  redirectAfterCompleteRegistration$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(completeRegistrationSuccessAction),
        tap(() => {
          this.router.navigateByUrl('/signup/language');
        })
      ),
    { dispatch: false }
  );

  languageSelection$ = createEffect(() =>
    this.actions$.pipe(
      ofType(languageSelectionAction),

      switchMap(({ request }) => {
        const observables = request.map(
          (language: createLanguageRequestInterface) => {
            return this.languageService.createLanguageDoc(language);
          }
        );
        return forkJoin(observables).pipe(
          map((payload: Language[]) =>
            languageSelectionSuccessAction({ payload })
          ),

          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(languageSelectionFailureAction({ error }));
          })
        );
      })
    )
  );

  updateLanguageArray$ = createEffect(() =>
    this.actions$.pipe(
      ofType(updateLanguageArrayAction),

      switchMap(({ request, id }) => {
        return this.userService
          .updateUserDoc(id, {
            languageArray: request,
          })
          .pipe(
            map((payload: User) =>
              updateLanguageArraySuccessAction({ payload })
            ),

            catchError((errorResponse: HttpErrorResponse) => {
              const error: ErrorInterface = {
                message: errorResponse.message,
              };
              return of(updateLanguageArrayFailureAction({ error }));
            })
          );
      })
    )
  );

  redirectAfterBothLanguageSelectionAndUpdateLanguageArray$ = createEffect(
    () =>
      combineLatest([
        this.actions$.pipe(ofType(languageSelectionSuccessAction)),
        this.actions$.pipe(ofType(updateLanguageArraySuccessAction)),
      ]).pipe(
        tap(() => {
          this.router.navigateByUrl('/home');
        })
      ),
    { dispatch: false }
  );

  isLoggedIn$ = createEffect(() =>
    this.actions$.pipe(
      ofType(isLoggedInAction),
      switchMap(() => {
        return this.authService.getAccount().pipe(
          switchMap((account: Account) => {
            return this.userService.getUserDoc(account.$id).pipe(
              map((currentUser: User) => {
                const payload: isLoggedInResponseInterface = {
                  account: account,
                  currentUser: currentUser,
                };
                return isLoggedInSuccessAction({ payload });
              }),
              catchError(() => {
                const payload: isLoggedInResponseInterface = {
                  account: account,
                  currentUser: null,
                };
                const error: ErrorInterface = {
                  message: 'Registration is not completed yet.',
                };
                return of(
                  isLoggedInSuccessCompleteRegistrationAction({
                    payload,
                    error,
                  })
                );
              })
            );
          }),
          catchError(() => {
            const error: ErrorInterface = {
              message: 'Please login or signup to continue.',
            };
            return of(isLoggedInFailureAction({ error }));
          })
        );
      })
    )
  );

  verifyEmail$ = createEffect(() =>
    this.actions$.pipe(
      ofType(verifyEmailAction),
      switchMap(() => {
        return this.authService.verifyEmail().pipe(
          map(() => {
            return verifyEmailSuccessAction();
          }),
          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(verifyEmailFailureAction({ error }));
          })
        );
      })
    )
  );

  verifyEmailConfirmation$ = createEffect(() =>
    this.actions$.pipe(
      ofType(verifyEmailConfirmationAction),
      switchMap(({ request }) => {
        return this.authService
          .verifyEmailConfirmation(request.userId, request.secret)
          .pipe(
            map(({ response }) => {
              console.log('response', response);
              if (response?.secret !== '') {
                return verifyEmailConfirmationSuccessAction();
              } else {
                const error: ErrorInterface = {
                  message: response?.message,
                };
                return verifyEmailConfirmationFailureAction({ error });
              }
            }),
            catchError((errorResponse: HttpErrorResponse) => {
              const error: ErrorInterface = {
                message: errorResponse.message,
              };
              return of(verifyEmailConfirmationFailureAction({ error }));
            })
          );
      })
    )
  );

  redirectAfterVerifyEmailConfirmationSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(verifyEmailConfirmationSuccessAction),
        tap(() => {
          setTimeout(() => {
            this.router.navigateByUrl('/home');
          }, 3000);
        })
      ),
    { dispatch: false }
  );

  redirectAfterVerifyEmailConfirmationFailure$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(verifyEmailConfirmationFailureAction),
        tap(() => {
          setTimeout(() => {
            this.router.navigateByUrl('/home/account');
          }, 3000);
        })
      ),
    { dispatch: false }
  );

  resetPassword$ = createEffect(() =>
    this.actions$.pipe(
      ofType(resetPasswordAction),
      switchMap(({ request }) => {
        return this.authService.resetPassword(request.email).pipe(
          map(() => {
            return resetPasswordSuccessAction();
          }),
          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(resetPasswordFailureAction({ error }));
          })
        );
      })
    )
  );

  resetPasswordConfirmation$ = createEffect(() =>
    this.actions$.pipe(
      ofType(resetPasswordConfirmationAction),
      switchMap(({ request }) => {
        return this.authService.updateRecovery(request).pipe(
          map(() => {
            return resetPasswordConfirmationSuccessAction();
          }),
          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(resetPasswordConfirmationFailureAction({ error }));
          })
        );
      })
    )
  );

  redirectAfterResetPasswordSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(
          resetPasswordSuccessAction,
          resetPasswordConfirmationSuccessAction
        ),
        tap(() => {
          this.router.navigateByUrl('/login');
        })
      ),
    { dispatch: false }
  );

  updatePassword$ = createEffect(() =>
    this.actions$.pipe(
      ofType(updatePasswordAction),
      switchMap(({ request }) => {
        return this.authService
          .updatePassword(request.password, request.oldPassword)
          .pipe(
            map(() => {
              return updatePasswordSuccessAction();
            }),
            catchError((errorResponse: HttpErrorResponse) => {
              const error: ErrorInterface = {
                message: errorResponse.message,
              };
              return of(updatePasswordFailureAction({ error }));
            })
          );
      })
    )
  );

  redirectAfterUpdatePasswordSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(updatePasswordSuccessAction),
        tap(() => {
          this.router.navigateByUrl('/home/account');
        })
      ),
    { dispatch: false }
  );

  listIdentities$ = createEffect(() =>
    this.actions$.pipe(
      ofType(listIdentitiesAction),
      switchMap(() => {
        return this.authService.listIdentities().pipe(
          map((payload: listIdentitiesResponseInterface) => {
            return listIdentitiesSuccessAction({ payload });
          }),
          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(listIdentitiesFailureAction({ error }));
          })
        );
      })
    )
  );

  listSessions$ = createEffect(() =>
    this.actions$.pipe(
      ofType(listSessionsAction),
      switchMap(() => {
        return this.authService.listSessions().pipe(
          map((payload: listSessionsResponseInterface) => {
            return listSessionsSuccessAction({ payload });
          }),
          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(listSessionsFailureAction({ error }));
          })
        );
      })
    )
  );

  deleteAccount$ = createEffect(() =>
    this.actions$.pipe(
      ofType(deleteAccountAction),
      withLatestFrom(this.store.pipe(select(currentUserSelector))),
      switchMap(([action, currentUser]) => {
        return this.authService.deleteAccount(currentUser?.$id).pipe(
          map((payload) => {
            return deleteAccountSuccessAction({ payload });
          }),
          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(deleteAccountFailureAction({ error }));
          })
        );
      })
    )
  );

  blockUser$ = createEffect(() =>
    this.actions$.pipe(
      ofType(blockUserAction),
      withLatestFrom(this.store.pipe(select(currentUserSelector))),
      switchMap(([{ request }, currentUser]) => {
        return this.userService.blockUser(currentUser, request.userId).pipe(
          map((payload: User) => blockUserSuccessAction({ payload })),

          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(blockUserFailureAction({ error }));
          })
        );
      })
    )
  );

  unBlockUser$ = createEffect(() =>
    this.actions$.pipe(
      ofType(unBlockUserAction),
      withLatestFrom(this.store.pipe(select(currentUserSelector))),
      switchMap(([{ request }, currentUser]) => {
        return this.userService.unBlockUser(currentUser, request.userId).pipe(
          map((payload: User) => unBlockUserSuccessAction({ payload })),

          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(unBlockUserFailureAction({ error }));
          })
        );
      })
    )
  );

  getBlockedUsers$ = createEffect(() =>
    this.actions$.pipe(
      ofType(getBlockedUsersAction),
      switchMap(({ request }) => {
        return this.userService.getBlockedUsers(request.blockedUsers).pipe(
          map((payload: User[]) => {
            return getBlockedUsersSuccessAction({ payload });
          }),

          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(getBlockedUsersFailureAction({ error }));
          })
        );
      })
    )
  );

  logout$ = createEffect(() =>
    this.actions$.pipe(
      ofType(logoutAction),
      switchMap(() => {
        return this.authService.logout().pipe(
          map(() => {
            return logoutSuccessAction({ payload: null });
          }),
          catchError((errorResponse: HttpErrorResponse) => {
            const error: ErrorInterface = {
              message: errorResponse.message,
            };
            return of(logoutFailureAction({ error }));
          })
        );
      })
    )
  );

  redirectAfterLogout$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(logoutSuccessAction, deleteAccountSuccessAction),
        tap(() => {
          this.router.navigateByUrl('/', { replaceUrl: true });
        })
      ),
    { dispatch: false }
  );

  constructor(
    private store: Store,
    private actions$: Actions,
    private authService: AuthService,
    private userService: UserService,
    private languageService: LanguageService,
    private router: Router
  ) {}
}
