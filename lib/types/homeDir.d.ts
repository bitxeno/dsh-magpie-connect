/** Resolve the Harness home: explicit override > $DSH_HOME > ~/.dsh. */
export declare function resolveDshHome(configured?: string, env?: NodeJS.ProcessEnv): string;
/** Join path segments onto the resolved Harness home. */
export declare function dshHomePath(...segments: string[]): string;
/**
 * State directory used by dsh-magpie-connect 0.4.x and earlier.
 *
 * `homedir`-based on purpose — see the module note. Used only to read/write the
 * pre-0.5 settings file during the one-time, save-triggered migration.
 */
export declare function legacyDataDir(): string;
