import * as ts from 'typescript';
import { Transpiler } from '@stryker-mutator/api/transpile';
import { File, StrykerOptions } from '@stryker-mutator/api/core';
import { getTSConfig, getProjectDirectory, guardTypescriptVersion, isHeaderFile } from './helpers/tsHelpers';
import TranspilingLanguageService from './transpiler/TranspilingLanguageService';
import TranspileFilter from './transpiler/TranspileFilter';
import { tokens, commonTokens } from '@stryker-mutator/api/plugin';
import { LoggerFactoryMethod } from '@stryker-mutator/api/logging';

export default class TypescriptTranspiler implements Transpiler {
  private languageService: TranspilingLanguageService;
  private readonly filter: TranspileFilter;

  public static inject = tokens(commonTokens.options, commonTokens.produceSourceMaps, commonTokens.getLogger);
  constructor(private readonly options: StrykerOptions,
              private readonly produceSourceMaps: boolean,
              private readonly getLogger: LoggerFactoryMethod) {
    guardTypescriptVersion();
    this.filter = TranspileFilter.create(this.options);
  }

  public transpile(files: ReadonlyArray<File>): Promise<ReadonlyArray<File>> {
    const typescriptFiles = this.filterIsIncluded(files);
    if (this.languageService) {
      this.languageService.replace(typescriptFiles);
    } else {
      this.languageService = this.createLanguageService(typescriptFiles);
    }
    const error = this.languageService.getSemanticDiagnostics(typescriptFiles);
    if (error.length) {
      return Promise.reject(new Error(error));
    } else {
      const resultFiles = this.transpileFiles(files);
      return Promise.resolve(resultFiles);
    }
  }

  private filterIsIncluded(files: ReadonlyArray<File>): ReadonlyArray<File> {
    return files.filter(file => this.filter.isIncluded(file.name));
  }

  private createLanguageService(typescriptFiles: ReadonlyArray<File>) {
    const tsConfig = getTSConfig(this.options);
    const compilerOptions: ts.CompilerOptions = (tsConfig && tsConfig.options) || {};
    return new TranspilingLanguageService(
      compilerOptions, typescriptFiles, getProjectDirectory(this.options), this.produceSourceMaps, this.getLogger);
  }

  private transpileFiles(files: ReadonlyArray<File>): ReadonlyArray<File> {
    let isSingleOutput = false;
    const fileDictionary: { [name: string]: File } = {};
    files.forEach(file => fileDictionary[file.name] = file);
    files.forEach(file => {
      if (!isHeaderFile(file.name)) {
        if (this.filter.isIncluded(file.name)) {

          // File is to be transpiled. Only emit if more output is expected.
          if (!isSingleOutput) {
            const emitOutput = this.languageService.emit(file.name);
            isSingleOutput = emitOutput.singleResult;
            emitOutput.outputFiles.forEach(file => fileDictionary[file.name] = file);
          }

          // Remove original file
          delete fileDictionary[file.name];
        }
      }
    });

    return Object.keys(fileDictionary).map(name => fileDictionary[name]);
  }
}
