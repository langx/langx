import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-user',
  templateUrl: './user.page.html',
  styleUrls: ['./user.page.scss'],
})
export class UserPage implements OnInit {

  userId: string;

  constructor(
    private route: ActivatedRoute,
  ) { }

  ngOnInit() {
    const id: string = this.route.snapshot.paramMap.get('id');
    if(id) this.userId = id;
    console.log('check userId: ', this.userId);
  }

}