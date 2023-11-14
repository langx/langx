import { Injectable } from '@angular/core';
import { Query } from 'appwrite';
import { BehaviorSubject, Observable, from, switchMap, tap } from 'rxjs';
import axios from 'axios';

import { ApiService } from 'src/app/services/api/api.service';
import { environment } from 'src/environments/environment';
import { AuthService } from 'src/app/services/auth/auth.service';
import { getMessagesResponseInterface } from 'src/app/models/types/responses/getMessagesResponse.interface';
import { Message } from 'src/app/models/Message';
import { createMessageRequestInterface } from 'src/app/models/types/requests/createMessageRequest.interface';

@Injectable({
  providedIn: 'root',
})
export class MessageService {
  messages: BehaviorSubject<any[]> = new BehaviorSubject<any[]>([]);

  constructor(private api: ApiService, private authService: AuthService) {}

  // Create a message
  createMessage(
    request: createMessageRequestInterface,
    currentUserId: string
  ): Observable<Message | null> {
    // Set x-appwrite-user-id header
    axios.defaults.headers.common['x-appwrite-user-id'] = currentUserId;

    // Set x-appwrite-jwt header
    return from(
      this.authService.createJWT().then((result) => {
        console.log('result: ', result);
        axios.defaults.headers.common['x-appwrite-jwt'] = result?.jwt;
      })
    ).pipe(
      switchMap(() => {
        // Call the /api/message
        return from(
          axios
            .post(environment.url.CREATE_MESSAGE_API_URL, request)
            .then((result) => {
              return result.data as Message;
            })
        );
      })
    );
  }

  // Get messages from a room to initialize the chat
  listMessages(
    roomId: string,
    offset?: number
  ): Observable<getMessagesResponseInterface> {
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
  // TODO: WILL BE DELETED
  //

  /*
  // Create a message
  async createMessage(data: any): Promise<any> {
    // Set x-appwrite-user-id header
    const currentUserId = this.authService.getUserId();
    axios.defaults.headers.common['x-appwrite-user-id'] = currentUserId;

    // Set x-appwrite-jwt header
    await this.authService.createJWT().then((result) => {
      console.log('result: ', result);
      axios.defaults.headers.common['x-appwrite-jwt'] = result?.jwt;
    });

    // Call the /api/message
    return axios
      .post('https://api.languagexchange.net/api/message', data)
      .then((result) => {
        console.log('result: ', result);
        return result.data;
      })
      .catch((error) => {
        return Promise.reject(error);
      });
  }
  */

  // Update messages behavior subject
  updateMessages(message) {
    const currentMessages = this.messages.getValue();

    const existingMessage = currentMessages.find(
      (msg) =>
        msg.sender === message.sender &&
        msg.body === message.body &&
        !msg.$createdAt
    );

    if (existingMessage) {
      // Update the existing message item in the array
      const updatedMessages = currentMessages.map((msg) => {
        if (msg === existingMessage) {
          return { ...msg, $createdAt: message.$createdAt };
        }
        return msg;
      });
      this.messages.next(updatedMessages);
    } else {
      // Add the new message item to the array
      const newMessages = [...currentMessages, message];
      this.messages.next(newMessages);
    }
  }

  // Listen to messages in a room
  listenMessages() {
    console.log('listenMessages started');
    const client = this.api.client$();
    return client.subscribe(
      'databases.' +
        environment.appwrite.APP_DATABASE +
        '.collections.' +
        environment.appwrite.MESSAGES_COLLECTION +
        '.documents',
      (response) => {
        console.log(response);
        this.updateMessages(response.payload);
      }
    );
  }
}
