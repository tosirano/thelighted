import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { AdminRole } from '../enums/role.enum';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  function createContext(user?: any) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
  }

  it('should allow access when no @Roles() metadata is set', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createContext();
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access when @Roles() metadata is empty', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);
    const context = createContext({ role: AdminRole.STAFF });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access when user has sufficient role (SUPER_ADMIN)', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([AdminRole.SUPER_ADMIN]);
    const context = createContext({ role: AdminRole.SUPER_ADMIN });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access when user has one of multiple required roles', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([AdminRole.ADMIN, AdminRole.SUPER_ADMIN]);
    const context = createContext({ role: AdminRole.ADMIN });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny access when user has insufficient role', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([AdminRole.SUPER_ADMIN]);
    const context = createContext({ role: AdminRole.STAFF });
    expect(() => guard.canActivate(context)).toThrow('Insufficient permissions');
  });

  it('should deny access when user has MANAGER role but SUPER_ADMIN is required', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([AdminRole.SUPER_ADMIN]);
    const context = createContext({ role: AdminRole.MANAGER });
    expect(() => guard.canActivate(context)).toThrow('Insufficient permissions');
  });

  it('should deny access when user is undefined', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([AdminRole.ADMIN]);
    const context = createContext(undefined);
    expect(() => guard.canActivate(context)).toThrow('No role found for user');
  });

  it('should deny access when user has no role property', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([AdminRole.ADMIN]);
    const context = createContext({ id: '123' });
    expect(() => guard.canActivate(context)).toThrow('No role found for user');
  });
});
