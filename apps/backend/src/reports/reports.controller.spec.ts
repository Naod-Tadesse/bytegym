import { Test } from '@nestjs/testing';

import type { AuthenticatedUser } from '../auth/auth.types';
import { permissionsOn } from '../testing/permissions-metadata';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

const MAIN = '11111111-1111-4111-8111-111111111111';

const user = (dataScope: 'branch' | 'all'): AuthenticatedUser => ({
  personId: 'person',
  staffId: 'staff',
  accountId: 'account',
  branchId: MAIN,
  dataScope,
  permissions: [],
});

describe('ReportsController', () => {
  let controller: ReportsController;

  const service = { dashboard: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [{ provide: ReportsService, useValue: service }],
    }).compile();

    controller = moduleRef.get(ReportsController);
  });

  it('reports only the callers branch for a branch-scoped user', () => {
    // Otherwise a branch manager would read the whole gym's takings off the
    // dashboard, which the member list would never have shown them.
    controller.dashboard(user('branch'));
    expect(service.dashboard).toHaveBeenCalledWith(MAIN);
  });

  it('reports the whole gym for an all-scope user', () => {
    controller.dashboard(user('all'));
    expect(service.dashboard).toHaveBeenCalledWith(null);
  });

  it('requires report.view', () => {
    expect(permissionsOn(ReportsController, 'dashboard')).toEqual(['report.view']);
  });
});
