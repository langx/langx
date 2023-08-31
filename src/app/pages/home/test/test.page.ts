import { Component, OnInit } from '@angular/core';
import { UserService } from 'src/app/services/user/user.service';

@Component({
  selector: 'app-test',
  templateUrl: './test.page.html',
  styleUrls: ['./test.page.scss'],
})
export class TestPage implements OnInit {

  constructor(private userService: UserService) {
    this.fetchFilteredUsers();
  }

  ngOnInit() { }

  filteredUsers: any[] = [];

  async fetchFilteredUsers() {
    const languages = ['en', 'es', 'zh']
    const gender = 'male';
    const country = 'AF';
    const minAge = 13;
    const maxAge = 100;

    this.filteredUsers = await this.userService.getUsersWithFilters(gender, country, languages, minAge, maxAge);
  }

}