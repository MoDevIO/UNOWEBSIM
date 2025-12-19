//arduino-runner.ts

import { spawn } from "child_process";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { Logger } from "@shared/logger";
import { ARDUINO_MOCK_CODE } from '../mocks/arduino-mock';


export class ArduinoRunner {
    isRunning = false;
    tempDir = join(process.cwd(), "temp");
    process: ReturnType<typeof spawn> | null = null;
    processKilled = false;
    private logger = new Logger("ArduinoRunner");
    private outputBuffer = ""; // Buffer für ausstehende Ausgabe
    private errorBuffer = "";  // Buffer für error output
    private lineBuffer = "";    // Buffer für aktuelle line chars
    private lineQueue: string[] = []; // Queue für lines to send
    private baudrate = 9600; // Default baudrate
    private isSendingOutput = false; // Flag to prevent overlapping sends

    constructor() {
        mkdir(this.tempDir, { recursive: true })
            .catch(() => { this.logger.warn("Temp-Verzeichnis konnte nicht initial erstellt werden"); });
    }

    async runSketch(
        code: string,
        onOutput: (line: string, isComplete?: boolean) => void,
        onError: (line: string) => void,
        onExit: (code: number | null) => void,
        onCompileError?: (error: string) => void,
        onPinState?: (pin: number, type: 'mode' | 'value' | 'pwm', value: number) => void,
        timeoutMs: number = 180000
    ) {


        this.isRunning = true;
        // Reset buffers for new sketch
        this.outputBuffer = "";
        this.errorBuffer = "";
        this.isSendingOutput = false;
        let compilationFailed = false;

        // Parse baudrate from code
        const baudMatch = code.match(/Serial\s*\.\s*begin\s*\(\s*(\d+)\s*\)/);
        this.baudrate = baudMatch ? parseInt(baudMatch[1]) : 9600;
        this.logger.info(`Parsed baudrate: ${this.baudrate}`);

        const sketchId = randomUUID();
        const sketchDir = join(this.tempDir, sketchId);
        const sketchFile = join(sketchDir, `${sketchId}.cpp`);
        const exeFile = join(sketchDir, `${sketchId}.exe`);

        const hasSetup = /void\s+setup\s*\([^)]*\)/.test(code);
        const hasLoop = /void\s+loop\s*\([^)]*\)/.test(code);

        let footer = `
#include <thread>
#include <atomic>
#include <cstring>

int main() {
    std::thread readerThread(serialInputReader);
    readerThread.detach();
`;

        if (hasSetup) footer += "    setup();\n";
        if (hasLoop) footer += "    while (1) loop();\n";

        footer += `
    keepReading.store(false);
    return 0;
}
`;

        if (!hasSetup && !hasLoop) {
            this.logger.warn("Weder setup() noch loop() gefunden - Code wird nur als Bibliothek kompiliert");
        }

        try {
            await mkdir(sketchDir, { recursive: true });

            // Remove Arduino.h include to avoid compilation errors in GCC
            const cleanedCode = code.replace(/#include\s*[<"]Arduino\.h[>"]/g, '');
            const combined = `${ARDUINO_MOCK_CODE}\n// --- User code follows ---\n${cleanedCode}\n\n// --- Footer ---\n${footer}`;
            await writeFile(sketchFile, combined);

            await new Promise<void>((resolve, reject) => {
                const compile = spawn("g++", [sketchFile, "-o", exeFile]);
                let errorOutput = "";
                let completed = false;

                compile.stderr.on("data", d => { errorOutput += d.toString() });
                compile.on("close", (code) => {
                    completed = true;
                    if (code === 0) {
                        resolve();
                    } else {
                        this.logger.error(`Compiler Fehler (Code ${code}): ${errorOutput}`);
                        compilationFailed = true;
                        // Call compile error callback if provided
                        if (onCompileError) {
                          onCompileError(errorOutput);
                        }
                        reject(new Error(errorOutput));
                    }
                });
                compile.on("error", err => {
                    completed = true;
                    this.logger.error(`Compilerprozess Fehler: ${err.message}`);
                    compilationFailed = true;
                    if (onCompileError) {
                      onCompileError(`Compilerprozess Fehler: ${err.message}`);
                    }
                    reject(err);
                });

                setTimeout(() => {
                    if (!completed) {
                        compile.kill('SIGKILL');
                        this.logger.error("g++ Timeout nach 10s");
                        compilationFailed = true;
                        if (onCompileError) {
                          onCompileError("g++ timeout after 10s");
                        }
                        reject(new Error("g++ timeout after 10s"));
                    }
                }, 10000);
            });

            this.processKilled = false;
            this.process = spawn(exeFile);

            const timeout = setTimeout(() => {
                if (this.process) {
                    this.process.kill('SIGKILL');
                    onOutput(`--- Simulation timeout (${timeoutMs / 1000}s) ---`, true);
                    this.logger.info(`Sketch timeout after ${timeoutMs / 1000}s`);
                }
            }, timeoutMs);

            // IMPROVED: Output buffering with baudrate simulation
            this.process.stdout?.on("data", (data) => {
                const str = data.toString();
                this.outputBuffer += str;

                // Process complete lines
                const lines = this.outputBuffer.split(/\r?\n/);
                this.outputBuffer = lines.pop() || "";

                // Queue complete lines (ignore empty lines)
                lines.forEach(line => {
                    if (line.length > 0) {
                        this.lineQueue.push(line);
                    }
                });

                // Start sending if not already sending
                if (!this.isSendingOutput && this.lineQueue.length > 0) {
                    this.sendNextLine(onOutput);
                }
            });

            this.process.stderr?.on("data", (data) => {
                const str = data.toString();
                this.errorBuffer += str;

                // Process complete lines immediately
                const lines = this.errorBuffer.split(/\r?\n/);
                this.errorBuffer = lines.pop() || "";

                lines.forEach(line => {
                    if (line.length > 0) {
                        // Check for pin state messages
                        const pinModeMatch = line.match(/\[\[PIN_MODE:(\d+):(\d+)\]\]/);
                        const pinValueMatch = line.match(/\[\[PIN_VALUE:(\d+):(\d+)\]\]/);
                        const pinPwmMatch = line.match(/\[\[PIN_PWM:(\d+):(\d+)\]\]/);
                        
                        if (pinModeMatch && onPinState) {
                            const pin = parseInt(pinModeMatch[1]);
                            const mode = parseInt(pinModeMatch[2]);
                            onPinState(pin, 'mode', mode);
                        } else if (pinValueMatch && onPinState) {
                            const pin = parseInt(pinValueMatch[1]);
                            const value = parseInt(pinValueMatch[2]);
                            onPinState(pin, 'value', value);
                        } else if (pinPwmMatch && onPinState) {
                            const pin = parseInt(pinPwmMatch[1]);
                            const value = parseInt(pinPwmMatch[2]);
                            onPinState(pin, 'pwm', value);
                        } else {
                            // Regular error message
                            this.logger.warn(`[STDERR line]: ${JSON.stringify(line)}`);
                            onError(line);
                        }
                    }
                });
            });

            this.process.on("close", (code) => {
                clearTimeout(timeout);

                // Send any remaining buffered output immediately
                if (this.outputBuffer.trim()) {
                    onOutput(this.outputBuffer.trim(), true);
                }
                if (this.errorBuffer.trim()) {
                    this.logger.warn(`[STDERR final]: ${JSON.stringify(this.errorBuffer)}`);
                    onError(this.errorBuffer.trim());
                }

                if (!this.processKilled) onExit(code);
                this.process = null;
            });
        } catch (err) {
            this.logger.error(`Kompilierfehler oder Timeout: ${err instanceof Error ? err.message : String(err)}`);
            // Nur onError aufrufen wenn es NICHT ein Kompilierungsfehler war
            // Kompilierungsfehler sind bereits über onCompileError gesendet worden
            if (!compilationFailed) {
                onError(err instanceof Error ? err.message : String(err));
            }
            onExit(-1);
            this.process = null;
        }
    }

    sendSerialInput(input: string) {
        this.logger.debug(`Serial Input im Runner angekommen: ${input}`);
        if (this.isRunning && this.process && this.process.stdin && !this.process.killed) {
            this.process.stdin.write(input + "\n");
            this.logger.debug(`Serial Input an Sketch gesendet: ${input}`);
        } else {
            this.logger.warn("Simulator läuft nicht - serial input ignored");
        }
    }

    // Send output character by character with baudrate delay
    private sendNextLine(onOutput: (line: string, isComplete?: boolean) => void) {
        if (this.lineQueue.length === 0 || !this.isRunning) return;

        const line = this.lineQueue.shift()!;
        this.sendLineWithDelay(line, onOutput);
    }

    private sendLineWithDelay(line: string, onOutput: (line: string, isComplete?: boolean) => void) {
        if (line.length === 0 || !this.isRunning) {
            this.sendNextLine(onOutput);
            return;
        }

        this.lineBuffer = line;
        this.sendCharWithDelay(onOutput);
    }

    private sendCharWithDelay(onOutput: (line: string, isComplete?: boolean) => void) {
        if (this.lineBuffer.length === 0 || !this.isRunning) {
            this.isSendingOutput = false;
            this.sendNextLine(onOutput);
            return;
        }

        this.isSendingOutput = true;
        const char = this.lineBuffer[0];
        this.lineBuffer = this.lineBuffer.slice(1);

        // Send the character
        onOutput(char, false);

        // Calculate delay for next character
        const charDelayMs = Math.max(1, (10 * 1000) / this.baudrate);

        setTimeout(() => this.sendCharWithDelay(onOutput), charDelayMs);
    }

    stop() {
        this.isRunning = false;
        this.processKilled = true;

        if (this.process) {
            this.process.kill('SIGKILL');
            this.process = null;
        }

        // Clear buffers
        this.outputBuffer = "";
        this.errorBuffer = "";
        this.lineBuffer = "";
        this.lineQueue = [];
        this.isSendingOutput = false;
    }
}

export const arduinoRunner = new ArduinoRunner();