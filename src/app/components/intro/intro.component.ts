import { Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';

@Component({
  selector: 'app-intro',
  templateUrl: './intro.component.html',
  styleUrls: ['./intro.component.scss'],
})
export class IntroComponent implements OnInit {
  @Input() onFinish: () => void;
  @ViewChild('slides', { read: ElementRef }) slides: ElementRef;

  constructor() {}

  ngOnInit() {}

  nextSlide() {
    (this.slides.nativeElement as any).swiper.slideNext();
  }

  close() {
    this.onFinish();
  }
}
