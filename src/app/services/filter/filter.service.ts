import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FilterService {

  private filterTracker = new BehaviorSubject<any>(undefined);

  constructor() { }

  getEvent(): BehaviorSubject<any> {
      return this.filterTracker;
  }

  setEvent(param: any): void {
      this.filterTracker.next(param);
  }
}