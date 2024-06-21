import { Injectable } from '@angular/core';
import { Query } from 'appwrite';
import { Store, select } from '@ngrx/store';
import axios from 'axios';
import {
  Observable,
  catchError,
  forkJoin,
  from,
  iif,
  map,
  of,
  switchMap,
  take,
} from 'rxjs';

import { deletedUser } from 'src/app/extras/deletedUser';

// Environment and Services Imports
import { environment } from 'src/environments/environment';
import { ApiService } from 'src/app/services/api/api.service';
import { AuthService } from 'src/app/services/auth/auth.service';
import { UserService } from 'src/app/services/user/user.service';
import { MessageService } from 'src/app/services/chat/message.service';

// Interface Imports
import { Room } from 'src/app/models/Room';
import { User } from 'src/app/models/User';
import { RoomExtendedInterface } from 'src/app/models/types/roomExtended.interface';
import { listRoomsResponseInterface } from 'src/app/models/types/responses/listRoomsResponse.interface';
import { updateRoomRequestInterface } from 'src/app/models/types/requests/updateRoomRequest.interface';

// Selector Imports
import { accountSelector } from 'src/app/store/selectors/auth.selector';

@Injectable({
  providedIn: 'root',
})
export class RoomService {
  constructor(
    private store: Store,
    private api: ApiService,
    private authService: AuthService,
    private userService: UserService,
    private messageService: MessageService
  ) {}

  getRoomById(
    currentUserId: string,
    roomId: string
  ): Observable<listRoomsResponseInterface | null> {
    // Define queries
    const queries: any[] = [];

    // Query for rooms, user attribute that contain current user and userId
    queries.push(Query.equal('$id', roomId));

    return from(
      this.api.listDocuments(environment.appwrite.ROOMS_COLLECTION, queries)
    ).pipe(
      switchMap((data: listRoomsResponseInterface) =>
        iif(
          () => data.total > 0,
          of(data).pipe(
            switchMap(() => this.fillRoomsWithUserData(data, currentUserId)),
            switchMap(() => this.fillRoomsWithMessages(data))
          ),
          of(data)
        )
      )
    );
  }

  getRoom(
    currentUserId: string,
    userId: string
  ): Observable<listRoomsResponseInterface | null> {
    // Define queries
    const queries: any[] = [];

    // Query for rooms, user attribute that contain current user and userId
    queries.push(Query.contains('users', currentUserId));
    queries.push(Query.contains('users', userId));

    return from(
      this.api.listDocuments(environment.appwrite.ROOMS_COLLECTION, queries)
    ).pipe(
      switchMap((data: listRoomsResponseInterface) =>
        iif(
          () => data.total > 0,
          of(data).pipe(
            switchMap(() => this.fillRoomsWithUserData(data, currentUserId)),
            switchMap(() => this.fillRoomsWithMessages(data))
          ),
          of(data)
        )
      )
    );
  }

