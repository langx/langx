import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VisitorsPage } from './visitors.page';

describe('VisitorsPage', () => {
  let component: VisitorsPage;
  let fixture: ComponentFixture<VisitorsPage>;

  beforeEach(async(() => {
    fixture = TestBed.createComponent(VisitorsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
