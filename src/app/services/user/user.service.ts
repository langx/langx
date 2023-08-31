import { Injectable } from '@angular/core';
import { Firestore, collection, query, where, getDocs, QuerySnapshot, Query, orderBy } from '@angular/fire/firestore';
import { getAge } from 'src/app/extras/utils';
import { ApiService } from '../api/api.service';
@Injectable({
  providedIn: 'root'
})
export class UserService {

  constructor(
    private firestore: Firestore,
    private api: ApiService
  ) {}

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

  async getUsers() {
    return await this.api.getDocs(
      "users",
      this.api.orderByQuery("lastSeen", "desc"),
      this.api.limitQuery(3)
    )
  }

  // async getMoreUsers(lastItem) {
  //   return await this.api.getDocs(
  //     "users",
  //     this.api.orderByQuery("lastSeen", "desc"),
  //     this.api.startAfterQuery(lastItem),
  //     this.api.limitQuery(5)
  //   )
  // }

  //
  // Get User With Filter Methods
  //

  async getUsersWithFilter(queryFn) {
    return await this.api.getDocs(
      "users",
      queryFn,
      this.api.orderByQuery("lastSeen", "desc"),
      this.api.limitQuery(3)
    )
  }

  // TODO: its still not used in community page
  // async getMoreUsersWithFilter(lastItem, queryFn) {
  //   return await this.api.getDocs(
  //     "users",
  //     queryFn,
  //     this.api.orderByQuery("lastSeen", "desc"),
  //     this.api.startAfterQuery(lastItem),
  //     this.api.limitQuery(10)
  //   )
  // }

  //
  // Chat Room Methods
  //

}
