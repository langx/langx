import { Injectable } from '@angular/core';
import { AppwriteService } from '../appwrite/appwrite.service';
import { ID, Models } from 'appwrite';
import { BehaviorSubject, concatMap, from, catchError, tap, of } from 'rxjs';

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

  // TODO: #149 Login with Google (signInWithGoogle)

  // TODO: #150 Reset Password
  resetPassword(email: string) {
    console.log('resetPassword:', email);
    // return this.appwrite.account.createRecovery(email);
  }

  // TODO: #144 Replace Auth2.Service with Auth.Service
  // TODO: #144 Remove Api.Service After above replacement

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
