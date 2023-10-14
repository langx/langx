import { Component, OnInit } from '@angular/core';
import { NotificationService } from 'src/app/services/notification/notification.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit {
  constructor(private notification: NotificationService) {}

  async ngOnInit() {}

  ngOnDestroy() {
    this.unsubscribeListener();
  }

  unsubscribeListener() {
    this.notification.unsubscribe();
    console.log('listener stopped');
  }
}
