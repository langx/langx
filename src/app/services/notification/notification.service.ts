import { Injectable } from '@angular/core';
import { Store, select } from '@ngrx/store';
import { Observable, from } from 'rxjs';

// Environment and services Imports
import { environment } from 'src/environments/environment';
import { ApiService } from 'src/app/services/api/api.service';
import { UserService } from '../user/user.service';

// Interface Imports
import { User } from 'src/app/models/User';
import { Room } from 'src/app/models/Room';
import { Copilot } from 'src/app/models/Copilot';
import { MessageExtendedInterface } from 'src/app/models/types/messageExtended.interface';

// Selector Imports
import { currentUserSelector } from 'src/app/store/selectors/auth.selector';

// Action Imports
import {
  findRoomAndAddMessageAction,
  findActiveRoomAndAddMessageAction,
  findAndUpdateRoomUpdatedAtAction,
  findAndUpdateActiveRoomUpdatedAtAction,
  findActiveRoomAndUpdateMessageAction,
  findOrAddRoomAction,
  totalUnseenMessagesAction,
  findRoomAndUpdateMessageAction,
  findRoomAndDeleteMessageAction,
  findActiveRoomAndDeleteMessageAction,
} from 'src/app/store/actions/notification.action';
import { attachCopilotAction } from 'src/app/store/actions/message.action';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  constructor(
    private store: Store,
    private api: ApiService,
    private userService: UserService
  ) {}

  connect() {
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
    const copilotCollection =
      'databases.' +
      environment.appwrite.APP_DATABASE +
      '.collections.' +
      environment.appwrite.COPILOT_COLLECTION +
      '.documents';

    // add channels to array
    channels.push(roomsCollection);
    channels.push(messagesCollection);
    channels.push(copilotCollection);

    const client = this.api.client$();
    return client.subscribe(channels, (response) => {
      // console.log('Notification Service started');
      // check if the response is a new message
      response.events.forEach((event) => {
        switch (event) {
          case `${messagesCollection}.*.create`:
            // console.log('[NOTIFICATION] message created', response.payload);
            const createdMessage = response.payload as MessageExtendedInterface;
            this.store.dispatch(
              findRoomAndAddMessageAction({ payload: createdMessage })
            );
            this.store.dispatch(
              findActiveRoomAndAddMessageAction({ payload: createdMessage })
            );
            break;
          case `${messagesCollection}.*.update`:
            // console.log('[NOTIFICATION] message updated', response.payload);
            const updatedMessage = response.payload as MessageExtendedInterface;
            this.store.dispatch(
              findRoomAndUpdateMessageAction({
                payload: updatedMessage,
              })
            );
            this.store.dispatch(
              findActiveRoomAndUpdateMessageAction({
                payload: updatedMessage,
              })
            );
            break;
          case `${messagesCollection}.*.delete`:
            // console.log('[NOTIFICATION] message deleted', response.payload);
            const deletedMessage = response.payload as MessageExtendedInterface;
            this.store.dispatch(
              findRoomAndDeleteMessageAction({
                payload: deletedMessage,
              })
            );
            this.store.dispatch(
              findActiveRoomAndDeleteMessageAction({
                payload: deletedMessage,
              })
            );
            break;
          case `${roomsCollection}.*.create`:
            // console.log('[NOTIFICATION] room created', response.payload);
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
            // console.log('[NOTIFICATION] room updated', response.payload);
            const updatedRoom = response.payload as Room;
            this.store.dispatch(
              findAndUpdateRoomUpdatedAtAction({ payload: updatedRoom })
            );
            this.store.dispatch(
              findAndUpdateActiveRoomUpdatedAtAction({ payload: updatedRoom })
            );
            // Dispatch the badge counter action for tab messages
            this.store.dispatch(totalUnseenMessagesAction());
            break;
          case `${roomsCollection}.*.delete`:
            // console.log('[NOTIFICATION] room deleted', response.payload);
            break;
          case `${copilotCollection}.*.create`:
            // console.log('[NOTIFICATION] copilot created', response.payload);
            const copilot = response.payload as Copilot;
            this.store.dispatch(attachCopilotAction({ payload: copilot }));
            break;
          default:
            break;
        }
      });
    });
  }

  updatePresence(id: string, request: { lastSeen: Date }): Observable<User> {
    return this.userService.updateUserDoc({ lastSeen: request.lastSeen });
  }
}
