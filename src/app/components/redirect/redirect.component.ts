import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-redirect',
  templateUrl: './redirect.component.html',
  styleUrls: ['./redirect.component.scss'],
})
export class RedirectComponent implements OnInit {
  @Input() model: any;
  // TODO: Make countdown dynamic
  second: number = 3;

  constructor() {}

  ngOnInit() {}
}
