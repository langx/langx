import { Injectable } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { Observable, map, of, switchMap } from 'rxjs';
import { ApiService } from '../api/api.service';

@Injectable({
  providedIn: 'root'
})
export class ChatService {

  currentUserId: string;
  public users: Observable<any>;
  public chatRooms: Observable<any>;

  constructor(
    public auth: AuthService,
    public api: ApiService
  ) { 
    this.getId();
  }

  getId() {
    this.currentUserId = this.auth.getId()
  }

  getUsers() {
    this.users = this.api.collectionDataQuery(
      'users',
      this.api.whereQuery('uid', '!=', this.currentUserId)
    )
  }

  async createChatRoom(user_id) {
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
    this.chatRooms = this.api.collectionDataQuery(
      'chatRooms',
      this.api.whereQuery('members', 'array-contains', this.currentUserId)
    ).pipe(
      map((data: any[]) => {
        console.log('room data: ', data);
        data.map((el) => {
          const user_data = el.members.filter(x => x != this.currentUserId);
          //console.log(user_data);
          const user = this.api.docDataQuery(`users/${user_data[0]}`, true);
          el.user = user;
          console.log(user);
        });
        return data;
      }), switchMap(data => {
        return of(data);
      })
    );
  }

}