import { Injectable } from '@angular/core';
import { AppwriteService } from '../appwrite/appwrite.service';
import { Models } from 'appwrite';
import { BehaviorSubject, concatMap, from, mergeMap, tap } from 'rxjs';

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

    return from(authReq).pipe(
      concatMap(() => this.appwrite.account.get()),
      tap((user) => this._user.next(user))
    );
  }

  // TODO: Test needed to work or not
  anonLogin(name: string) {
    const authReq = this.appwrite.account.createAnonymousSession();

    return from(authReq).pipe(
      mergeMap(() => this.appwrite.account.updateName(name)),
      concatMap(() => this.appwrite.account.get()),
      tap((user) => this._user.next(user))
    );
  }

  // TODO: Test needed to work or not
  async isLoggedIn() {
    try {
      const user = await this.appwrite.account.get();
      this._user.next(user);
      return true;
    } catch (e) {
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