  createRoom(
    currentUserId: string,
    userId: string
  ): Observable<listRoomsResponseInterface | null> {
    // Set body
    const body = { to: userId };

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
        // Call the /api/room
        return from(
          axios.post(environment.api.ROOM, body).then((result) => {
            return {
              documents: [result.data],
              total: 1,
            };
          })
        ).pipe(
          switchMap((data: listRoomsResponseInterface) =>
            iif(
              () => data.total > 0,
              of(data).pipe(
                switchMap(() =>
                  this.fillRoomsWithUserData(data, currentUserId)
                ),
                switchMap(() => this.fillRoomsWithMessages(data))
              ),
              of(data)
            )
          )
        );
      })
    );
  }

  extendRoom(
    room: Room,
    currentUserId: string
  ): Observable<RoomExtendedInterface> {
    return of(room).pipe(
      switchMap((data: Room) => {
        return this.fillRoomWithUserData(data, currentUserId).pipe(
          switchMap((roomWithUserData) =>
            this.fillRoomWithMessages(roomWithUserData)
          )
        );
      })
    );
  }

  // Update the room with the new data
  updateRoom(
    request: updateRoomRequestInterface
  ): Observable<RoomExtendedInterface> {
    // Set x-appwrite-user-id header
    this.store.pipe(select(accountSelector), take(1)).subscribe((account) => {
      axios.defaults.headers.common['x-appwrite-user-id'] = account.$id;
    });
    // Set x-appwrite-jwt header
    return from(
      this.authService.createJWT().then((result) => {
        axios.defaults.headers.common['x-appwrite-jwt'] = result?.jwt;
      })
    ).pipe(
      switchMap(() => {
        // Call the /api/room
        return from(
          axios
            .put(`${environment.api.ROOM}/${request?.roomId}`, request.data)
            .then((result) => {
              // console.log('result.data: ', result.data);
              return result.data;
            })
        );
      })
    );
  }

  listRooms(
    currentUser: User,
    options?: { archived?: boolean; offset?: number }
  ): Observable<listRoomsResponseInterface> {
    // Define queries
    const queries: any[] = [];

    // Query for rooms that contain the current user
    queries.push(Query.contains('users', currentUser.$id));

    // Query for archived rooms if needed
    if (options?.archived) {
      queries.push(Query.contains('archived', currentUser.$id));
    }

    // Query for rooms descending by $updatedAt
    queries.push(Query.orderDesc('$updatedAt'));

    // TODO: #340 Query for users that are not blocked by the current user
    // if (currentUser?.blockedUsers) {
    //   currentUser.blockedUsers.forEach((id) => {
    //     queries.push(Query.notEqual('users', id));
    //   });
    // }

    // Limit and offset
    queries.push(Query.limit(environment.opts.PAGINATION_LIMIT));
    if (options?.offset) queries.push(Query.offset(options?.offset));

    return from(
      this.api.listDocuments(environment.appwrite.ROOMS_COLLECTION, queries)
    ).pipe(
      switchMap((data) =>
        iif(
          () => data.total > 0,
          of(data).pipe(
            switchMap(() => this.fillRoomsWithUserData(data, currentUser.$id)),
            switchMap(() => this.fillRoomsWithMessages(data))
          ),
          of(data)
        )
      )
    );
  }

  archiveRoom(currentUser: User, roomId: string): Observable<User> {
    return from(
      this.api.updateDocument(
        environment.appwrite.USERS_COLLECTION,
        currentUser.$id,
        {
          archivedRooms: [...currentUser?.archivedRooms, roomId],
        }
      )
    );
  }

  unArchiveRoom(currentUser: User, roomId: string): Observable<User> {
    return from(
      this.api.updateDocument(
        environment.appwrite.USERS_COLLECTION,
        currentUser.$id,
        {
          archivedRooms: currentUser?.archivedRooms.filter(
            (room) => room !== roomId
          ),
        }
      )
    );
  }

  //
  // Utils
  //

  private fillRoomsWithUserData(
    data: listRoomsResponseInterface,
    currentUserId: string
  ): Observable<listRoomsResponseInterface> {
    const roomObservables = data.documents.map((room) =>
      this.fillRoomWithUserData(room, currentUserId)
    );

    return forkJoin(roomObservables).pipe(
      map((rooms) => {
        data.documents = rooms;
        return data;
      })
    );
  }

  private fillRoomWithUserData(
    room: Room,
    currentUserId: string
  ): Observable<RoomExtendedInterface> {
    let userId: string[] | string = room.users.filter(
      (id) => id != currentUserId
    );
    userId = userId[0];
    if (userId === undefined) {
      room['userData'] = null;
      return of(room as RoomExtendedInterface);
    } else {
      return this.userService.getUserDoc(userId).pipe(
        map((data) => {
          const roomWithUserData: RoomExtendedInterface = {
            ...room,
            userData: data as User,
            total: 0,
            messages: null,
          };
          return roomWithUserData;
        }),
        catchError(() =>
          of({
            ...room,
            userData: deletedUser,
            total: 0,
            messages: null,
          })
        )
      );
    }
  }

  private fillRoomsWithMessages(
    data: listRoomsResponseInterface
  ): Observable<listRoomsResponseInterface> {
    const roomObservables = data.documents.map((room) =>
      this.fillRoomWithMessages(room)
    );

    return forkJoin(roomObservables).pipe(
      map((rooms) => {
        data.documents = rooms;
        return data;
      })
    );
  }

  private fillRoomWithMessages(
    room: RoomExtendedInterface
  ): Observable<RoomExtendedInterface> {
    return from(this.messageService.listMessages(room.$id)).pipe(
      map((data) => {
        room['total'] = data.total;
        room['messages'] = data.documents;
        return room as RoomExtendedInterface;
      })
    );
  }
}
