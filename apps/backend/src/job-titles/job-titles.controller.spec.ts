import { Test } from '@nestjs/testing';

import { permissionsOn } from '../testing/permissions-metadata';
import { JobTitlesController } from './job-titles.controller';
import { JobTitlesService } from './job-titles.service';

/**
 * A code catalogue, like permissions: seeded from job-titles.data.ts with no
 * API to create or edit one, because application logic branches on these and a
 * user-typed "Trainner" would silently get none of the behaviour.
 */
describe('JobTitlesController', () => {
  let controller: JobTitlesController;

  const service = { findAll: jest.fn(), findOne: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [JobTitlesController],
      providers: [{ provide: JobTitlesService, useValue: service }],
    }).compile();

    controller = moduleRef.get(JobTitlesController);
  });

  it('passes the query to findAll', () => {
    controller.findAll({ limit: 100 });
    expect(service.findAll).toHaveBeenCalledWith({ limit: 100 });
  });

  it('passes the id to findOne', () => {
    controller.findOne('job-title-id');
    expect(service.findOne).toHaveBeenCalledWith('job-title-id');
  });

  it('is read only', () => {
    // No create, update or delete: the catalogue is code, and a new title
    // means an entry in job-titles.data.ts plus a re-seed.
    expect(Object.getOwnPropertyNames(JobTitlesController.prototype)).toEqual(
      expect.not.arrayContaining(['create', 'update', 'remove']),
    );
  });

  it.each([
    ['findAll', ['jobTitle.list']],
    ['findOne', ['jobTitle.list']],
  ])('%s requires %s', (method, expected) => {
    expect(permissionsOn(JobTitlesController, method)).toEqual(expected);
  });
});
