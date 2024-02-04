import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EnthusiastsPage } from './enthusiasts.page';

describe('EnthusiastsPage', () => {
  let component: EnthusiastsPage;
  let fixture: ComponentFixture<EnthusiastsPage>;

  beforeEach(async(() => {
    fixture = TestBed.createComponent(EnthusiastsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
