import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from '../auth/auth.service';

export interface isFilter {
  isFilterLanguage: boolean;
  isFilterGender: boolean;
  isFilterCountry: boolean;
  isFilterAge: boolean;
  filterLanguage: Array<any>;
  filterGender: string;
  filterCountry: string;
  filterAge: Object;
}

@Injectable({
  providedIn: 'root'
})
export class FilterService {

  private isFilterTracker = new BehaviorSubject<isFilter>(null);

  constructor(
    private authService: AuthService
  ) { }

  getEvent(): BehaviorSubject<isFilter> {
    this.authService.getUserData().then((currentUserData) => {
      this.isFilterTracker.next(currentUserData?.filter);
    }).catch((error) => {
      console.log('error: ', error);
    });
    return this.isFilterTracker;
  }

  setEvent(filterData: isFilter): void {
    this.isFilterTracker.next(filterData);

    //Set User Filter to Firestore
    if(filterData.isFilterAge || filterData.isFilterCountry || filterData.isFilterGender || filterData.isFilterLanguage ) {
        this.authService.updateUserFilter(true, filterData);
    } else {
      this.authService.updateUserFilter(false);
    }
  }

}