import { Test } from '@nestjs/testing';

import { DRIZZLE } from '../database/database.constants';
import { isPublic, permissionsOn } from '../testing/permissions-metadata';
import { HealthController } from './health.controller';

/**
 * A liveness probe is only useful if it proves the thing that actually breaks.
 * This one touches the database, so a 200 means more than "the process is up".
 */
describe('HealthController', () => {
  let controller: HealthController;

  const db = {
    execute: jest.fn(),
    select: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    db.execute.mockResolvedValue(undefined);
    db.select.mockReturnValue({ from: () => Promise.resolve([{ count: 20 }]) });

    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: DRIZZLE, useValue: db }],
    }).compile();

    controller = moduleRef.get(HealthController);
  });

  it('answers without a token', () => {
    // A probe that needs credentials is a probe the orchestrator cannot use.
    expect(isPublic(HealthController, 'check')).toBe(true);
    expect(permissionsOn(HealthController, 'check')).toBeUndefined();
  });

  it('reports ok with the person count', async () => {
    await expect(controller.check()).resolves.toEqual({
      status: 'ok',
      database: 'up',
      users: 20,
    });
  });

  it('actually queries the database rather than answering blind', async () => {
    await controller.check();
    expect(db.execute).toHaveBeenCalled();
    expect(db.select).toHaveBeenCalled();
  });

  it('fails rather than reporting ok when the database is unreachable', async () => {
    // Swallowing this would make the probe lie, which is worse than no probe.
    db.execute.mockRejectedValue(new Error('connection refused'));
    await expect(controller.check()).rejects.toThrow('connection refused');
  });
});
