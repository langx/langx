import { Injectable } from '@angular/core';
import { Query } from 'appwrite';
import { BehaviorSubject, Observable, from, switchMap, tap } from 'rxjs';
import axios from 'axios';

// Environment and Services Imports
import { ApiService } from 'src/app/services/api/api.service';
import { environment } from 'src/environments/environment';
import { AuthService } from 'src/app/services/auth/auth.service';

// Interface Imports
import { Message } from 'src/app/models/Message';
import { listMessagesResponseInterface } from 'src/app/models/types/responses/listMessagesResponse.interface';
import { createMessageRequestInterface } from 'src/app/models/types/requests/createMessageRequest.interface';

@Injectable({
  providedIn: 'root',
})
export class MessageService {
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
        // console.log('result: ', result);
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

  // Update Message
  updateMessage(message: Message): Observable<Message> {
    return from(
      this.api.updateDocument(
        environment.appwrite.MESSAGES_COLLECTION,
        message.$id,
        {
          seen: message.seen,
        }
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
}
