import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SponsorsPage } from './sponsors.page';

describe('SponsorsPage', () => {
  let component: SponsorsPage;
  let fixture: ComponentFixture<SponsorsPage>;

  beforeEach(async(() => {
    fixture = TestBed.createComponent(SponsorsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
