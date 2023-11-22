import { NgModule } from '@angular/core';
import { CustomFilterPipe } from './extras/custom-filter.pipe';
import { DateMaskPipe } from './extras/date-mask.pipe';

@NgModule({
  imports: [],
  declarations: [CustomFilterPipe, DateMaskPipe],
  exports: [CustomFilterPipe, DateMaskPipe],
})
export class AppExtrasModule {}
