import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FundamentalsPage } from './fundamentals.page';

describe('FundamentalsPage', () => {
  let component: FundamentalsPage;
  let fixture: ComponentFixture<FundamentalsPage>;

  beforeEach(async(() => {
    fixture = TestBed.createComponent(FundamentalsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
