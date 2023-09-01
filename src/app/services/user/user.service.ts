import { Injectable } from '@angular/core';
// TODO: Next line may be moved to api.service.ts
import { query, QuerySnapshot, Query } from '@angular/fire/firestore';
import { getAge } from 'src/app/extras/utils';
import { ApiService } from '../api/api.service';
import { ChatService } from '../chat/chat.service';
import { FilterData } from '../filter/filter.service';
@Injectable({
  providedIn: 'root'
})
export class UserService {

  NUMBER_OF_USERS_PER_PAGE = 5;

  lastVisible: any;

  constructor(
    private chatService: ChatService,
    private api: ApiService
  ) {}

  //
  // Get User Methods
  //

  async getUsers(filterData?: FilterData) {
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

    querySnapshot.docs.map(doc => doc.data()).filter(user => user.uid !== this.chatService.currentUserId)
      .map( user => { users.push(user); });

    // TODO: Its working infinitely but it has to be fixed
    // Sometimes it returns null and it breaks the one of loadMore() event
    // It also may stay in infinite loop if it returns null
    let last = querySnapshot.docs[querySnapshot.docs.length-1];
    this.lastVisible = last || null;

    if(filterData?.minAge && filterData?.maxAge) {
      return this.filterUsersByAge(users, filterData.minAge, filterData.maxAge);
    }

    console.log('lastVisible: ', this.lastVisible, 'users.length: ', users.length, 'users: ', users);
    return users;
  }

  filterUsersByAge(users: any[], minAge: number, maxAge: number) {
    return users.filter(user => {
      const age = getAge(user.birthdate.toDate());
      return age >= minAge && age <= maxAge;
    });
  }

  refreshUsers() {
    this.lastVisible = null;
  }

}