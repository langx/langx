import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import { FilterDataInterface } from 'src/app/models/types/filterData.interface';

@Injectable({
  providedIn: 'root',
})
export class FilterService {
  private isFilterTracker = new BehaviorSubject<FilterDataInterface>(null);

  constructor() {}

  getEvent(): BehaviorSubject<FilterDataInterface> {
    return this.isFilterTracker;
  }

  setEvent(filterData: FilterDataInterface): void {
    this.isFilterTracker.next(filterData);
  }
}
