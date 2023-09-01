import { Injectable } from '@angular/core';
import { Firestore, collection, query, where, getDocs, QuerySnapshot, Query, orderBy } from '@angular/fire/firestore';
import { getAge } from 'src/app/extras/utils';
import { ApiService } from '../api/api.service';
import { ChatService } from '../chat/chat.service';
import { FilterData } from '../filter/filter.service';
@Injectable({
  providedIn: 'root'
})
export class UserService {

  NUMBER_OF_USERS_PER_PAGE = 4;

  lastVisible: any;

  constructor(
    private firestore: Firestore,
    private chatService: ChatService,
    private api: ApiService
  ) {}

  // TODO: delete here it was just test
  // TODO: check age filter as well as other filters
  async getUsersWithFilters(gender: string, country: string, languages: string[], minAge: number, maxAge: number): Promise<any[]> {
    const usersCollectionRef = collection(this.firestore, 'users');

    let usersQuery: Query = query(usersCollectionRef);

    if (gender) {
      usersQuery = query(usersQuery, where('gender', '==', gender));
    }

    if (country) {
      usersQuery = query(usersQuery, where('country.code', '==', country));
    }

    if (languages.length > 0) {
      usersQuery = query(usersQuery, where('languagesArray', 'array-contains-any', languages));
    }

    usersQuery = query(usersQuery, orderBy('lastSeen', 'desc'));

    const querySnapshot: QuerySnapshot<any> = await getDocs(usersQuery);
    const users: any[] = [];

    querySnapshot.forEach(doc => {
        const age = getAge(doc.get("birthdate").toDate());
        console.log('minAge: ', minAge, 'age: ', age, 'maxAge: ', maxAge);
        if (age >= minAge && age <= maxAge) {
          users.push(doc.data());
        }
    });
    
    console.log('users: ', users);
    return users;
  }

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
    console.log('lastVisible: ', this.lastVisible, 'users.length: ', users.length, 'users: ', users);
    return users;
  }

  refreshUsers() {
    this.lastVisible = null;
  }

}