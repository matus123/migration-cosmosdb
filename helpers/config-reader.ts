import * as path from 'path';
import { IConfig } from '../interfaces/index';

export function loadConfig(filePath: string): IConfig {
    if (filePath == null) {
        return {};
    }
    const config = require(path.resolve(process.cwd(), filePath)) as IConfig;
    return config;
}
