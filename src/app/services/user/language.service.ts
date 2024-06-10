import { Injectable } from '@angular/core';
import { Observable, from, switchMap } from 'rxjs';
import { Store, select } from '@ngrx/store';
import axios from 'axios';

// Service and env Imports
import { environment } from 'src/environments/environment';
import { ApiService } from 'src/app/services/api/api.service';
import { UserService } from 'src/app/services/user/user.service';
import { AuthService } from 'src/app/services/auth/auth.service';

// Interface Imports
import { User } from 'src/app/models/User';
import { Language } from 'src/app/models/Language';
import { createLanguageRequestInterface } from 'src/app/models/types/requests/createLanguageRequest.interface';
import { deleteLanguageRequestInterface } from 'src/app/models/types/requests/deleteLanguageRequest.interface';
import { updateLanguageRequestInterface } from 'src/app/models/types/requests/updateLanguageRequest.interface';

// Selector Imports
import { currentUserSelector } from 'src/app/store/selectors/auth.selector';

@Injectable({
  providedIn: 'root',
})
export class LanguageService {
  constructor(
    private store: Store,
    private api: ApiService,
    private userService: UserService,
    private authService: AuthService
  ) {}

  createLanguageDoc(
    data: createLanguageRequestInterface
  ): Observable<Language> {
    // Set x-appwrite-user-id header
    this.store
      .pipe(select(currentUserSelector))
      .subscribe((user) => {
        axios.defaults.headers.common['x-appwrite-user-id'] = user.$id;
      })
      .unsubscribe();

    // TODO: #425 🐛 [BUG] : Rate limit for /account/jwt
    // Set x-appwrite-jwt header
    return from(
      this.authService.createJWT().then((result) => {
        // console.log('result: ', result);
        axios.defaults.headers.common['x-appwrite-jwt'] = result?.jwt;
      })
    ).pipe(
      switchMap(() => {
        // Call the /api/language
        return from(
          axios.post(environment.api.LANGUAGE, data).then((result) => {
            console.log('result.data: ', result.data);
            return result.data as Language;
          })
        );
      })
    );
  }

  updateLanguageDoc(
    request: updateLanguageRequestInterface
  ): Observable<Language> {
    // Set x-appwrite-user-id header
    this.store
      .pipe(select(currentUserSelector))
      .subscribe((user) => {
        axios.defaults.headers.common['x-appwrite-user-id'] = user.$id;
      })
      .unsubscribe();

    // TODO: #425 🐛 [BUG] : Rate limit for /account/jwt
    // Set x-appwrite-jwt header
    return from(
      this.authService.createJWT().then((result) => {
        // console.log('result: ', result);
        axios.defaults.headers.common['x-appwrite-jwt'] = result?.jwt;
      })
    ).pipe(
      switchMap(() => {
        // Call the /api/language
        return from(
          axios
            .patch(`${environment.api.LANGUAGE}/${request.id}`, request.data)
            .then((result) => {
              console.log('result.data: ', result.data);
              return result.data as Language;
            })
        );
      })
    );
  }

  // It is triggerred by edit.page.ts
  createLanguageDocWithUpdatingLanguageArray(
    data: createLanguageRequestInterface,
    languageArray: string[]
  ): Observable<User> {
    return from(this.createLanguageDoc(data)).pipe(
      switchMap((payload: Language) => {
        const newLanguageArray = {
          languageArray: [...languageArray, payload.name],
        };
        return this.userService.updateUserDoc(newLanguageArray);
      })
    );
  }

  // It is triggerred by edit.page.ts
  deleteLanguageDocWithUpdatingLanguageArray(
    request: deleteLanguageRequestInterface
  ): Observable<User> {
    return from(
      this.api.deleteDocument(
        environment.appwrite.LANGUAGES_COLLECTION,
        request.id
      )
    ).pipe(
      switchMap(() => {
        const newLanguageArray = {
          languageArray: request.languageArray.filter(
            (language) => language !== request.name
          ),
        };
        return this.userService.updateUserDoc(newLanguageArray);
      })
    );
  }
}
