import { FileSystem } from "enhanced-resolve";
import * as ts from "typescript";
import { Transpilation } from "./transpilation";
import { emitProgramModules, TranspileOptions } from "./transpile";

export interface TranspilerHost extends Pick<ts.System, "getCurrentDirectory" | "readFile" | "writeFile"> {
    resolutionFileSystem?: FileSystem;
}

export interface TranspilerOptions {
    host?: TranspilerHost;
}

export interface EmitOptions extends TranspileOptions {
    writeFile?: ts.WriteFileCallback;
}

export interface EmitResult {
    emitSkipped: boolean;
    diagnostics: readonly ts.Diagnostic[];
}

export class Transpiler {
    public host: TranspilerHost;
    constructor({ host = ts.sys }: TranspilerOptions = {}) {
        this.host = host;
    }

    public emit(emitOptions: EmitOptions): EmitResult {
        const { program, writeFile = this.host.writeFile } = emitOptions;
        const options = program.getCompilerOptions();

        const transpilation = new Transpilation(this, program);
        emitProgramModules(transpilation, writeFile, emitOptions);
        if (options.noEmit || (options.noEmitOnError && transpilation.diagnostics.length > 0)) {
            return { diagnostics: transpilation.diagnostics, emitSkipped: true };
        }

        const chunks = transpilation.emit();

        const emitBOM = options.emitBOM ?? false;
        for (const { outputPath, code, sourceMap, sourceFiles } of chunks) {
            writeFile(outputPath, code, emitBOM, undefined, sourceFiles);
            if (options.sourceMap && sourceMap !== undefined) {
                writeFile(outputPath + ".map", sourceMap, emitBOM, undefined, sourceFiles);
            }
        }

        return { diagnostics: transpilation.diagnostics, emitSkipped: chunks.length === 0 };
    }
}
