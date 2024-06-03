import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-copilot-instructions',
  templateUrl: './copilot-instructions.component.html',
  styleUrls: ['./copilot-instructions.component.scss'],
})
export class CopilotInstructionsComponent implements OnInit {
  @Input() onFinish: () => void;

  constructor() {}

  ngOnInit() {}

  close() {
    this.onFinish();
  }
}
