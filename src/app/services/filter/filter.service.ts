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

  // TODO: No need to save DB with following line, try to do in in localStorage
  // Set User Filter to Firestore
  // saveFilter(filterData: FilterData): void {
  //   this.authService.updateUserFilter(filterData);
  // }

}