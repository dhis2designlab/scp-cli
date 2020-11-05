import consola from "consola";
import cpm from "child_process";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function pspawn(...args: any[]): Promise<Record<string, unknown>> {
    let stdout: string | undefined = undefined;
    let stderr: string | undefined = undefined;
    consola.debug(`pspawn: args = `, args);
    const cp: any = (cpm.spawn as any)(...args);
    cp.stdout && cp.stdout.on("data", (data: any) => { stdout = (stdout || "") + data; });
    cp.stderr && cp.stderr.on("data", (data: any) => { stderr = (stderr || "") + data; });
    return new Promise((resolve) => {
        cp.on("close", (...args: string[]) => {
            resolve(["close", ...args])
        })
        cp.on("error", (...args: string[]) => {
            consola.debug(`cp error, args = `, args);
            resolve(["error", ...args])
        })
    }).then((result: any) => {
        consola.debug(`result =`, result);
        const resolveType = result[0];
        if (resolveType === "close") {
            const [, code, signal] = result;
            return { code, signal, stdout, stderr, error: undefined };
        } else {
            const [, error] = result;
            return { code: undefined, signal: undefined, stdout, stderr, error };
        }
    })
}