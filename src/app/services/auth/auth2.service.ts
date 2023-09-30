import { Injectable } from '@angular/core';
import { AppwriteService } from '../appwrite/appwrite.service';
import { ID, Models } from 'appwrite';
import { BehaviorSubject, concatMap, from, catchError, tap, of } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class Auth2Service {
  private _user = new BehaviorSubject<Models.User<Models.Preferences> | null>(
    null
  );

  constructor(private appwrite: AppwriteService) {}

  //
  // USER DATA
  //

  getUser() {
    return this._user.asObservable();
  }

  getUserId() {
    return this._user.value?.$id;
  }

  //
  // ACCOUNT API
  //

  login(email: string, password: string) {
    const authReq = this.appwrite.account.createEmailSession(email, password);
    // TODO: Add error handling with toast message
    return from(authReq).pipe(
      catchError((error) => of(error)),
      concatMap(() => this.appwrite.account.get()),
      tap((user) => this._user.next(user))
    );
  }

  register(email: string, password: string, name: string) {
    const authReq = this.appwrite.account.create(
      ID.unique(),
      email,
      password,
      name
    );
    // TODO: Add error handling with toast message

    return from(authReq).pipe(
      concatMap(() =>
        this.appwrite.account.createEmailSession(email, password)
      ),
      concatMap(() => this.appwrite.account.get()),
      tap((user) => {
        return this._user.next(user);
      })
    );
  }

  updatePrefs(prefs: Models.Preferences) {
    const authReq = this.appwrite.account.updatePrefs(prefs);
    return from(authReq).pipe(
      concatMap(() => this.appwrite.account.get()),
      tap((user) => this._user.next(user))
    );
  }

  getPrefs() {
    const authReq = this.appwrite.account.getPrefs();
    return from(authReq);
  }

  async isLoggedIn() {
    try {
      const user = await this.appwrite.account.get();
      this._user.next(user);
      return true;
    } catch (e) {
      this._user.next(null);
      console.error('Error while checking if user is logged in:', e);
      return false;
    }
  }

  async logout() {
    try {
      await this.appwrite.account.deleteSession('current');
    } catch (e) {
      console.log(`${e}`);
    } finally {
      // this.router.navigate(['/']);
      this._user.next(null);
    }
  }

  // TODO: #149 Login with Google (createOAuth2Session)
  async signInWithGoogle() {
    console.log('signInWithGoogle');
    this.appwrite.account.createOAuth2Session(
      'google',
      //environment.url.SIGNUP_COMPLETE_URL,
      environment.url.LOGIN_URL,
      environment.url.LOGIN_URL
    );
    const session = await this.appwrite.account.getSession('current');

    // Provider information
    console.log(session.provider);
    console.log(session.providerUid);
    console.log(session.providerAccessToken);
  }

  resetPassword(email: string) {
    console.log('resetPassword:', email);
    return this.appwrite.account
      .createRecovery(email, environment.url.RESET_PASSWORD_URL)
      .then((response) => {
        console.log('Recovery email sent', response);
      })
      .catch((error) => {
        console.log('Error sending recovery email', error);
      });
  }

  updateRecovery(userId: string, secret: string, password: string) {
    return this.appwrite.account
      .updateRecovery(userId, secret, password, password)
      .then((response) => {
        console.log('Recovery successfully updated', response);
      })
      .catch((error) => {
        console.log('Error updating recovery', error);
        return error;
      });
  }

  // TODO: #144 Replace Auth2.Service with Auth.Service
  // TODO: Replace appwrite.service with api.service

  // OPTIONAL: Login with Magic Link (createMagicSession)

  // Not needed to login anonymously
  /*
  anonLogin(name: string) {
    const authReq = this.appwrite.account.createAnonymousSession();

    return from(authReq).pipe(
      mergeMap(() => this.appwrite.account.updateName(name)),
      concatMap(() => this.appwrite.account.get()),
      tap((user) => this._user.next(user))
    );
  }
  */
}
