import { Component, ElementRef, Input, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';

import { UserService } from 'src/app/services/user/user.service';
import { FcmService } from 'src/app/services/fcm/fcm.service';

import { Visit } from 'src/app/models/Visit';
import { User } from 'src/app/models/User';
import {
  lastSeen,
  exactDateAndTime,
  onlineStatus,
  getFlagEmoji,
} from 'src/app/extras/utils';
import { Capacitor } from '@capacitor/core';

@Component({
  selector: 'app-visit-list',
  templateUrl: './visit-list.component.html',
  styleUrls: ['./visit-list.component.scss'],
})
export class VisitListComponent implements OnInit {
  @Input() item: Visit;

  private observer: IntersectionObserver;

  user: User;
  profilePic$: Observable<URL> = null;

  constructor(
    private route: Router,
    private userService: UserService,
    private fcmService: FcmService,
    private el: ElementRef
  ) {}

  ngAfterViewInit() {
    // This is for the seen action when the message is in view
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => this.handleIntersect(entry));
    });
    this.observer.observe(this.el.nativeElement);
  }

  ngAfterViewLeave() {
    this.observer.disconnect();
  }

  ngOnInit() {
    this.user = this.item.from;
    this.profilePic$ = this.userService.getUserFilePreview(
      this.user?.profilePic
    );
  }

  goProfile() {
    this.route.navigateByUrl('/home/user/' + this.user.$id);
  }

  //
  // Utils
  //

  handleIntersect(entry) {
    if (entry.isIntersecting) {
      // console.log('Intersecting: ', this.item.from.$id);
      // Delete local notification if exists
      if (Capacitor.getPlatform() !== 'web') {
        this.fcmService.deleteNotificationById(this.item.$id);
      }
    }
  }

  exactDateAndTime(d: any) {
    if (!d) return null;
    return exactDateAndTime(d);
  }

  lastSeen(d: any) {
    if (!d) return null;
    return lastSeen(d);
  }

  onlineStatus(d: any) {
    if (!d) return null;
    return onlineStatus(d);
  }

  getFlagEmoji(item: User) {
    return getFlagEmoji(item);
  }
}
