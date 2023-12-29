import { TestBed } from '@angular/core/testing';

import { AppInitServiceService } from './app-init-service.service';

describe('AppInitServiceService', () => {
  let service: AppInitServiceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AppInitServiceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
