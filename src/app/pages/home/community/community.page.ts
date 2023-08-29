import { Component, OnInit } from '@angular/core';
import { NavigationExtras, Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth/auth.service';
import { ChatService } from 'src/app/services/chat/chat.service';
import { FilterService, isFilter } from 'src/app/services/filter/filter.service';

@Component({
  selector: 'app-community',
  templateUrl: './community.page.html',
  styleUrls: ['./community.page.scss'],
})
export class CommunityPage implements OnInit {

  filterSubscription: any;

  users = [];
  lastVisible: any;

  isLoading: boolean = false;

  constructor(
    private router: Router,
    private chatService: ChatService,
    private authService: AuthService,
    private filterService: FilterService,
  ) { }

  ngOnInit() {
    this.checkFilter();
  }

  //
  // Check Filter
  //

  checkFilter() {

    this.authService.getUserData().then((currentUserData) => {
      if(currentUserData?.isFilterData) {
        this.filterService.setEvent(currentUserData?.filterData);
      }
    }).catch((error) => {
      console.log('error: ', error);
    });

    this.filterSubscription = this.filterService.getEvent()
    .subscribe(
      (filterData: isFilter) => {
        this.doSomething(filterData);
      }
    );
  }

  doSomething(filterData: isFilter) {
    if (!filterData) return;
    console.log('filter: ', filterData);
    

    //after check filter, then get users
    this.getUsers();
  }

  //
  // Get Users on Init
  //

  async getUsers() {
    await this.loadUsers();
  }

  //
  // Infinite Scroll
  //

  loadMore(event) {
    this.loadUsers(event);
  }

  async loadUsers(infiniteScroll?) {

    if (!infiniteScroll) {
      const docSnap = await this.chatService.getUsers();
      // console.log('docSnap: ', docSnap.docs);
      this.users = docSnap.docs.map(doc => doc.data()).filter(user => user.uid !== this.chatService.currentUserId);

      // Get the last visible document
      let l = docSnap.docs[docSnap.docs.length-1];
      this.lastVisible = l || null;

    } else {
      console.log('lastVisible: ', this.lastVisible.get('name'));
      // Use the query for pagination
      const nextDocSnap = await this.chatService.getMoreUsers(this.lastVisible);
      this.users.push(...nextDocSnap.docs.map(doc => doc.data()).filter(user => user.uid !== this.chatService.currentUserId));

      // Get the last visible document
      let l = nextDocSnap.docs[nextDocSnap.docs.length-1];
      this.lastVisible = l || null;

      // TODO: check double, go another page and back, test with filters
      // Because if i disable the infiniteScroll, it will not work anymore until i refresh the page
      infiniteScroll.target.complete();
      if (!this.lastVisible) {
        infiniteScroll.target.disabled = true;
      }
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
        }
      };
      this.router.navigate(['/', 'home', 'chat', room?.id], navData);
      // hideLoader();
      this.isLoading = false;
    } catch(e) {
      console.log(e);
      // hideLoader();
      this.isLoading = false;
    }
  }

  //
  // Filters
  //

  getFiltersPage() {
    this.router.navigateByUrl('/home/filters');
  }

  //
  // Pull to refresh
  //

  handleRefresh(event) {
    this.users = [];
    this.getUsers();
    event.target.complete();
    console.log('Async operation refresh has ended');
  }

}