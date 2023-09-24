import { Injectable } from '@angular/core';
import { AppwriteService } from '../appwrite/appwrite.service';
import { Models } from 'appwrite';
import { BehaviorSubject, concatMap, from, catchError, tap, of } from 'rxjs';
import { error } from 'console';

@Injectable({
  providedIn: 'root',
})
export class Auth2Service {
  private _user = new BehaviorSubject<Models.User<Models.Preferences> | null>(
    null
  );

  constructor(private appwrite: AppwriteService) {}

  login(email: string, password: string) {
    const authReq = this.appwrite.account.createEmailSession(email, password);
    // TODO: Add error handling with toast message
    authReq.then(
      (response) => {
        console.log(response); // Success
      },
      (error) => {
        console.log(error.message);
      }
    );
    return from(authReq).pipe(
      catchError(error => of(error)),
      concatMap(() => this.appwrite.account.get()),
      tap((user) => this._user.next(user))
    );
  }

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

  // TODO: Test needed to work or not
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

  // TODO: Test needed to work or not
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
}
