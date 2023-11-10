import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Store } from '@ngrx/store';

import { RoomService } from 'src/app/services/chat/room.service';
import { StorageService } from 'src/app/services/storage/storage.service';
import { UserService } from 'src/app/services/user/user.service';
import { getUsersAction } from 'src/app/store/actions/community.action';
import {
  FilterService,
  FilterData,
} from 'src/app/services/filter/filter.service';

@Component({
  selector: 'app-community',
  templateUrl: './community.page.html',
  styleUrls: ['./community.page.scss'],
})
export class CommunityPage implements OnInit {
  filter$: any;
  filterData: FilterData;
  isLoading: boolean = false  ;

  users = [];

  isAllUsersLoaded: boolean = false; // Pagination variable

  constructor(
    private store: Store,
    private router: Router,
    private roomService: RoomService,
    private userService: UserService,
    private filterService: FilterService,
    private storageService: StorageService,
    private toastController: ToastController
  ) {}

  async ngOnInit() {
    await this.checkLocalStorage();
    await this.checkFilter();
  }

  ngOnDestroy() {
    this.filter$.unsubscribe();
    console.log('filters unsubscribed');
  }

  //
  // Get Users
  //

  async getUsers2() {
    this.store.dispatch(getUsersAction());
  }

  async getUsers(filterData?: FilterData) {
    await this.userService.listUsers(filterData).then(
      (response) => {
        console.log(response);
        this.users = response.documents;
      },
      (error) => {
        console.log(error);
      }
    );
  }

  //
  // Check Filter
  //

  async checkFilter() {
    this.filter$ = this.filterService
      .getEvent()
      .subscribe((filterData: FilterData) => {
        this.filterData = filterData;
        console.log('Subscribed filter: ', filterData);
        // Handle Refresh fetch users by using filterData in getUsers()
        this.handleRefresh(null);
      });
  }

  // TODO: Idea: it could be save it account.user.prefs
  async checkLocalStorage() {
    // Getting the filter data from localStorage
    const languagesString = await this.storageService.getValue('languages');
    const gender = (await this.storageService.getValue('gender')) || null;
    const country = (await this.storageService.getValue('country')) || null;
    const minAgeString = await this.storageService.getValue('minAge');
    const maxAgeString = await this.storageService.getValue('maxAge');

    let minAge = Number(minAgeString) || null;
    let maxAge = Number(maxAgeString) || null;

    let languages: Array<any> = [];
    if (languagesString) {
      languages = languagesString.toLocaleString().split(',');
    }

    let filterData: FilterData = {
      languages: languages,
      gender: gender,
      country: country,
      minAge: minAge,
      maxAge: maxAge,
    };

    console.log('checkLocalStorage', filterData);
    this.filterService.setEvent(filterData);
  }

  //
  // Infinite Scroll
  //

  loadMore(event) {
    if (this.isAllUsersLoaded) {
      event.target.complete();
      return;
    }
    // this.getUsers(this.filterData);
    event.target.complete();
    console.log('Async operation loadMore has ended');
  }

  //
  // Start Chat
  //

  async startChat(user: any) {
    let roomId: string;

    await this.roomService.checkRoom(user.$id).then(
      (response) => {
        roomId = response?.$id;
        console.log(response); // Success

        this.router.navigate(['/', 'home', 'chat', roomId]);
      },
      (error) => {
        console.log('error: ', error.message); // Failure
        this.presentToast('Error: ' + error.message, 'danger');
      }
    );
  }

  //
  // Pull to refresh
  //

  handleRefresh(event?) {
    this.users = [];
    this.isAllUsersLoaded = false;
    this.getUsers2();
    //this.getUsers(this.filterData);
    if (event) event.target.complete();
  }

  //
  // Filters
  //

  getFiltersPage() {
    this.router.navigateByUrl('/home/filters');
  }

  //
  // Present Toast
  //

  async presentToast(msg: string, color?: string) {
    const toast = await this.toastController.create({
      message: msg,
      color: color || 'primary',
      duration: 1500,
      position: 'bottom',
    });

    await toast.present();
  }
}
