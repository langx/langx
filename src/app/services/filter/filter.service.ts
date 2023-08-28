import { Injectable } from '@angular/core';
import { BehaviorSubject, filter } from 'rxjs';

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

  constructor() { }

  getEvent(): BehaviorSubject<isFilter> {
      return this.isFilterTracker;
  }

  setEvent(param: isFilter): void {
      this.isFilterTracker.next(param);
  }

}