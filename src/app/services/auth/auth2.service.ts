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

  login(email: string, password: string) {
    const authReq = this.appwrite.account.createEmailSession(email, password);
    // TODO: Add error handling with yy message
    authReq.then(
      (response) => {
        console.log('login response:', response); // Success
      },
      (error) => {
        console.log(error.message);
      }
    );
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
    // TODO: Add error handling with yy message
    authReq.then(
      (response) => {
        console.log('register response:', response); // Success
      },
      (error) => {
        console.log(error.message);
      }
    );
    return from(authReq).pipe(
      concatMap(() =>
        this.appwrite.account.createEmailSession(email, password)
      ),
      concatMap(() => this.appwrite.account.get()),
      tap((user) => this._user.next(user))
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

  /*
  async register(formValue) {
    try {
      const registeredUser = await createUserWithEmailAndPassword(
        this.fireAuth,
        formValue?.email,
        formValue?.password
      );
      console.log('registredUser:', registeredUser);
      const data = {
        email: formValue?.email,
        name: formValue?.name,
        uid: registeredUser.user.uid,
        photo: 'https://i.pravatar.cc/' + this.randomIntFromInterval(200, 400),
        lastLogin: new Date(),
        lastSeen: new Date(),
        online: true,
        emailVerified: false,
        completeLanguages: false,
        completeProfile: false,
        googleVerified: true,
        languagesArray: [],
        otherPhotos: [],
      };
      await this.apiService.setDocument(
        `users/${registeredUser.user.uid}`,
        data
      );
      const userData = {
        id: registeredUser.user.uid,
      };
      // set user data while registering
      this.setUserData(registeredUser.user.uid);
      this.setCurrentUserData(registeredUser);
      return userData;
    } catch (e) {
      throw e;
    }
  }
  */

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
