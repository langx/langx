import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from 'src/app/services/auth/auth.service';

@Component({
  selector: 'app-user',
  templateUrl: './user.page.html',
  styleUrls: ['./user.page.scss'],
})
export class UserPage implements OnInit {

  userId: string;
  userData: any;

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService,
  ) { }

  async ngOnInit() {
    const id: string = this.route.snapshot.paramMap.get('id');
    if(id) this.userId = id;
    this.getUserData();
  }

  async getUserData() {
    // getting user data from the database while using getUserData() method in auth.service.ts
    this.userData = await this.authService.getUserData(this.userId);
    console.log('userData: ', this.userData);
  }
}