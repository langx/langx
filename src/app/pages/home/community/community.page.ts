import { Component, OnInit } from '@angular/core';
import { NavigationExtras, Router } from '@angular/router';
import { ChatService } from 'src/app/services/chat/chat.service';
import { StorageService } from 'src/app/services/storage/storage.service';

@Component({
  selector: 'app-community',
  templateUrl: './community.page.html',
  styleUrls: ['./community.page.scss'],
})
export class CommunityPage implements OnInit {

  users = [];
  lastVisible: any;
  filterData: any;

  isLoading: boolean = false;

  constructor(
    private router: Router,
    private chatService: ChatService,
    private storageService: StorageService
  ) { }

  async ngOnInit() {
    await this.checkFilter();
    await this.getUsers();
  }

  //
  // Get Users on Init
  //

  async getUsers() {
    this.loadUsers();
  }

  //
  // Check Filter
  //

  async checkFilter() {

  }

  //
  // Infinite Scroll
  //

  loadMore(event) {
    this.loadUsers(event);
  }

  async loadUsers(infiniteScroll?) {

    // console.log(this.filterData);

    if (!infiniteScroll) {
      const docSnap = await this.chatService.getUsers();
      // console.log('docSnap: ', docSnap.docs);
      this.users = docSnap.docs.map(doc => doc.data()).filter(user => user.uid !== this.chatService.currentUserId);

      // Get the last visible document
      let l = docSnap.docs[docSnap.docs.length-1];
      this.lastVisible = l || null;

    } else {
      // Use the query for pagination
      const nextDocSnap = await this.chatService.getMoreUsers(this.lastVisible);
      this.users.push(...nextDocSnap.docs.map(doc => doc.data()).filter(user => user.uid !== this.chatService.currentUserId));

      // Get the last visible document
      let l = nextDocSnap.docs[nextDocSnap.docs.length-1];
      this.lastVisible = l || null;
      infiniteScroll.target.complete();
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