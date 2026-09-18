import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';

// Parallel route tests may need multiple async renders before becoming visible.
configure({ asyncUtilTimeout: 5000 });
