import { Injectable } from '@angular/core';
import { ID, Models, OAuthProvider } from 'appwrite';
import { BehaviorSubject, concatMap, from, tap, Observable, of } from 'rxjs';

// Environment and services Imports
import { environment } from 'src/environments/environment';
import { ApiService } from 'src/app/services/api/api.service';

// Interface Imports
import { Account } from 'src/app/models/Account';
import { RegisterRequestInterface } from 'src/app/models/types/requests/registerRequest.interface';
import { LoginRequestInterface } from 'src/app/models/types/requests/loginRequest.interface';
import { resetPasswordConfirmationRequestInterface } from 'src/app/models/types/requests/resetPasswordConfirmationRequest.interface';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private _user = new BehaviorSubject<Account | null>(null);

  constructor(private api: ApiService) {}

  //
  // USER DATA
  //

  getUser() {
    return this._user.asObservable();
  }

  getUserId() {
    return this._user.value?.$id;
  }

  createJWT() {
    return this.api.account.createJWT();
  }

  //
  // ACCOUNT API
  //

  login(data: LoginRequestInterface): Observable<Account> {
    const authReq = this.api.account.createEmailPasswordSession(
      data.email,
      data.password
    );
    return from(authReq).pipe(
      concatMap(() => this.api.account.get()),
      tap((user) => this._user.next(user))
    );
  }

  register(data: RegisterRequestInterface): Observable<Account> {
    const promise = this.api.account.create(
      ID.unique(),
      data.email,
      data.password,
      data.name
    );
    return from(promise).pipe(
      concatMap(() =>
        this.api.account.createEmailPasswordSession(data.email, data.password)
      ),
      concatMap(() => this.api.account.get()),
      tap((user) => {
        return this._user.next(user);
      })
    );
  }

  updatePrefs(prefs: Models.Preferences) {
    const authReq = this.api.account.updatePrefs(prefs);
    return from(authReq).pipe(
      concatMap(() => this.api.account.get()),
      tap((user) => this._user.next(user))
    );
  }

  getPrefs() {
    const authReq = this.api.account.getPrefs();
    return from(authReq);
  }

  getAccount(): Observable<Account> {
    return from(this.api.account.get());
  }

  listIdentities(): Observable<Models.IdentityList> {
    return from(this.api.account.listIdentities());
  }

  deleteIdentity($id: string): Observable<any> {
    return from(this.api.account.deleteIdentity($id));
  }

  listSessions(): Observable<Models.SessionList> {
    return from(this.api.account.listSessions());
  }

  deleteSession($id: string): Observable<any> {
    return from(this.api.account.deleteSession($id));
  }

  verifyEmail(): Observable<any> {
    return from(
      this.api.account.createVerification(environment.url.VERIFY_EMAIL)
    );
  }

  verifyEmailConfirmation(userId: string, secret: string): Observable<any> {
    return from(this.api.account.updateVerification(userId, secret));
  }

  resetPassword(email: string): Observable<any> {
    return from(
      this.api.account.createRecovery(email, environment.url.RESET_PASSWORD_URL)
    );
  }

  updatePassword(password: string, oldPassword: string): Observable<any> {
    return from(this.api.account.updatePassword(password, oldPassword));
  }

  updateRecovery(
    req: resetPasswordConfirmationRequestInterface
  ): Observable<any> {
    return from(
      this.api.account.updateRecovery(
        req.id,
        req.secret,
        req.password
        // req.password2
      )
    );
  }

  signInWithDiscord() {
    this.api.account.createOAuth2Session(
      OAuthProvider.Discord,
      environment.url.SUCCESS_OAUTH2,
      environment.url.FAILURE_OAUTH2
    );
  }

  signInWithGoogle() {
    this.api.account.createOAuth2Session(
      OAuthProvider.Google,
      environment.url.SUCCESS_OAUTH2,
      environment.url.FAILURE_OAUTH2
    );
  }

  signInWithFacebook() {
    this.api.account.createOAuth2Session(
      OAuthProvider.Facebook,
      environment.url.SUCCESS_OAUTH2,
      environment.url.FAILURE_OAUTH2
    );
  }

  signInWithApple() {
    this.api.account.createOAuth2Session(
      OAuthProvider.Apple,
      environment.url.SUCCESS_OAUTH2,
      environment.url.FAILURE_OAUTH2
    );
  }

  deleteAccount(currentUserId: string): Observable<any> {
    return of(currentUserId).pipe(
      concatMap((userId) =>
        this.api.deleteDocument(environment.appwrite.USERS_COLLECTION, userId)
      ),
      concatMap(() => this.api.account.updateStatus())
    );
  }

  logout(): Observable<any> {
    return from(this.api.account.deleteSession('current')).pipe(
      tap(() => this._user.next(null)),
      tap(() => this._user.next(null))
    );
  }
}
