import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExtraPage } from './extra.page';

describe('ExtraPage', () => {
  let component: ExtraPage;
  let fixture: ComponentFixture<ExtraPage>;

  beforeEach(async(() => {
    fixture = TestBed.createComponent(ExtraPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
