import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { StorageService } from '../storage/storage.service';

@Injectable({
  providedIn: 'root'
})
export class FilterResolverService{

  constructor(
    private storageService: StorageService
  ) { }

  resolve(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    let filterData = this.storageService.get('filterData');
    console.log('(resolver in ) filterData: ', filterData);
    //return filterData;
    return filterData;
  }
}