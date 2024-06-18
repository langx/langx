import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TokenLeaderboardPage } from './token-leaderboard.page';

describe('TokenLeaderboardPage', () => {
  let component: TokenLeaderboardPage;
  let fixture: ComponentFixture<TokenLeaderboardPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(TokenLeaderboardPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
