/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { readPackageJson } from '../src/utils/package-json';

describe('readPackageJson', () => {
  it('caches parse failures until the package changes', () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'eslint-plugin-package-json-')
    );
    const packagePath = path.join(directory, 'package.json');
    const firstMtime = new Date('2025-01-01T00:00:00.000Z');
    const secondMtime = new Date('2025-01-02T00:00:00.000Z');
    const parse = jest.spyOn(JSON, 'parse');

    try {
      fs.writeFileSync(packagePath, '{');
      fs.utimesSync(packagePath, firstMtime, firstMtime);

      expect(readPackageJson(packagePath)).toBeNull();
      expect(readPackageJson(packagePath)).toBeNull();
      expect(parse).toHaveBeenCalledTimes(1);

      fs.writeFileSync(packagePath, '{"name":"@jupyterlab/example"}');
      fs.utimesSync(packagePath, secondMtime, secondMtime);

      expect(readPackageJson(packagePath)?.data.name).toBe(
        '@jupyterlab/example'
      );
      expect(parse).toHaveBeenCalledTimes(2);
    } finally {
      parse.mockRestore();
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
