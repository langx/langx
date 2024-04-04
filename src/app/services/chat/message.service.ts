import { Injectable } from '@angular/core';
// import { ID, Query } from 'appwrite';
import { ID, Query } from 'src/app/extras/sdk/src';
import { Observable, from, of, switchMap, tap } from 'rxjs';
import { Store, select } from '@ngrx/store';
import axios from 'axios';

// Environment and Services Imports
import { environment } from 'src/environments/environment';
import { ApiService } from 'src/app/services/api/api.service';
import { AuthService } from 'src/app/services/auth/auth.service';
import { StorageService } from '../storage/storage.service';

// Interface Imports
import { Message } from 'src/app/models/Message';
import { BucketFile } from 'src/app/models/BucketFile';
import { listMessagesResponseInterface } from 'src/app/models/types/responses/listMessagesResponse.interface';
import { createMessageRequestInterface } from 'src/app/models/types/requests/createMessageRequest.interface';
import { deleteMessageRequestInterface } from 'src/app/models/types/requests/deleteMessageRequest.interface';

// Selector Imports
import { accountSelector } from 'src/app/store/selectors/auth.selector';

@Injectable({
  providedIn: 'root',
})
export class MessageService {
  constructor(
    private store: Store,
    private api: ApiService,
    private authService: AuthService,
    private storageService: StorageService
  ) {}

  // Get message by id
  getMessageById(messageId: string): Observable<Message | null> {
    return from(
      this.api.getDocument(environment.appwrite.MESSAGES_COLLECTION, messageId)
    );
  }

  // Create a message
  createMessage(
    request: createMessageRequestInterface
  ): Observable<Message | null> {
    // Set x-appwrite-user-id header
    this.store
      .pipe(select(accountSelector))
      .subscribe((account) => {
        axios.defaults.headers.common['x-appwrite-user-id'] = account.$id;
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
        // Call the /api/message
        return from(
          axios.post(environment.api.MESSAGE, request).then((result) => {
            return result.data as Message;
          })
        );
      })
    );
  }

  // Update Message
  updateMessage(request: { id: string; data: any }): Observable<Message> {
    // Set x-appwrite-user-id header
    this.store
      .pipe(select(accountSelector))
      .subscribe((account) => {
        axios.defaults.headers.common['x-appwrite-user-id'] = account.$id;
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
        // Call the /api/message
        return from(
          axios.patch(environment.api.MESSAGE, request).then((result) => {
            return result.data as Message;
          })
        );
      })
    );
  }

  deleteMessage(request: deleteMessageRequestInterface): Observable<Message> {
    return from(
      this.api.deleteDocument(
        environment.appwrite.MESSAGES_COLLECTION,
        request.$id
      )
    );
  }

  // Get messages from a room to initialize the chat
  listMessages(
    roomId: string,
    offset?: number
  ): Observable<listMessagesResponseInterface> {
    // Define queries
    const queries: any[] = [];

    // Query for messages that equal to roomId
    queries.push(Query.equal('roomId', roomId));

    // Query for messages that order by createdAt
    queries.push(Query.orderDesc('$createdAt'));

    // Limit and offset
    queries.push(Query.limit(environment.opts.PAGINATION_LIMIT));
    if (offset) queries.push(Query.offset(offset));

    return from(
      this.api.listDocuments(environment.appwrite.MESSAGES_COLLECTION, queries)
    ).pipe(tap((response) => response.documents.reverse()));
  }

  //
  // Upload Image
  //

  uploadImage(request: File): Observable<URL> {
    return from(
      this.storageService.createFile(
        environment.appwrite.MESSAGE_BUCKET,
        ID.unique(),
        request
      )
    ).pipe(
      switchMap((response: BucketFile) => this.getImageView(response.$id))
    );
  }

  private getImageView(fileId: string): Observable<URL> {
    const url = this.storageService.getFileView(
      environment.appwrite.MESSAGE_BUCKET,
      fileId
    );
    return of(url);
  }

  //
  // Upload Audio
  //

  uploadAudio(request: File): Observable<URL> {
    return from(
      this.storageService.createFile(
        environment.appwrite.AUDIO_BUCKET,
        ID.unique(),
        request
      )
    ).pipe(
      switchMap((response: BucketFile) => this.getAudioView(response.$id))
    );
  }

  private getAudioView(fileId: string): Observable<URL> {
    const url = this.storageService.getFileView(
      environment.appwrite.AUDIO_BUCKET,
      fileId
    );
    return of(url);
  }
}
