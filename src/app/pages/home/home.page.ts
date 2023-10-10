import { Component, OnInit } from '@angular/core';
import { NotificationService } from 'src/app/services/notification/notification.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit {
  listenerFn: Function;
  
  constructor(private notification: NotificationService) {}

  async ngOnInit() {
    this.listenerFn = this.notification.listen();
  }

  async ngOnDestroy() {
    this.listenerFn();
    console.log('listener stopped');
  }
}
