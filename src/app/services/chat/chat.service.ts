import { Injectable } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { Observable, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { ApiService } from '../api/api.service';
import { Query, query } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  currentUserId: string;
  public chatRooms: Observable<any>;
  selectedChatRoomMessages: Observable<any[]>;

  constructor(public auth: AuthService, public api: ApiService) {
    this.getId();
  }

  getId() {
    this.currentUserId = this.auth.getId();
  }

  async createChatRoom(user_id) {
    // get the userId here
    this.getId();

    try {
      // check for existing chatroom
      let room: any;
      const querySnapshot = await this.api.getDocs(
        'chatRooms',
        this.api.whereQuery('members', 'in', [
          [user_id, this.currentUserId],
          [this.currentUserId, user_id],
        ])
      );

      room = await querySnapshot.docs.map((doc: any) => {
        let item = doc.data();
        item.id = doc.id;
        return item;
      });
      console.log('exist docs: ', room);
      if (room?.length > 0) return room[0];

      // if no existing room, create new one
      const data = {
        members: [this.currentUserId, user_id],
        typingStatus: {
          [this.currentUserId]: false,
          [user_id]: false,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      room = await this.api.addDocument('chatRooms', data);
      return room;
    } catch (e) {
      throw e;
    }
  }

  getChatRooms() {
    // get the userId here
    this.getId();

    this.chatRooms = this.api
      .collectionDataQuery(
        'chatRooms',
        this.api.whereQuery('members', 'array-contains', this.currentUserId),
        this.api.orderByQuery('updatedAt', 'desc')
      )
      .pipe(
        map((data: any[]) => {
          console.log('room data: ', data);
          data.map((el) => {
            const user_data = el.members.filter((x) => x != this.currentUserId);
            //console.log(user_data);
            const user = this.api.docDataQuery(`users/${user_data[0]}`, true);
            el.user = user;
          });
          return data;
        }),
        switchMap((data) => {
          return of(data);
        })
      );
  }

  getChatRoomMessages(chatRoomId: string) {
    this.selectedChatRoomMessages = this.api
      .collectionDataQuery(
        `chats/${chatRoomId}/messages`,
        this.api.orderByQuery('createdAt', 'desc'),
        this.api.limitQuery(20)
      )
      .pipe(
        map((arr: any) => arr.reverse()),
        // only emit when the current value is different than the last
        distinctUntilChanged()
      );
  }

  /*
  async getUsers() {
    const users: any[] = [];

    let usersQuery: Query = query(this.api.collectionRef('users'));

    if(filterData?.country) {
      usersQuery = query(usersQuery, this.api.whereQuery('country.code', '==', filterData.country));
    }

    if(filterData?.gender) {
      usersQuery = query(usersQuery, this.api.whereQuery('gender', '==', filterData.gender));
    }

    if(filterData?.languages.length > 0) {
      usersQuery = query(usersQuery, this.api.whereQuery('languagesArray', 'array-contains-any', filterData.languages));
    }

    usersQuery = query(usersQuery, this.api.orderByQuery('lastSeen', 'desc'));

    if (this.lastVisible) {
      usersQuery = query(usersQuery, this.api.startAfterQuery(this.lastVisible));
    }
    
    usersQuery = query(usersQuery, this.api.limitQuery(this.NUMBER_OF_USERS_PER_PAGE));
    const querySnapshot: QuerySnapshot<any> = await this.api.getDocs2(usersQuery);

    querySnapshot.docs.map(doc => doc.data()).filter(user => user.uid !== this.authService.getId())
      .map( user => { users.push(user); });

    let last = querySnapshot.docs[querySnapshot.docs.length-1];
    this.lastVisible = last || null;

    if(filterData?.minAge && filterData?.maxAge) {
      return this.filterUsersByAge(users, filterData.minAge, filterData.maxAge);
    }

    console.log('lastVisible: ', this.lastVisible, 'users.length: ', users.length, 'users: ', users);
    return users;
  }
  */

  async sendMessage(chatId, msg) {
    console.log(chatId, msg);
    try {
      const new_msg = {
        message: msg,
        sender: this.currentUserId,
        createdAt: new Date(),
      };
      if (chatId) {
        await this.api.addDocument(`chats/${chatId}/messages`, new_msg);
      }
    } catch (e) {
      throw e;
    }
  }
}
