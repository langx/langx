import { Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';

@Component({
  selector: 'app-copilot-instructions',
  templateUrl: './copilot-instructions.component.html',
  styleUrls: ['./copilot-instructions.component.scss'],
})
export class CopilotInstructionsComponent implements OnInit {
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
