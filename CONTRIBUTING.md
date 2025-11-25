# Contributing to Memory Capsule AI

Thank you for your interest in contributing to Memory Capsule AI! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Requirements](#testing-requirements)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Documentation](#documentation)
- [Reporting Issues](#reporting-issues)

---

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors, regardless of experience level, gender identity, sexual orientation, disability, personal appearance, race, ethnicity, age, religion, or nationality.

### Expected Behavior

- Be respectful and considerate in your communication
- Welcome newcomers and help them get started
- Accept constructive criticism gracefully
- Focus on what is best for the community and project
- Show empathy towards other community members

### Unacceptable Behavior

- Harassment, discrimination, or offensive comments
- Personal attacks or trolling
- Publishing others' private information
- Any conduct that could reasonably be considered inappropriate

### Enforcement

Instances of unacceptable behavior may be reported to the project maintainers. All complaints will be reviewed and investigated promptly and fairly.

---

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- Node.js 18 or higher
- npm (comes with Node.js)
- Git
- A Firebase project (for testing)
- (Optional) A Gemini API key (for AI features)

### Fork and Clone

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/memory-capsule-ai.git
   cd memory-capsule-ai/MeroryCapsuleAi
   ```

3. **Add upstream remote:**
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/memory-capsule-ai.git
   ```

### Setup Development Environment

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your Firebase credentials
   ```

3. **Run development server:**
   ```bash
   npm run dev
   ```

4. **Run tests:**
   ```bash
   npm test
   ```

---

## Development Workflow

### 1. Create a Branch

Always create a new branch for your work:

```bash
# Update your main branch
git checkout main
git pull upstream main

# Create a feature branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/bug-description
```

### Branch Naming Conventions

- `feature/` - New features (e.g., `feature/audio-recording`)
- `fix/` - Bug fixes (e.g., `fix/upload-progress`)
- `docs/` - Documentation updates (e.g., `docs/api-reference`)
- `refactor/` - Code refactoring (e.g., `refactor/encryption-service`)
- `test/` - Test additions or fixes (e.g., `test/capsule-creation`)
- `chore/` - Maintenance tasks (e.g., `chore/update-dependencies`)

### 2. Make Changes

- Write clean, readable code
- Follow the coding standards (see below)
- Add tests for new functionality
- Update documentation as needed
- Keep commits focused and atomic

### 3. Test Your Changes

Before committing, ensure:

```bash
# All tests pass
npm test

# No TypeScript errors
npm run build

# No linting errors
npm run lint
```

### 4. Commit Your Changes

```bash
git add .
git commit -m "feat: add audio recording feature"
```

See [Commit Guidelines](#commit-guidelines) for commit message format.

### 5. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

---

## Coding Standards

### TypeScript

- **Use TypeScript** for all new code
- **Define interfaces** for all data structures
- **Avoid `any` type** - use proper types or `unknown`
- **Use strict mode** - all TypeScript strict checks are enabled

### Code Style

We use ESLint for code style enforcement:

```bash
# Check for linting errors
npm run lint

# Auto-fix linting errors
npm run lint -- --fix
```

### Naming Conventions

- **Files:** kebab-case (e.g., `capsule-service.ts`)
- **Components:** PascalCase (e.g., `CreateCapsule.tsx`)
- **Functions/Variables:** camelCase (e.g., `getUserCapsules`)
- **Constants:** UPPER_SNAKE_CASE (e.g., `MAX_FILE_SIZE`)
- **Interfaces/Types:** PascalCase (e.g., `DecryptedCapsule`)
- **Private methods:** prefix with underscore (e.g., `_validateInput`)

### Code Organization

```typescript
// 1. Imports (grouped and sorted)
import { useState, useEffect } from 'react';
import { collection, query } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { SecureCapsuleDB } from '@/lib/database';

// 2. Type definitions
interface Props {
  userId: string;
  onSuccess: () => void;
}

// 3. Component/Function
export function MyComponent({ userId, onSuccess }: Props) {
  // 3a. Hooks
  const [loading, setLoading] = useState(false);
  
  // 3b. Event handlers
  const handleSubmit = () => {
    // Implementation
  };
  
  // 3c. Effects
  useEffect(() => {
    // Implementation
  }, []);
  
  // 3d. Render
  return (
    // JSX
  );
}
```

### Comments

- **Use JSDoc** for public APIs:
  ```typescript
  /**
   * Create a new encrypted capsule
   * 
   * @param title - Capsule title
   * @param content - Capsule content
   * @returns Promise resolving to capsule ID
   */
  static async createCapsule(title: string, content: string): Promise<string> {
    // Implementation
  }
  ```

- **Explain "why", not "what":**
  ```typescript
  // ✅ Good
  // Use exponential backoff to avoid overwhelming the server
  await delay(Math.pow(2, attempt) * 1000);
  
  // ❌ Bad
  // Wait for 2^attempt seconds
  await delay(Math.pow(2, attempt) * 1000);
  ```

- **Keep comments up-to-date** - outdated comments are worse than no comments

### Error Handling

- **Always handle errors** - never let promises reject silently
- **Provide user-friendly messages** - don't expose technical details
- **Log errors for debugging:**
  ```typescript
  try {
    await riskyOperation();
  } catch (error) {
    console.error('Operation failed:', error);
    throw new Error('User-friendly message');
  }
  ```

### Security

- **Never commit secrets** - use environment variables
- **Validate all inputs** - especially user-provided data
- **Sanitize outputs** - prevent XSS attacks
- **Use parameterized queries** - prevent injection attacks
- **Encrypt sensitive data** - before storing or transmitting

---

## Testing Requirements

### Test Coverage

All new features must include tests:

- **Unit tests** for business logic
- **Property-based tests** for universal properties
- **Component tests** for UI components
- **Integration tests** for complex workflows

### Writing Tests

See [Testing Guide](./docs/TESTING.md) for detailed information.

**Example unit test:**

```typescript
import { describe, it, expect } from 'vitest';
import { validateEmail } from './validation';

describe('validateEmail', () => {
  it('should accept valid email addresses', () => {
    expect(validateEmail('user@example.com')).toBe(true);
    expect(validateEmail('test.user+tag@domain.co.uk')).toBe(true);
  });

  it('should reject invalid email addresses', () => {
    expect(validateEmail('invalid')).toBe(false);
    expect(validateEmail('@example.com')).toBe(false);
    expect(validateEmail('user@')).toBe(false);
  });
});
```

**Example property test:**

```typescript
import fc from 'fast-check';

describe('encryption', () => {
  it('should preserve data through round trip', async () => {
    const key = await generateKey();
    
    await fc.assert(
      fc.asyncProperty(fc.string(), async (data) => {
        const encrypted = await encrypt(data, key);
        const decrypted = await decrypt(encrypted, key);
        return decrypted === data;
      }),
      { numRuns: 100 }
    );
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- src/lib/database.test.ts

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage
```

### Test Requirements for PRs

- All tests must pass
- New code must have test coverage
- Coverage should not decrease
- Property tests must run 100+ iterations

---

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, etc.)
- `refactor` - Code refactoring
- `test` - Adding or updating tests
- `chore` - Maintenance tasks
- `perf` - Performance improvements
- `ci` - CI/CD changes

### Examples

```bash
# Feature
git commit -m "feat(capsules): add audio recording support"

# Bug fix
git commit -m "fix(upload): handle large file uploads correctly"

# Documentation
git commit -m "docs(api): add FileService documentation"

# With body
git commit -m "feat(search): implement semantic search

Add AI-powered semantic search using Gemini embeddings.
Includes filtering by date range and sentiment.

Closes #123"
```

### Commit Best Practices

- **Keep commits atomic** - one logical change per commit
- **Write clear messages** - explain what and why, not how
- **Reference issues** - use "Closes #123" or "Fixes #456"
- **Keep subject line short** - 50 characters or less
- **Use imperative mood** - "add feature" not "added feature"

---

## Pull Request Process

### Before Submitting

Ensure your PR:

- [ ] Follows coding standards
- [ ] Includes tests for new functionality
- [ ] All tests pass
- [ ] Documentation is updated
- [ ] Commit messages follow guidelines
- [ ] Branch is up-to-date with main

### PR Title

Use the same format as commit messages:

```
feat(capsules): add audio recording support
fix(upload): handle large file uploads correctly
docs(api): add FileService documentation
```

### PR Description

Include:

1. **What** - What changes does this PR make?
2. **Why** - Why are these changes needed?
3. **How** - How were the changes implemented?
4. **Testing** - How were the changes tested?
5. **Screenshots** - For UI changes
6. **Related Issues** - Link to related issues

**Template:**

```markdown
## Description
Brief description of changes

## Motivation
Why are these changes needed?

## Changes
- Change 1
- Change 2
- Change 3

## Testing
How were these changes tested?

## Screenshots (if applicable)
[Add screenshots here]

## Related Issues
Closes #123
Related to #456

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] All tests pass
- [ ] No TypeScript errors
- [ ] Follows coding standards
```

### Review Process

1. **Automated checks** run on all PRs (tests, linting, build)
2. **Code review** by at least one maintainer
3. **Address feedback** - make requested changes
4. **Approval** - PR is approved by maintainer
5. **Merge** - Maintainer merges the PR

### After Merge

- Delete your feature branch
- Update your local main branch
- Close related issues (if not auto-closed)

---

## Documentation

### When to Update Documentation

Update documentation when:

- Adding new features
- Changing existing behavior
- Adding new APIs or services
- Fixing bugs that affect documented behavior
- Improving setup or deployment processes

### Documentation Files

- **README.md** - Project overview and quick start
- **ENVIRONMENT.md** - Environment configuration guide
- **docs/API.md** - API reference for all services
- **docs/TESTING.md** - Testing guide and best practices
- **docs/DEPLOYMENT.md** - Deployment instructions
- **CONTRIBUTING.md** - This file

### Documentation Style

- **Be clear and concise** - avoid jargon
- **Use examples** - show, don't just tell
- **Keep it updated** - outdated docs are harmful
- **Use proper formatting** - headings, lists, code blocks
- **Include links** - to related documentation

---

## Reporting Issues

### Before Reporting

1. **Search existing issues** - your issue may already be reported
2. **Check documentation** - the answer might be there
3. **Try latest version** - the issue might be fixed
4. **Reproduce the issue** - ensure it's reproducible

### Bug Reports

Include:

- **Description** - Clear description of the bug
- **Steps to reproduce** - Detailed steps to reproduce
- **Expected behavior** - What should happen
- **Actual behavior** - What actually happens
- **Environment** - OS, Node version, browser, etc.
- **Screenshots** - If applicable
- **Error messages** - Full error messages and stack traces

**Template:**

```markdown
## Bug Description
Clear description of the bug

## Steps to Reproduce
1. Go to '...'
2. Click on '...'
3. See error

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- OS: [e.g., Windows 11]
- Node: [e.g., 18.17.0]
- Browser: [e.g., Chrome 120]
- Version: [e.g., 1.0.0]

## Screenshots
[Add screenshots here]

## Error Messages
```
[Paste error messages here]
```

## Additional Context
Any other relevant information
```

### Feature Requests

Include:

- **Description** - Clear description of the feature
- **Use case** - Why is this feature needed?
- **Proposed solution** - How should it work?
- **Alternatives** - Other solutions you've considered
- **Additional context** - Any other relevant information

---

## Questions?

If you have questions about contributing:

1. Check the [documentation](./README.md)
2. Search [existing issues](https://github.com/OWNER/REPO/issues)
3. Ask in [discussions](https://github.com/OWNER/REPO/discussions)
4. Contact the maintainers

---

## Recognition

Contributors will be recognized in:

- The project README
- Release notes
- GitHub contributors page

Thank you for contributing to Memory Capsule AI! 🎉

---

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (MIT License).
