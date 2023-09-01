import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from '../auth/auth.service';

export interface FilterData {
  languages: Array<string>;
  gender: string;
  country: string;
  minAge: Number;
  maxAge: Number;
}

@Injectable({
  providedIn: 'root'
})
export class FilterService {

  private isFilterTracker = new BehaviorSubject<FilterData>(null);

  constructor(
    private authService: AuthService
  ) { }

  getEvent(): BehaviorSubject<FilterData> {
    return this.isFilterTracker;
  }

  setEvent(filterData: FilterData): void {
    this.isFilterTracker.next(filterData);

  }

  /*
  saveFilter(filterData: isFilter): void {
    //Set User Filter to Firestore
    if(filterData.isFilterAge || filterData.isFilterCountry || filterData.isFilterGender || filterData.isFilterLanguage ) {
        this.authService.updateUserFilter(true, filterData);
    } else {
      this.authService.updateUserFilter(false);
    }
  }
  */

}