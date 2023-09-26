import { Injectable } from '@angular/core';
import { getAge } from 'src/app/extras/utils';
import { FilterData } from '../filter/filter.service';
import { AppwriteService } from '../appwrite/appwrite.service';
import { environment } from 'src/environments/environment';
import { Query } from 'appwrite';
import { Auth2Service } from '../auth/auth2.service';
@Injectable({
  providedIn: 'root',
})
export class UserService {
  NUMBER_OF_USERS_PER_PAGE = 10;

  lastVisible: any;

  constructor(
    private appwrite: AppwriteService,
    private auth2Service: Auth2Service
  ) {}

  getUserDoc(uid: string): Promise<any> {
    return this.appwrite.getDocument(
      environment.appwrite.USERS_COLLECTION,
      uid
    );
  }

  createUserDoc(uid: string, data: any): Promise<any> {
    return this.appwrite.createDocument(
      environment.appwrite.USERS_COLLECTION,
      uid,
      data
    );
  }

  updateUserDoc(uid: string, data: any): Promise<any> {
    return this.appwrite.updateDocument(
      environment.appwrite.USERS_COLLECTION,
      uid,
      data
    );
  }

  listUsers(filterData?: FilterData): Promise<any> {
    // TODO: Use filter data
    return this.appwrite.listDocuments(environment.appwrite.USERS_COLLECTION, [
      Query.notEqual('$id', this.auth2Service.getUserId()),
    ]);
  }

  /* // ORIGINAL CODE
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
  */

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
