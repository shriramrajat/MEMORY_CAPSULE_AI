# Testing Guide

This document provides comprehensive information about testing in the Memory Capsule AI application.

## Table of Contents

- [Overview](#overview)
- [Testing Stack](#testing-stack)
- [Running Tests](#running-tests)
- [Test Structure](#test-structure)
- [Unit Testing](#unit-testing)
- [Property-Based Testing](#property-based-testing)
- [Component Testing](#component-testing)
- [Writing Tests](#writing-tests)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

The application uses a dual testing approach:

1. **Unit Tests** - Test specific examples, edge cases, and component behavior
2. **Property-Based Tests** - Verify universal properties across all inputs using fast-check

This combination provides comprehensive coverage: unit tests catch concrete bugs, while property tests verify general correctness.

---

## Testing Stack

### Core Testing Tools

- **Test Framework:** [Vitest](https://vitest.dev/) - Fast, Vite-native test runner
- **Testing Library:** [React Testing Library](https://testing-library.com/react) - Component testing utilities
- **Property Testing:** [fast-check](https://fast-check.dev/) - Property-based testing library
- **Test Environment:** jsdom - Browser-like environment for tests
- **Assertions:** Vitest's built-in assertions + @testing-library/jest-dom

### Configuration

Test configuration is in `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

Test setup is in `src/test/setup.ts`:

```typescript
import '@testing-library/jest-dom';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});
```

---

## Running Tests

### Basic Commands

```bash
# Run all tests once
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with UI (interactive test explorer)
npm run test:ui

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- src/lib/database.test.ts

# Run tests matching a pattern
npm test -- --grep "capsule creation"
```

### CI/CD Integration

Tests run automatically in CI/CD pipelines. Example GitHub Actions:

```yaml
- name: Run tests
  run: |
    cd MeroryCapsuleAi
    npm test
```

---

## Test Structure

### File Organization

Tests are co-located with source files using the `.test.ts` or `.test.tsx` suffix:

```
src/
├── lib/
│   ├── database.ts
│   ├── database.test.ts          # Unit + property tests
│   ├── file-service.ts
│   └── file-service.test.ts
├── components/
│   ├── dashboard/
│   │   ├── Dashboard.tsx
│   │   └── Dashboard.test.tsx    # Component tests
│   └── capsules/
│       ├── CreateCapsule.tsx
│       └── CreateCapsule.test.tsx
└── test/
    └── setup.ts                   # Global test setup
```

### Test File Structure

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import fc from 'fast-check';

describe('ComponentName', () => {
  // Setup
  beforeEach(() => {
    // Setup code
  });

  afterEach(() => {
    // Cleanup code
  });

  // Unit tests
  describe('specific behavior', () => {
    it('should do something specific', () => {
      // Test code
    });
  });

  // Property-based tests
  describe('property tests', () => {
    it('should maintain invariant across all inputs', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          // Property test code
        })
      );
    });
  });
});
```

---

## Unit Testing

### Purpose

Unit tests verify:
- Specific examples work correctly
- Edge cases are handled
- Error conditions are caught
- Integration points function properly

### Example: Service Method Test

```typescript
import { describe, it, expect } from 'vitest';
import { FileService } from './file-service';

describe('FileService', () => {
  describe('validateFile', () => {
    it('should accept valid image files', () => {
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      const result = FileService.validateFile(file);
      
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject files exceeding size limit', () => {
      const largeContent = new Array(11 * 1024 * 1024).fill('a').join('');
      const file = new File([largeContent], 'large.jpg', { type: 'image/jpeg' });
      const result = FileService.validateFile(file);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('exceeds maximum');
    });

    it('should reject unsupported file types', () => {
      const file = new File(['content'], 'test.exe', { type: 'application/x-msdownload' });
      const result = FileService.validateFile(file);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Unsupported file type');
    });
  });
});
```

### Example: Component Test

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateCapsule } from './CreateCapsule';

describe('CreateCapsule', () => {
  it('should render form fields', () => {
    render(<CreateCapsule onBack={() => {}} onSuccess={() => {}} />);
    
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/content/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/unlock date/i)).toBeInTheDocument();
  });

  it('should show validation error for empty title', async () => {
    render(<CreateCapsule onBack={() => {}} onSuccess={() => {}} />);
    
    const submitButton = screen.getByRole('button', { name: /create/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/title is required/i)).toBeInTheDocument();
    });
  });

  it('should call onSuccess after successful creation', async () => {
    const onSuccess = vi.fn();
    render(<CreateCapsule onBack={() => {}} onSuccess={onSuccess} />);
    
    // Fill form
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: 'Test Capsule' }
    });
    fireEvent.change(screen.getByLabelText(/content/i), {
      target: { value: 'Test content' }
    });
    
    // Submit
    fireEvent.click(screen.getByRole('button', { name: /create/i }));
    
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});
```

---

## Property-Based Testing

### Purpose

Property-based tests verify:
- Universal properties hold across all inputs
- Round-trip operations preserve data
- Invariants are maintained
- Edge cases are automatically discovered

### Configuration

Each property test runs 100 iterations by default (configurable):

```typescript
fc.assert(
  fc.property(/* generators */, (/* inputs */) => {
    // Test property
  }),
  { numRuns: 100 } // Number of test cases to generate
);
```

### Example: Round-Trip Property

```typescript
import { describe, it } from 'vitest';
import fc from 'fast-check';
import { CapsuleEncryption } from './encryption';

describe('CapsuleEncryption', () => {
  // **Feature: memory-capsule-completion, Property 4: File Encryption Round Trip**
  it('should preserve data through encryption and decryption', async () => {
    // Generate encryption key once for all test cases
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 1000 }),
        async (originalData) => {
          // Encrypt
          const encrypted = await CapsuleEncryption.encryptData(originalData, key);
          
          // Decrypt
          const decrypted = await CapsuleEncryption.decryptData(
            encrypted.encryptedData,
            encrypted.iv,
            key
          );
          
          // Property: decrypted data equals original
          return decrypted === originalData;
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Example: Invariant Property

```typescript
describe('Timeline', () => {
  // **Feature: memory-capsule-completion, Property 12: Timeline Chronological Ordering**
  it('should display capsules in chronological order', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            title: fc.string(),
            createdAt: fc.date(),
            isUnlocked: fc.boolean()
          }),
          { minLength: 2, maxLength: 20 }
        ),
        (capsules) => {
          // Render timeline
          const { container } = render(<Timeline capsules={capsules} />);
          
          // Get rendered dates
          const dateElements = container.querySelectorAll('[data-testid="capsule-date"]');
          const renderedDates = Array.from(dateElements).map(
            el => new Date(el.textContent!)
          );
          
          // Property: dates should be in chronological order
          for (let i = 1; i < renderedDates.length; i++) {
            if (renderedDates[i] < renderedDates[i - 1]) {
              return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Custom Generators

Create domain-specific generators for complex types:

```typescript
// Generator for valid capsule data
const capsuleArbitrary = fc.record({
  title: fc.string({ minLength: 1, maxLength: 100 }),
  content: fc.string({ minLength: 1, maxLength: 5000 }),
  unlockDate: fc.date({ min: new Date() }), // Future dates only
  type: fc.constantFrom('text', 'image', 'mixed'),
});

// Generator for valid file objects
const fileArbitrary = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }),
  type: fc.constantFrom('image/jpeg', 'image/png', 'application/pdf'),
  size: fc.integer({ min: 1, max: 10 * 1024 * 1024 }), // 1 byte to 10MB
}).map(({ name, type, size }) => {
  const content = new Array(size).fill('a').join('');
  return new File([content], name, { type });
});

// Use in tests
fc.assert(
  fc.property(capsuleArbitrary, fileArbitrary, (capsule, file) => {
    // Test with generated capsule and file
  })
);
```

### Property Test Tags

All property tests must include a comment tag referencing the design document:

```typescript
// **Feature: memory-capsule-completion, Property 1: Capsule Creation Persistence**
it('should persist capsule data through create and read cycle', async () => {
  // Test implementation
});
```

---

## Component Testing

### Testing React Components

Use React Testing Library for component tests:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';

// Wrapper for components that need context
const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        {component}
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('Dashboard', () => {
  it('should display loading state while fetching', () => {
    renderWithProviders(<Dashboard />);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('should display capsules after loading', async () => {
    renderWithProviders(<Dashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/my first capsule/i)).toBeInTheDocument();
    });
  });
});
```

### Testing User Interactions

```typescript
it('should open capsule detail on click', async () => {
  const onViewChange = vi.fn();
  renderWithProviders(<Dashboard onViewChange={onViewChange} />);
  
  await waitFor(() => {
    expect(screen.getByText(/my capsule/i)).toBeInTheDocument();
  });
  
  fireEvent.click(screen.getByText(/my capsule/i));
  
  expect(onViewChange).toHaveBeenCalledWith('detail', expect.any(String));
});
```

### Testing Async Operations

```typescript
it('should handle file upload with progress', async () => {
  const onProgress = vi.fn();
  renderWithProviders(<CreateCapsule onProgress={onProgress} />);
  
  const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
  const input = screen.getByLabelText(/attach files/i);
  
  fireEvent.change(input, { target: { files: [file] } });
  
  await waitFor(() => {
    expect(onProgress).toHaveBeenCalledWith(0, 0);
    expect(onProgress).toHaveBeenCalledWith(0, 100);
  });
});
```

---

## Writing Tests

### Test Naming Conventions

Use descriptive test names that explain the behavior:

```typescript
// ✅ Good
it('should reject files exceeding 10MB size limit', () => {});
it('should display error message when title is empty', () => {});
it('should preserve data through encryption round trip', () => {});

// ❌ Bad
it('should work', () => {});
it('test file validation', () => {});
it('encryption test', () => {});
```

### Arrange-Act-Assert Pattern

Structure tests clearly:

```typescript
it('should update capsule title', async () => {
  // Arrange
  const capsuleId = 'test-id';
  const newTitle = 'Updated Title';
  const userKey = await generateKey();
  
  // Act
  await SecureCapsuleDB.updateCapsule(capsuleId, userId, userKey, {
    title: newTitle
  });
  
  // Assert
  const updated = await SecureCapsuleDB.getCapsuleById(capsuleId, userId, userKey);
  expect(updated?.title).toBe(newTitle);
});
```

### Mocking

Use Vitest's mocking capabilities sparingly:

```typescript
import { vi } from 'vitest';

// Mock a module
vi.mock('@/integrations/firebase/config', () => ({
  db: mockFirestore,
  storage: mockStorage,
  auth: mockAuth
}));

// Mock a function
const mockFn = vi.fn();
mockFn.mockReturnValue('mocked value');
mockFn.mockResolvedValue(Promise.resolve('async value'));

// Spy on a method
const spy = vi.spyOn(SecureCapsuleDB, 'createCapsule');
expect(spy).toHaveBeenCalledWith(/* expected args */);
```

### Testing Error Handling

```typescript
it('should throw error when capsule not found', async () => {
  await expect(
    SecureCapsuleDB.getCapsuleById('non-existent', userId, userKey)
  ).rejects.toThrow('Capsule not found');
});

it('should display error message on failed upload', async () => {
  // Mock upload to fail
  vi.spyOn(FileService, 'uploadFiles').mockRejectedValue(
    new Error('Upload failed')
  );
  
  renderWithProviders(<CreateCapsule />);
  
  // Trigger upload
  // ...
  
  await waitFor(() => {
    expect(screen.getByText(/upload failed/i)).toBeInTheDocument();
  });
});
```

---

## Best Practices

### General Guidelines

1. **Test Behavior, Not Implementation**
   - Focus on what the code does, not how it does it
   - Avoid testing internal implementation details
   - Test from the user's perspective

2. **Keep Tests Independent**
   - Each test should run in isolation
   - Don't rely on test execution order
   - Clean up after each test

3. **Use Meaningful Assertions**
   - Assert on actual behavior, not just that code runs
   - Use specific matchers (toContain, toHaveLength, etc.)
   - Include helpful error messages

4. **Avoid Over-Mocking**
   - Mock external dependencies (Firebase, APIs)
   - Don't mock internal modules unless necessary
   - Use real implementations when possible

5. **Test Edge Cases**
   - Empty inputs
   - Boundary values
   - Error conditions
   - Concurrent operations

### Property Testing Guidelines

1. **Choose Appropriate Generators**
   - Use constrained generators for valid inputs
   - Create custom generators for domain types
   - Ensure generators produce realistic data

2. **Write Clear Properties**
   - Properties should be simple and obvious
   - One property per test
   - Document what property is being tested

3. **Handle Async Operations**
   - Use `fc.asyncProperty` for async tests
   - Ensure all promises are awaited
   - Handle timeouts appropriately

4. **Shrinking**
   - fast-check automatically finds minimal failing examples
   - Use shrinking to identify root causes
   - Document discovered edge cases

### Performance

1. **Keep Tests Fast**
   - Unit tests should run in milliseconds
   - Use mocks for slow operations
   - Parallelize test execution

2. **Optimize Property Tests**
   - Balance numRuns with test speed
   - Use smaller generators when possible
   - Cache expensive setup (like key generation)

---

## Troubleshooting

### Tests Fail Intermittently

**Cause:** Race conditions or timing issues

**Solution:**
- Use `waitFor` for async operations
- Increase timeout for slow operations
- Ensure proper cleanup between tests

### Property Tests Fail with Obscure Examples

**Cause:** Generator producing invalid inputs

**Solution:**
- Add constraints to generators
- Filter invalid inputs with `.filter()`
- Use pre/post conditions in properties

### Tests Pass Locally But Fail in CI

**Cause:** Environment differences

**Solution:**
- Check Node version matches
- Verify all dependencies are installed
- Check for timezone or locale issues
- Ensure Firebase emulators are running (if needed)

### Memory Leaks in Tests

**Cause:** Not cleaning up resources

**Solution:**
- Use `afterEach` for cleanup
- Stop timers and intervals
- Clear mocks after tests
- Unmount components properly

### Slow Test Suite

**Cause:** Too many tests or slow operations

**Solution:**
- Run tests in parallel (Vitest default)
- Mock slow operations
- Reduce numRuns for property tests
- Use test.skip for slow tests during development

---

## Coverage

### Generating Coverage Reports

```bash
# Generate coverage report
npm test -- --coverage

# View coverage in browser
npm test -- --coverage --ui
```

### Coverage Goals

- **Statements:** > 80%
- **Branches:** > 75%
- **Functions:** > 80%
- **Lines:** > 80%

### What to Cover

Priority areas for test coverage:
1. Core business logic (encryption, database operations)
2. User-facing features (capsule creation, search)
3. Error handling paths
4. Security-critical code
5. Data validation

---

## Continuous Integration

### Pre-commit Hooks

Use Husky to run tests before commits:

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm test"
    }
  }
}
```

### CI Pipeline

Example GitHub Actions workflow:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd MeroryCapsuleAi
          npm ci
      
      - name: Run tests
        run: |
          cd MeroryCapsuleAi
          npm test -- --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./MeroryCapsuleAi/coverage/coverage-final.json
```

---

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [fast-check Documentation](https://fast-check.dev/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

---

For more information, see the [main README](../README.md) or [API Documentation](./API.md).
