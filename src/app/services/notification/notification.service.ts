import { Injectable } from '@angular/core';
import { Store, select } from '@ngrx/store';
import { Observable, from } from 'rxjs';

// Environment and services Imports
import { environment } from 'src/environments/environment';
import { ApiService } from 'src/app/services/api/api.service';

// Interface Imports
import { User } from 'src/app/models/User';
import { Room } from 'src/app/models/Room';
import { MessageExtendedInterface } from 'src/app/models/types/messageExtended.interface';

// Action Imports
import {
  findRoomAndAddMessageAction,
  findActiveRoomAndAddMessageAction,
  findAndUpdateRoomUpdatedAtAction,
  findActiveRoomAndUpdateMessageSeenAction,
  findOrAddRoomAction,
} from 'src/app/store/actions/notification.action';
import { currentUserSelector } from 'src/app/store/selectors/auth.selector';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  listenerFn: Function;

  constructor(private store: Store, private api: ApiService) {}

  listen() {
    let channels = [];

    // channel for rooms
    const roomsCollection =
      'databases.' +
      environment.appwrite.APP_DATABASE +
      '.collections.' +
      environment.appwrite.ROOMS_COLLECTION +
      '.documents';
    // channel for messages
    const messagesCollection =
      'databases.' +
      environment.appwrite.APP_DATABASE +
      '.collections.' +
      environment.appwrite.MESSAGES_COLLECTION +
      '.documents';

    // add channels to array
    channels.push(roomsCollection);
    channels.push(messagesCollection);

    const client = this.api.client$();
    this.listenerFn = client.subscribe(channels, (response) => {
      // check if the response is a new message
      response.events.forEach((event) => {
        switch (event) {
          case `${messagesCollection}.*.create`:
            console.log('[NOTIFICATION] message created', response.payload);
            const createdMessage = response.payload as MessageExtendedInterface;
            this.store.dispatch(
              findRoomAndAddMessageAction({ payload: createdMessage })
            );
            this.store.dispatch(
              findActiveRoomAndAddMessageAction({ payload: createdMessage })
            );
            break;
          case `${messagesCollection}.*.update`:
            console.log('[NOTIFICATION] message updated', response.payload);
            const updatedMessage = response.payload as MessageExtendedInterface;
            this.store.dispatch(
              findActiveRoomAndUpdateMessageSeenAction({
                payload: updatedMessage,
              })
            );
            break;
          case `${messagesCollection}.*.delete`:
            console.log('[NOTIFICATION] message deleted', response.payload);
            break;
          case `${roomsCollection}.*.create`:
            console.log('[NOTIFICATION] room created', response.payload);
            const createdRoom = response.payload as Room;

            this.store
              .pipe(select(currentUserSelector))
              .subscribe((user) => {
                this.store.dispatch(
                  findOrAddRoomAction({
                    payload: createdRoom,
                    currentUserId: user.$id,
                  })
                );
              })
              .unsubscribe();
            break;
          case `${roomsCollection}.*.update`:
            console.log('[NOTIFICATION] room updated', response.payload);
            const updatedRoom = response.payload as Room;
            this.store.dispatch(
              findAndUpdateRoomUpdatedAtAction({ payload: updatedRoom })
            );
            break;
          case `${roomsCollection}.*.delete`:
            console.log('[NOTIFICATION] room deleted', response.payload);
            break;
          default:
            break;
        }
      });
    });
    return this.listenerFn;
  }

  unsubscribe() {
    if (this.listenerFn) {
      this.listenerFn();
    }
  }

  updatePresence(
    currentUserId: string,
    request: { lastSeen: Date }
  ): Observable<User> {
    return from(
      this.api.updateDocument(
        environment.appwrite.USERS_COLLECTION,
        currentUserId,
        {
          lastSeen: request.lastSeen,
        }
      )
    );
  }
}
