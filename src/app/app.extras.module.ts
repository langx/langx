import { NgModule } from '@angular/core';
import { CustomFilterPipe } from './extras/custom-filter.pipe';

@NgModule({
  imports: [],
  declarations: [CustomFilterPipe],
  exports: [CustomFilterPipe],
})
export class AppExtrasModule {}
