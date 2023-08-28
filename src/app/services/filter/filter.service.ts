import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface isFilter {
  isLanguage: boolean;
  isGender: boolean;
  isCountry: boolean;
  isAge: boolean;
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