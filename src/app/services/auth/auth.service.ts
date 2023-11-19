import { Injectable } from '@angular/core';
import { ID, Models } from 'appwrite';
import { BehaviorSubject, concatMap, from, tap, Observable } from 'rxjs';

import { ApiService } from 'src/app/services/api/api.service';
import { environment } from 'src/environments/environment';
import { RegisterRequestInterface } from 'src/app/models/types/requests/registerRequest.interface';
import { Account } from 'src/app/models/Account';
import { LoginRequestInterface } from 'src/app/models/types/requests/loginRequest.interface';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private _user = new BehaviorSubject<Account | null>(null);
  private account$: Observable<Account | null> = null;

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
    const authReq = this.api.account.createEmailSession(
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
        this.api.account.createEmailSession(data.email, data.password)
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

  logout() :Observable<any> {
    return from(this.api.account.deleteSession('current')).pipe(
      tap(() => this._user.next(null))
    );
  }

  resetPassword(email: string) {
    console.log('resetPassword:', email);
    return this.api.account
      .createRecovery(email, environment.url.RESET_PASSWORD_URL)
      .then((response) => {
        console.log('Recovery email sent', response);
      })
      .catch((error) => {
        console.log('Error sending recovery email', error);
      });
  }

  updateRecovery(userId: string, secret: string, password: string) {
    return this.api.account
      .updateRecovery(userId, secret, password, password)
      .then((response) => {
        console.log('Recovery successfully updated', response);
      })
      .catch((error) => {
        console.log('Error updating recovery', error);
        return error;
      });
  }

  // TODO: #149 Login with Google (createOAuth2Session)
  async signInWithGoogle() {
    console.log('signInWithGoogle');
    this.api.account.createOAuth2Session(
      'google',
      //environment.url.SIGNUP_COMPLETE_URL,
      environment.url.LOGIN_URL,
      environment.url.LOGIN_URL
    );
    const session = await this.api.account.getSession('current');

    // Provider information
    console.log(session.provider);
    console.log(session.providerUid);
    console.log(session.providerAccessToken);
  }

  // OPTIONAL: Login with Magic Link (createMagicSession)
  // Not needed to login anonymously
  /*
  anonLogin(name: string) {
    const authReq = this.api.account.createAnonymousSession();

    return from(authReq).pipe(
      mergeMap(() => this.api.account.updateName(name)),
      concatMap(() => this.api.account.get()),
      tap((user) => this._user.next(user))
    );
  }
  */

  // NOT USED ANYMORE
  /*
  async isLoggedIn() {
    try {
      const user = await this.api.account.get();
      this._user.next(user);
      return true;
    } catch (e) {
      this._user.next(null);
      console.log('there is no user while checking isLoggedIn:');
      return false;
    }
  }
  */
}
