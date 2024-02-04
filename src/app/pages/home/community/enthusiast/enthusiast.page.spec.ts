import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EnthusiastPage } from './enthusiast.page';

describe('EnthusiastPage', () => {
  let component: EnthusiastPage;
  let fixture: ComponentFixture<EnthusiastPage>;

  beforeEach(async(() => {
    fixture = TestBed.createComponent(EnthusiastPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
