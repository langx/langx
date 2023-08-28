import { TestBed } from '@angular/core/testing';

import { FilterResolverService } from './filter-resolver.service';

describe('FilterService', () => {
  let service: FilterResolverService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FilterResolverService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});