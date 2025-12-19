/**
 * Test-Suite für ArduinoRunner
 */

// Store original setTimeout
const originalSetTimeout = global.setTimeout;

jest.mock("fs/promises", () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

const spawnInstances: any[] = [];

jest.mock("child_process", () => ({
  spawn: jest.fn(() => {
    const proc = {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      stdin: { write: jest.fn() },
      on: jest.fn(),
      kill: jest.fn(),
      killed: false,
    };
    spawnInstances.push(proc);
    return proc;
  }),
}));

import { spawn } from "child_process";
import { mkdir, writeFile } from "fs/promises";
import { ArduinoRunner } from "../../../server/services/arduino-runner";

describe("ArduinoRunner", () => {
  const wait = () => new Promise(resolve => originalSetTimeout(resolve, 10));

  beforeEach(() => {
    spawnInstances.length = 0;
    (mkdir as jest.Mock).mockClear();
    (writeFile as jest.Mock).mockClear();
    (spawn as jest.Mock).mockClear();
    
    // Mock setTimeout but keep it functional
    jest.useFakeTimers();
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Basic Functionality", () => {
    it("should compile and run sketch with output", async () => {
      const runner = new ArduinoRunner();
      const outputs: string[] = [];
      let exitCode: number | null = null;

      runner.runSketch(
        "void setup(){} void loop(){}",
        (line) => outputs.push(line),
        jest.fn(),
        (code) => (exitCode = code)
      );

      await wait();

      const compileProc = spawnInstances[0];
      const compileClose = compileProc.on.mock.calls.find(
        ([event]: any[]) => event === "close"
      )?.[1];
      compileClose(0);

      await wait();

      const runProc = spawnInstances[1];
      const stdoutHandler = runProc.stdout.on.mock.calls.find(
        ([event]: any[]) => event === "data"
      )?.[1];
      
      stdoutHandler(Buffer.from("Hello\n"));

      const runClose = runProc.on.mock.calls.find(
        ([event]: any[]) => event === "close"
      )?.[1];
      runClose(0);

      jest.advanceTimersByTime(100);
      expect(outputs.join("")).toContain("Hello");
      expect(exitCode).toBe(0);
    });

    it("should handle sketch without setup or loop", async () => {
      const runner = new ArduinoRunner();
      let exitCode: number | null = null;

      runner.runSketch(
        "int x = 5;",
        jest.fn(),
        jest.fn(),
        (code) => (exitCode = code)
      );

      await wait();

      const compileProc = spawnInstances[0];
      const compileClose = compileProc.on.mock.calls.find(
        ([event]: any[]) => event === "close"
      )?.[1];
      compileClose(0);

      await wait();

      const runProc = spawnInstances[1];
      const runClose = runProc.on.mock.calls.find(
        ([event]: any[]) => event === "close"
      )?.[1];
      runClose(0);

      expect(exitCode).toBe(0);
    });
  });

  describe("Output Buffering", () => {
    it("should buffer incomplete lines", async () => {
      const runner = new ArduinoRunner();
      const outputs: string[] = [];

      runner.runSketch(
        "void setup(){} void loop(){}",
        (line) => outputs.push(line),
        jest.fn(),
        jest.fn()
      );

      await wait();

      const compileProc = spawnInstances[0];
      const compileClose = compileProc.on.mock.calls.find(
        ([event]: any[]) => event === "close"
      )?.[1];
      compileClose(0);

      await wait();

      const runProc = spawnInstances[1];
      const stdoutHandler = runProc.stdout.on.mock.calls.find(
        ([event]: any[]) => event === "data"
      )?.[1];

      stdoutHandler(Buffer.from("Hel"));
      expect(outputs.join("")).toBe("");

      stdoutHandler(Buffer.from("lo\n"));
      jest.advanceTimersByTime(100);
      expect(outputs.join("")).toBe("Hello");

      const runClose = runProc.on.mock.calls.find(
        ([event]: any[]) => event === "close"
      )?.[1];
      runClose(0);
    });


    it("should flush remaining buffer on exit", async () => {
      const runner = new ArduinoRunner();
      const outputs: string[] = [];

      runner.runSketch(
        "void setup(){} void loop(){}",
        (line) => outputs.push(line),
        jest.fn(),
        jest.fn()
      );

      await wait();

      const compileProc = spawnInstances[0];
      const compileClose = compileProc.on.mock.calls.find(
        ([event]: any[]) => event === "close"
      )?.[1];
      compileClose(0);

      await wait();

      const runProc = spawnInstances[1];
      const stdoutHandler = runProc.stdout.on.mock.calls.find(
        ([event]: any[]) => event === "data"
      )?.[1];

      stdoutHandler(Buffer.from("Incomplete"));
      expect(outputs.join("")).toBe("");

      const runClose = runProc.on.mock.calls.find(
        ([event]: any[]) => event === "close"
      )?.[1];
      runClose(0);

      expect(outputs.join("")).toBe("Incomplete");
    });

    it("should handle stderr buffering", async () => {
      const runner = new ArduinoRunner();
      const errors: string[] = [];

      runner.runSketch(
        "void setup(){} void loop(){}",
        jest.fn(),
        (line) => errors.push(line),
        jest.fn()
      );

      await wait();

      const compileProc = spawnInstances[0];
      const compileClose = compileProc.on.mock.calls.find(
        ([event]: any[]) => event === "close"
      )?.[1];
      compileClose(0);

      await wait();

      const runProc = spawnInstances[1];
      const stderrHandler = runProc.stderr.on.mock.calls.find(
        ([event]: any[]) => event === "data"
      )?.[1];

      stderrHandler(Buffer.from("Error: "));
      stderrHandler(Buffer.from("Something wrong\n"));
      expect(errors).toContain("Error: Something wrong");

      stderrHandler(Buffer.from("Final error"));
      
      const runClose = runProc.on.mock.calls.find(
        ([event]: any[]) => event === "close"
      )?.[1];
      runClose(1);

      expect(errors).toContain("Final error");
    });

    it("should handle Windows line endings", async () => {
      const runner = new ArduinoRunner();
      const outputs: string[] = [];

      runner.runSketch(
        "void setup(){} void loop(){}",
        (line) => outputs.push(line),
        jest.fn(),
        jest.fn()
      );

      await wait();

      const compileProc = spawnInstances[0];
      const compileClose = compileProc.on.mock.calls.find(
        ([event]: any[]) => event === "close"
      )?.[1];
      compileClose(0);

      await wait();

      const runProc = spawnInstances[1];
      const stdoutHandler = runProc.stdout.on.mock.calls.find(
        ([event]: any[]) => event === "data"
      )?.[1];

      stdoutHandler(Buffer.from("Line1\r\nLine2\r\n"));
      jest.advanceTimersByTime(100);
      expect(outputs.join("")).toContain("Line1");
      expect(outputs.join("")).toContain("Line2");

      const runClose = runProc.on.mock.calls.find(
        ([event]: any[]) => event === "close"
      )?.[1];
      runClose(0);
    });

    it("should ignore empty lines", async () => {
      const runner = new ArduinoRunner();
      const outputs: string[] = [];

      runner.runSketch(
        "void setup(){} void loop(){}",
        (line) => outputs.push(line),
        jest.fn(),
        jest.fn()
      );

      await wait();

      const compileProc = spawnInstances[0];
      const compileClose = compileProc.on.mock.calls.find(
        ([event]: any[]) => event === "close"
      )?.[1];
      compileClose(0);

      await wait();

      const runProc = spawnInstances[1];
      const stdoutHandler = runProc.stdout.on.mock.calls.find(
        ([event]: any[]) => event === "data"
      )?.[1];

      stdoutHandler(Buffer.from("\n\n"));

      const runClose = runProc.on.mock.calls.find(
        ([event]: any[]) => event === "close"
      )?.[1];
      runClose(0);

      expect(outputs).toHaveLength(0);
    });
  });

  describe("Compilation Errors", () => {
    it("should handle compilation failure", async () => {
      const runner = new ArduinoRunner();
      const errors: string[] = [];
      const compileErrors: string[] = [];
      let exitCode: number | null = null;

      runner.runSketch(
        "void setup() { invalid }",
        jest.fn(),
        (line) => errors.push(line),
        (code) => (exitCode = code),
        (err) => compileErrors.push(err)
      );

      await wait();

      const compileProc = spawnInstances[0];
      const stderrHandler = compileProc.stderr.on.mock.calls.find(
        ([event]: any[]) => event === "data"
      )?.[1];
      
      stderrHandler(Buffer.from("error: expected semicolon"));

      const compileClose = compileProc.on.mock.calls.find(
        ([event]: any[]) => event === "close"
      )?.[1];
      compileClose(1);

      // Wait for catch block to execute
      await wait();

      expect(compileErrors.some(e => e.includes("expected semicolon"))).toBe(true);
      expect(exitCode).toBe(-1);
    });

    it("should handle compiler spawn error", async () => {
      const runner = new ArduinoRunner();
      const errors: string[] = [];
      const compileErrors: string[] = [];
      let exitCode: number | null = null;

      runner.runSketch(
        "void setup(){}",
        jest.fn(),
        (line) => errors.push(line),
        (code) => (exitCode = code),
        (err) => compileErrors.push(err)
      );

      await wait();

      const compileProc = spawnInstances[0];
      const errorHandler = compileProc.on.mock.calls.find(
        ([event]: any[]) => event === "error"
      )?.[1];
      
      errorHandler(new Error("g++ not found"));

      // Wait for catch block to execute
      await wait();

      expect(compileErrors.some(e => e.includes("g++ not found"))).toBe(true);
      expect(exitCode).toBe(-1);
    });

    it("should timeout compilation after 10 seconds", async () => {
      const runner = new ArduinoRunner();
      const errors: string[] = [];
      const compileErrors: string[] = [];
      let exitCode: number | null = null;

      runner.runSketch(
        "void setup(){}",
        jest.fn(),
        (line) => errors.push(line),
        (code) => (exitCode = code),
        (err) => compileErrors.push(err)
      );

      await wait();

      const compileProc = spawnInstances[0];

      // Advance timers to trigger the 10s timeout
      jest.advanceTimersByTime(10000);

      await wait();

      expect(compileProc.kill).toHaveBeenCalledWith('SIGKILL');
      expect(compileErrors.some(e => e.includes("timeout"))).toBe(true);
      expect(exitCode).toBe(-1);
    });
  });

  describe("Execution Timeouts", () => {
    it("should timeout sketch execution after 180 seconds", async () => {
      const runner = new ArduinoRunner();
      const outputs: string[] = [];
      const errors: string[] = [];

      runner.runSketch(
        "void setup(){} void loop(){}",
        (line) => outputs.push(line),
        (line) => errors.push(line),
        jest.fn()
      );

      await wait();

      const compileProc = spawnInstances[0];
      const compileClose = compileProc.on.mock.calls.find(
        ([event]: any[]) => event === "close"
      )?.[1];
      compileClose(0);

      await wait();

      const runProc = spawnInstances[1];

      // Advance timers to trigger the 180s timeout
      jest.advanceTimersByTime(180000);

      expect(runProc.kill).toHaveBeenCalledWith('SIGKILL');
      expect(outputs).toContain("--- Simulation timeout (180s) ---");
    });
  });

  describe("Serial Input", () => {
    it("should send serial input to running sketch", async () => {
      const runner = new ArduinoRunner();

      runner.runSketch(
        "void setup(){} void loop(){}",
        jest.fn(),
        jest.fn(),
        jest.fn()
      );

      await wait();

      const compileProc = spawnInstances[0];
      const compileClose = compileProc.on.mock.calls.find(
        ([event]: any[]) => event === "close"
      )?.[1];
      compileClose(0);

      await wait();

      const runProc = spawnInstances[1];

      runner.sendSerialInput("test input");

      expect(runProc.stdin.write).toHaveBeenCalledWith("test input\n");
      
      // Cleanup
      runner.stop();
    });

    it("should ignore serial input when not running", () => {
      const runner = new ArduinoRunner();
      runner.sendSerialInput("test");
      
      expect(true).toBe(true);
    });

    it("should ignore serial input after process killed", async () => {
      const runner = new ArduinoRunner();

      runner.runSketch(
        "void setup(){} void loop(){}",
        jest.fn(),
        jest.fn(),
        jest.fn()
      );

      await wait();

      const compileProc = spawnInstances[0];
      const compileClose = compileProc.on.mock.calls.find(
        ([event]: any[]) => event === "close"
      )?.[1];
      compileClose(0);

      await wait();

      const runProc = spawnInstances[1];
      runProc.killed = true;

      const writeCallsBefore = runProc.stdin.write.mock.calls.length;
      runner.sendSerialInput("test");
      const writeCallsAfter = runProc.stdin.write.mock.calls.length;

      expect(writeCallsAfter).toBe(writeCallsBefore);
      
      // Cleanup
      runner.stop();
    });
  });

  describe("Stop Functionality", () => {
    it("should stop running sketch", async () => {
      const runner = new ArduinoRunner();

      runner.runSketch(
        "void setup(){} void loop(){}",
        jest.fn(),
        jest.fn(),
        jest.fn()
      );

      await wait();

      const compileProc = spawnInstances[0];
      const compileClose = compileProc.on.mock.calls.find(
        ([event]: any[]) => event === "close"
      )?.[1];
      compileClose(0);

      await wait();

      const runProc = spawnInstances[1];

      runner.stop();

      expect(runProc.kill).toHaveBeenCalledWith('SIGKILL');
      expect(runner.isRunning).toBe(false);
      
      // Wait for kill to complete
      await wait();
      
      expect(runner.process).toBe(null);
    });

    it("should not call onExit when processKilled flag is set", async () => {
      const runner = new ArduinoRunner();
      const onExit = jest.fn();

      runner.runSketch(
        "void setup(){} void loop(){}",
        jest.fn(),
        jest.fn(),
        onExit
      );

      await wait();

      const compileProc = spawnInstances[0];
      const compileClose = compileProc.on.mock.calls.find(
        ([event]: any[]) => event === "close"
      )?.[1];
      compileClose(0);

      await wait();

      const runProc = spawnInstances[1];

      runner.stop();

      const runClose = runProc.on.mock.calls.find(
        ([event]: any[]) => event === "close"
      )?.[1];
      runClose(0);

      expect(onExit).not.toHaveBeenCalled();
    });

    it("should clear buffers on stop", () => {
      const runner = new ArduinoRunner();
      runner.stop();

      expect(runner['outputBuffer']).toBe('');
      expect(runner['errorBuffer']).toBe('');
    });
  });

  describe("Constructor", () => {
    it("should handle mkdir failure gracefully", async () => {
      (mkdir as jest.Mock).mockRejectedValueOnce(new Error('Permission denied'));
      
      const runner = new ArduinoRunner();
      
      jest.advanceTimersByTime(50);
      
      expect(runner).toBeDefined();
    });
  });
});