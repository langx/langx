import { Injectable } from '@angular/core';
import { ID } from 'appwrite';
import { Observable, from, switchMap } from 'rxjs';

// Service and env Imports
import { environment } from 'src/environments/environment';
import { ApiService } from 'src/app/services/api/api.service';
import { UserService } from 'src/app/services/user/user.service';

// Interface Imports
import { User } from 'src/app/models/User';
import { Language } from 'src/app/models/Language';
import { createLanguageRequestInterface } from 'src/app/models/types/requests/createLanguageRequest.interface';
import { deleteLanguageRequestInterface } from 'src/app/models/types/requests/deleteLanguageRequest.interface';
import { updateLanguageRequestInterface } from 'src/app/models/types/requests/updateLanguageRequest.interface';

@Injectable({
  providedIn: 'root',
})
export class LanguageService {
  constructor(private api: ApiService, private userService: UserService) {}

  createLanguageDoc(data: any): Observable<any> {
    return from(
      this.api.createDocument(
        environment.appwrite.LANGUAGES_COLLECTION,
        ID.unique(),
        data
      )
    );
  }

  updateLanguageDoc(
    request: updateLanguageRequestInterface
  ): Observable<Language> {
    return from(
      this.api.updateDocument(
        environment.appwrite.LANGUAGES_COLLECTION,
        request.id,
        request.data
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
          languageArray: [...languageArray, payload.name],
        };
        return this.userService.updateUserDoc2(data.userId, newLanguageArray);
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
        request.$id
      )
    ).pipe(
      switchMap(() => {
        const newLanguageArray = {
          languageArray: request.languageArray.filter(
            (language) => language !== request.name
          ),
        };
        return this.userService.updateUserDoc2(
          request.userId,
          newLanguageArray
        );
      })
    );
  }
}
