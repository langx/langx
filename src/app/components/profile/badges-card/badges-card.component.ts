import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-badges-card',
  templateUrl: './badges-card.component.html',
  styleUrls: ['./badges-card.component.scss'],
})
export class BadgesCardComponent implements OnInit {
  @Input() badges: string[];

  badgesList: Object[] = [];

  constructor() {}

  ngOnInit() {
    this.badgesList = this.badges?.map((badge: string) => {
      const name = badge
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      return { name, url: `/assets/image/badges/${badge}.png` };
    });
  }
}
