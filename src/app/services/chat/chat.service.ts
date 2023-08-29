import { Injectable } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { Observable, map, of, switchMap } from 'rxjs';
import { ApiService } from '../api/api.service';

@Injectable({
  providedIn: 'root'
})
export class ChatService {

  currentUserId: string;
  public chatRooms: Observable<any>;
  selectedChatRoomMessages: Observable<any[]>;

  constructor(
    public auth: AuthService,
    public api: ApiService
  ) {
      this.getId();
    }

  getId() {
    this.currentUserId = this.auth.getId()
  }

  //
  // Get User Methods
  //

  async getUsers() {
    return await this.api.getDocs(
      "users",
      this.api.orderByQuery("lastSeen", "desc"),
      this.api.limitQuery(10)
    )
  }

  async getMoreUsers(lastItem) {
    return await this.api.getDocs(
      "users",
      this.api.orderByQuery("lastSeen", "desc"),
      this.api.startAfterQuery(lastItem),
      this.api.limitQuery(5)
    )
  }

  //
  // Get User With Filter Methods
  //

  async getUsersWithFilter(queryFn) {
    return await this.api.getDocs(
      "users",
      queryFn,
      this.api.orderByQuery("lastSeen", "desc"),
      this.api.limitQuery(10)
    )
  }

  async getMoreUsersWithFilter(lastItem, queryFn) {
    return await this.api.getDocs(
      "users",
      queryFn,
      this.api.orderByQuery("lastSeen", "desc"),
      this.api.startAfterQuery(lastItem),
      this.api.limitQuery(10)
    )
  }

  //
  // Chat Room Methods
  //

  async createChatRoom(user_id) {
    // get the userId here 
    this.getId();

    try {
      // check for existing chatroom
      let room: any;
      const querySnapshot = await this.api.getDocs(
        'chatRooms',
        this.api.whereQuery(
          'members',
          'in',
          [[user_id, this.currentUserId], [this.currentUserId, user_id]]
        )
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
        members: [
          this.currentUserId,
          user_id
        ],
        type: 'private',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      room = await this.api.addDocument('chatRooms', data);
      return room;

    } catch(e) {
      throw(e);
    }
  }

  getChatRooms() {
    // get the userId here 
    this.getId();

    this.chatRooms = this.api.collectionDataQuery(
      'chatRooms',
      this.api.whereQuery('members', 'array-contains', this.currentUserId),
      this.api.orderByQuery('updatedAt', 'desc')
    ).pipe(
      map((data: any[]) => {
        console.log('room data: ', data);
        data.map((el) => {
          const user_data = el.members.filter(x => x != this.currentUserId);
          //console.log(user_data);
          const user = this.api.docDataQuery(`users/${user_data[0]}`, true);
          el.user = user;
        });
        return data;
      }), switchMap(data => {
        return of(data);
      })
    );
  }

  getChatRoomMessages(chatRoomId: string) {
    this.selectedChatRoomMessages = this.api.collectionDataQuery(
      `chats/${chatRoomId}/messages`,
      this.api.orderByQuery('createdAt', 'desc') 
    ).pipe(
      map((arr: any) => arr.reverse())
    );
  }

  async sendMessage(chatId, msg) {
    console.log(chatId, msg);
    try {
      const new_msg = {
        message: msg,
        sender: this.currentUserId,
        createdAt: new Date()
      };
      if(chatId) {
        await this.api.addDocument(`chats/${chatId}/messages`, new_msg);
      }
    } catch(e) {
      throw(e);
    }
  }

}