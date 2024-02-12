import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContributorsPage } from './contributors.page';

describe('ContributorsPage', () => {
  let component: ContributorsPage;
  let fixture: ComponentFixture<ContributorsPage>;

  beforeEach(async(() => {
    fixture = TestBed.createComponent(ContributorsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
