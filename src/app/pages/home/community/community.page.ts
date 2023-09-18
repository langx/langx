import { Component, OnInit } from '@angular/core';
import { NavigationExtras, Router } from '@angular/router';
import { ChatService } from 'src/app/services/chat/chat.service';
import { Chat3Service } from 'src/app/services/chat/chat3.service';
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

  isAllUsersLoaded: boolean = false;
  isLoading: boolean = false;

  constructor(
    private router: Router,
    private chatService: ChatService,
    private chat3Service: Chat3Service,
    private userService: UserService,
    private filterService: FilterService,
    private storageService: StorageService
  ) {}

  async ngOnInit() {
    await this.checkFilter();
  }

  ngOnDestroy() {
    this.filter$.unsubscribe();
    console.log('unsubscribed');
  }

  //
  // Check Filter
  //

  async checkFilter() {
    await this.checkLocalStorage();

    this.filter$ = this.filterService
      .getEvent()
      .subscribe((filterData: FilterData) => {
        this.filterData = filterData;
        console.log('Subscribed filter: ', filterData);
        this.handleRefresh(filterData);
      });
  }

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
    this.getUsers(this.filterData);
    event.target.complete();
    console.log('Async operation loadMore has ended');
  }

  async getUsers(filterData?: FilterData) {
    let users = await this.userService.getUsers(filterData);
    if (users.length > 0) {
      this.users.push(...users);
    } else {
      this.isAllUsersLoaded = true;
      console.log('No more users');
    }
  }

  //
  // Start Chat
  //

  async startChat(item) {
    try {
      // showLoader();
      this.isLoading = true;
      // create chatroom
      const room = await this.chatService.createChatRoom(item?.uid);
      console.log('room: ', room);
      const navData: NavigationExtras = {
        queryParams: {
          name: item?.name,
          uid: item?.uid,
        },
      };
      this.router.navigate(['/', 'home', 'chat', room?.id], navData);
      // hideLoader();
      this.isLoading = false;
    } catch (e) {
      console.log(e);
      // hideLoader();
      this.isLoading = false;
    }
  }

  async start3Chat(item) {

    let roomId: string = '';
    const promise = this.chat3Service.checkRoom(item.uid);
    await promise.then(
      function (response) {
        roomId = response.$id;
        console.log(response); // Success
      },
      function (error) {
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

  handleRefresh(filterData: FilterData, event?) {
    this.users = [];
    this.isAllUsersLoaded = false;
    this.userService.refreshUsers();
    this.getUsers(filterData);
    if (event) event.target.complete();
  }

  //
  // Filters
  //

  getFiltersPage() {
    this.router.navigateByUrl('/home/filters');
  }
}
