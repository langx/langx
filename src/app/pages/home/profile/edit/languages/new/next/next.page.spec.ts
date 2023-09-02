import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NextPage } from './next.page';

describe('NextPage', () => {
  let component: NextPage;
  let fixture: ComponentFixture<NextPage>;

  beforeEach(async(() => {
    fixture = TestBed.createComponent(NextPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});