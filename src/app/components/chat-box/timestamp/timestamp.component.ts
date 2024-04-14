import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  ChangeDetectorRef,
} from '@angular/core';

import { messageTime } from 'src/app/extras/utils';

@Component({
  selector: 'app-timestamp',
  templateUrl: './timestamp.component.html',
  styleUrls: ['./timestamp.component.scss'],
})
export class TimestampComponent implements OnChanges {
  @Input() seen: boolean;
  @Input() createdAt: string;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['seen'] || changes['createdAt']) {
      // console.log('createdat:', changes['createdAt'].currentValue);
      // console.log('seen:', changes['seen'].currentValue);

      // Trigger change detection manually
      this.cdr.detectChanges();
    }
  }

  //
  // Utils for time
  //

  messageTime(d: any) {
    if (!d) return null;
    return messageTime(d);
  }
}
