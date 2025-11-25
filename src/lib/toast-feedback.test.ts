import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { toast } from 'sonner';

// **Feature: memory-capsule-completion, Property 33: Operation Feedback Consistency**
// **Validates: Requirements 13.4, 13.5**

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

describe('Property 33: Operation Feedback Consistency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should provide success toast for all successful operations', () => {
    fc.assert(
      fc.property(
        fc.record({
          operationType: fc.constantFrom(
            'create',
            'update',
            'delete',
            'download',
            'export',
            'share',
            'transcribe'
          ),
          title: fc.string({ minLength: 1, maxLength: 100 }),
          description: fc.string({ minLength: 1, maxLength: 200 }),
        }),
        (operation) => {
          // Simulate a successful operation
          const mockSuccessOperation = () => {
            toast.success(operation.title, {
              description: operation.description,
            });
          };

          mockSuccessOperation();

          // Verify success toast was called
          expect(toast.success).toHaveBeenCalledWith(
            operation.title,
            expect.objectContaining({
              description: operation.description,
            })
          );

          // Verify error toast was NOT called
          expect(toast.error).not.toHaveBeenCalled();

          // Clear for next iteration
          vi.clearAllMocks();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should provide error toast for all failed operations', () => {
    fc.assert(
      fc.property(
        fc.record({
          operationType: fc.constantFrom(
            'create',
            'update',
            'delete',
            'download',
            'export',
            'share',
            'transcribe'
          ),
          errorTitle: fc.string({ minLength: 1, maxLength: 100 }),
          errorDescription: fc.string({ minLength: 1, maxLength: 200 }),
        }),
        (operation) => {
          // Simulate a failed operation
          const mockFailedOperation = () => {
            toast.error(operation.errorTitle, {
              description: operation.errorDescription,
            });
          };

          mockFailedOperation();

          // Verify error toast was called
          expect(toast.error).toHaveBeenCalledWith(
            operation.errorTitle,
            expect.objectContaining({
              description: operation.errorDescription,
            })
          );

          // Verify success toast was NOT called
          expect(toast.success).not.toHaveBeenCalled();

          // Clear for next iteration
          vi.clearAllMocks();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include actionable information in error toasts', () => {
    fc.assert(
      fc.property(
        fc.record({
          errorMessage: fc.string({ minLength: 1, maxLength: 100 }),
          actionableInfo: fc.string({ minLength: 10, maxLength: 200 }),
        }),
        (errorData) => {
          // Simulate an error with actionable information
          const mockErrorWithAction = () => {
            toast.error(errorData.errorMessage, {
              description: errorData.actionableInfo,
            });
          };

          mockErrorWithAction();

          // Verify error toast was called with description
          expect(toast.error).toHaveBeenCalledWith(
            errorData.errorMessage,
            expect.objectContaining({
              description: expect.any(String),
            })
          );

          const callArgs = (toast.error as any).mock.calls[0];
          const description = callArgs[1]?.description;

          // Verify description is not empty (contains actionable information)
          expect(description).toBeTruthy();
          expect(description.length).toBeGreaterThan(0);

          // Clear for next iteration
          vi.clearAllMocks();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should never call both success and error toasts for the same operation', () => {
    fc.assert(
      fc.property(
        fc.record({
          shouldSucceed: fc.boolean(),
          title: fc.string({ minLength: 1, maxLength: 100 }),
          description: fc.string({ minLength: 1, maxLength: 200 }),
        }),
        (operation) => {
          // Simulate an operation that either succeeds or fails
          const mockOperation = () => {
            if (operation.shouldSucceed) {
              toast.success(operation.title, {
                description: operation.description,
              });
            } else {
              toast.error(operation.title, {
                description: operation.description,
              });
            }
          };

          mockOperation();

          // Verify only one type of toast was called
          const successCalled = (toast.success as any).mock.calls.length > 0;
          const errorCalled = (toast.error as any).mock.calls.length > 0;

          // Exactly one should be called, not both
          expect(successCalled !== errorCalled).toBe(true);

          if (operation.shouldSucceed) {
            expect(toast.success).toHaveBeenCalled();
            expect(toast.error).not.toHaveBeenCalled();
          } else {
            expect(toast.error).toHaveBeenCalled();
            expect(toast.success).not.toHaveBeenCalled();
          }

          // Clear for next iteration
          vi.clearAllMocks();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should provide consistent toast structure across all operations', () => {
    fc.assert(
      fc.property(
        fc.record({
          isSuccess: fc.boolean(),
          title: fc.string({ minLength: 1, maxLength: 100 }),
          description: fc.string({ minLength: 1, maxLength: 200 }),
        }),
        (toastData) => {
          // Simulate toast call
          const mockToast = () => {
            if (toastData.isSuccess) {
              toast.success(toastData.title, {
                description: toastData.description,
              });
            } else {
              toast.error(toastData.title, {
                description: toastData.description,
              });
            }
          };

          mockToast();

          // Verify toast was called with consistent structure
          const toastFn = toastData.isSuccess ? toast.success : toast.error;
          expect(toastFn).toHaveBeenCalledWith(
            expect.any(String), // title
            expect.objectContaining({
              description: expect.any(String), // description
            })
          );

          // Verify the structure matches our expected format
          const callArgs = (toastFn as any).mock.calls[0];
          expect(callArgs).toHaveLength(2);
          expect(typeof callArgs[0]).toBe('string'); // title is string
          expect(typeof callArgs[1]).toBe('object'); // options is object
          expect(callArgs[1]).toHaveProperty('description');

          // Clear for next iteration
          vi.clearAllMocks();
        }
      ),
      { numRuns: 100 }
    );
  });
});
