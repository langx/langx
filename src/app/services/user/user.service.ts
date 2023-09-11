import { Injectable } from '@angular/core';
// TODO: Next line may be moved to api.service.ts
import { query, QuerySnapshot, Query } from '@angular/fire/firestore';
import { getAge } from 'src/app/extras/utils';
import { ApiService } from '../api/api.service';
import { FilterData } from '../filter/filter.service';
import { AuthService } from '../auth/auth.service';
@Injectable({
  providedIn: 'root',
})
export class UserService {
  NUMBER_OF_USERS_PER_PAGE = 10;

  lastVisible: any;

  constructor(private authService: AuthService, private api: ApiService) {}

  async getUsers(filterData?: FilterData) {
    const users: any[] = [];

    let usersQuery: Query = query(this.api.collectionRef('users'));

    if (filterData?.country) {
      usersQuery = query(
        usersQuery,
        this.api.whereQuery('country.code', '==', filterData.country)
      );
    }

    if (filterData?.gender) {
      usersQuery = query(
        usersQuery,
        this.api.whereQuery('gender', '==', filterData.gender)
      );
    }

    if (filterData?.languages.length > 0) {
      usersQuery = query(
        usersQuery,
        this.api.whereQuery(
          'languagesArray',
          'array-contains-any',
          filterData.languages
        )
      );
    }

    usersQuery = query(usersQuery, this.api.orderByQuery('lastSeen', 'desc'));

    if (this.lastVisible) {
      usersQuery = query(
        usersQuery,
        this.api.startAfterQuery(this.lastVisible)
      );
    }

    usersQuery = query(
      usersQuery,
      this.api.limitQuery(this.NUMBER_OF_USERS_PER_PAGE)
    );
    const querySnapshot: QuerySnapshot<any> = await this.api.getDocs2(
      usersQuery
    );

    querySnapshot.docs
      .map((doc) => doc.data())
      .filter((user) => user.uid !== this.authService.getId())
      .map((user) => {
        users.push(user);
      });

    let last = querySnapshot.docs[querySnapshot.docs.length - 1];
    this.lastVisible = last || null;

    if (filterData?.minAge && filterData?.maxAge) {
      return this.filterUsersByAge(users, filterData.minAge, filterData.maxAge);
    }

    console.log(
      'lastVisible: ',
      this.lastVisible,
      'users.length: ',
      users.length,
      'users: ',
      users
    );
    return users;
  }

  filterUsersByAge(users: any[], minAge: number, maxAge: number) {
    return users.filter((user) => {
      const age = getAge(user.birthdate.toDate());
      return age >= minAge && age <= maxAge;
    });
  }

  refreshUsers() {
    this.lastVisible = null;
  }
}
