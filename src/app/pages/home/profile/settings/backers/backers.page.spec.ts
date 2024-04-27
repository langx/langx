import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BackersPage } from './backers.page';

describe('BackersPage', () => {
  let component: BackersPage;
  let fixture: ComponentFixture<BackersPage>;

  beforeEach(async(() => {
    fixture = TestBed.createComponent(BackersPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
