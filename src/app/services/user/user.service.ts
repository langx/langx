import { Injectable } from '@angular/core';
import { Firestore, collection, query, where, getDocs, QuerySnapshot, Query, orderBy } from '@angular/fire/firestore';
import { getBirthdate } from 'src/app/extras/utils';
@Injectable({
  providedIn: 'root'
})
export class UserService {

  constructor(
    private firestore: Firestore
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

    if (languages) {
      usersQuery = query(usersQuery, where('languagesArray', 'array-contains-any', languages));
    }

    // TODO: Make a birthdate filtering locally
    if (minAge) {
      const birthdate = getBirthdate(minAge);
      console.log('birthdate: ', birthdate);
      //usersQuery = query(usersQuery, where('birthdate', '<=', birthdate));
    }

    if (maxAge) {
      const birthdate = getBirthdate(maxAge);
      console.log('birthdate: ', birthdate);
      //usersQuery = query(usersQuery, where('birthdate', '>=', birthdate));
    }
    //usersQuery = query(usersQuery, orderBy('birthdate', 'desc'));
    usersQuery = query(usersQuery, orderBy('lastSeen', 'desc'));

    const querySnapshot: QuerySnapshot<any> = await getDocs(usersQuery);
    const users: any[] = [];

    querySnapshot.forEach(doc => {
      users.push(doc.data());
    });
    
    console.log('users: ', users);

    return users;
  }
}
