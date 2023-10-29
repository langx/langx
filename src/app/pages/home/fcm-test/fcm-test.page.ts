import { Component, OnInit } from '@angular/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-fcm-test',
  templateUrl: './fcm-test.page.html',
  styleUrls: ['./fcm-test.page.scss'],
})
export class FcmTestPage implements OnInit {
  id = null;

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      this.id = params.get('id');
    });
  }

  resetBadgeCount() {
    PushNotifications.removeAllDeliveredNotifications();
  }
}
