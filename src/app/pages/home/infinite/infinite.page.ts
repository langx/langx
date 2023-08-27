import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';

@Component({
  selector: 'app-infinite',
  templateUrl: './infinite.page.html',
  styleUrls: ['./infinite.page.scss'],
})
export class InfinitePage implements OnInit {

  users = [];
  page = 0;

  constructor(
    public navCtrl: NavController,
    private httpClient: HttpClient
  ) {
    this.loadUsers();
  }

  ngOnInit() {}

  loadUsers(infiniteScroll?) {
    this.httpClient.get(`https://randomuser.me/api/?results=20&page=${this.page}`)
    .subscribe(res => {
      this.users = this.users.concat(res['results']);
      if (infiniteScroll) {
        infiniteScroll.target.complete();
      }
    })
  }

  loadMore(infiniteScroll) {
    console.log('Begin async operation', this.page)
    this.page++;
    this.loadUsers(infiniteScroll);
  }

}
