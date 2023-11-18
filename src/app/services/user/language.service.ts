import { Injectable } from '@angular/core';
import { ID } from 'appwrite';
import { Observable, from, switchMap } from 'rxjs';

// Service and env Imports
import { environment } from 'src/environments/environment';
import { ApiService } from 'src/app/services/api/api.service';
import { UserService } from 'src/app/services/user/user.service';

// Interface Imports
import { Language } from 'src/app/models/Language';
import { createLanguageRequestInterface } from 'src/app/models/types/requests/createLanguageRequest.interface';
import { User } from 'src/app/models/User';

@Injectable({
  providedIn: 'root',
})
export class LanguageService {
  constructor(private api: ApiService, private userService: UserService) {}

  getLanguageDoc(uid: string): Promise<any> {
    return this.api.getDocument(environment.appwrite.LANGUAGES_COLLECTION, uid);
  }

  createLanguageDoc(data: any): Observable<any> {
    return from(
      this.api.createDocument(
        environment.appwrite.LANGUAGES_COLLECTION,
        ID.unique(),
        data
      )
    );
  }

  // It is triggerred by edit.page.ts
  createLanguageDocWithUpdatingLanguageArray(
    data: createLanguageRequestInterface,
    languageArray: string[]
  ): Observable<User> {
    return from(
      this.api.createDocument(
        environment.appwrite.LANGUAGES_COLLECTION,
        ID.unique(),
        data
      )
    ).pipe(
      switchMap((payload: Language) => {
        const newLanguageArray = {
          languageArray: [...languageArray, payload.code],
        };
        return this.userService.updateUserDoc2(data.userId, newLanguageArray);
      })
    );
  }

  updateLanguageDoc(uid: string, data: any): Observable<Language> {
    return from(
      this.api.updateDocument(
        environment.appwrite.LANGUAGES_COLLECTION,
        uid,
        data
      )
    );
  }

  deleteLanguageDoc(uid: string): Promise<any> {
    return this.api.deleteDocument(
      environment.appwrite.LANGUAGES_COLLECTION,
      uid
    );
  }
}
