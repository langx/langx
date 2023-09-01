import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface FilterData {
  languages: Array<string>;
  gender: string;
  country: string;
  minAge: number;
  maxAge: number;
}

@Injectable({
  providedIn: 'root'
})
export class FilterService {

  private isFilterTracker = new BehaviorSubject<FilterData>(null);

  constructor() { }

  getEvent(): BehaviorSubject<FilterData> {
    return this.isFilterTracker;
  }

  setEvent(filterData: FilterData): void {
    this.isFilterTracker.next(filterData);

  }

}