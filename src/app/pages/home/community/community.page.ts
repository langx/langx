import { Component, OnInit } from '@angular/core';
import { NavigationExtras, Router } from '@angular/router';
import { RoomService } from 'src/app/services/chat/room.service';
import {
  FilterService,
  FilterData,
} from 'src/app/services/filter/filter.service';
import { StorageService } from 'src/app/services/storage/storage.service';
import { UserService } from 'src/app/services/user/user.service';

@Component({
  selector: 'app-community',
  templateUrl: './community.page.html',
  styleUrls: ['./community.page.scss'],
})
export class CommunityPage implements OnInit {
  filter$: any;
  filterData: FilterData;

  users = [];

  isAllUsersLoaded: boolean = false; // Pagination variable
  isLoading: boolean = false;

  constructor(
    private router: Router,
    private roomService: RoomService,
    private userService: UserService,
    private filterService: FilterService,
    private storageService: StorageService
  ) {}

  async ngOnInit() {
    await this.checkLocalStorage();
    await this.checkFilter();
    await this.getUsers(this.filterData);
  }

  ngOnDestroy() {
    this.filter$.unsubscribe();
    console.log('unsubscribed');
  }

  //
  // Get Users
  //

  getUsers(filterData?: FilterData) {
    this.isLoading = true;
    this.userService.listUsers(filterData).then(
      (response) => {
        this.isLoading = false;
        console.log(response);
        this.users = response.documents;
      },
      (error) => {
        this.isLoading = false;
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
      });
  }

  // TODO: Idea: it could be save it account.user.prefs
  async checkLocalStorage() {
    // Getting the filter data from localStorage
    const languagesString = await this.storageService.get('languages');
    const gender = (await this.storageService.get('gender')) || null;
    const country = (await this.storageService.get('country')) || null;
    const minAgeString = await this.storageService.get('minAge');
    const maxAgeString = await this.storageService.get('maxAge');

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

  // async getUsers(filterData?: FilterData) {
  //   let users = await this.userService.getUsers(filterData);
  //   if (users.length > 0) {
  //     this.users.push(...users);
  //   } else {
  //     this.isAllUsersLoaded = true;
  //     console.log('No more users');
  //   }
  // }

  //
  // Start Chat
  //

  async startChat(item) {
    let roomId: string = '';
    const promise = this.roomService.checkRoom(item.uid);
    await promise.then(
      (response) => {
        roomId = response.$id;
        console.log(response); // Success
      },
      (error) => {
        console.log(error); // Failure
        // TODO: Test this
        return;
      }
    );
    const navData: NavigationExtras = {
      queryParams: {
        name: item?.name,
        uid: item?.uid,
      },
    };
    this.router.navigate(['/', 'home', 'chat3', roomId], navData);
  }

  //
  // Pull to refresh
  //

  handleRefresh(event) {
    this.users = [];
    this.isAllUsersLoaded = false;
    this.getUsers(this.filterData);
    event.target.complete();
  }

  //
  // Filters
  //

  getFiltersPage() {
    this.router.navigateByUrl('/home/filters');
  }
}
